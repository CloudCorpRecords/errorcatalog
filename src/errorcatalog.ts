/**
 * errorcatalog core: catalogue every error thrown in a
 * codebase, and whether each message is documented.
 *
 *   catalogErrors(sources, docs?) -> result
 *
 * Scanning rules (line-wise, per source, in input order):
 *
 * - A throw site matches `throw new <Name>(` where <Name> is
 *   an identifier ending in "Error" (Error, TypeError,
 *   RangeError, or a custom FooError). Other throws — a bare
 *   string, a non-Error constructor, a variable — are ignored.
 * - The first argument is inspected on that line only:
 *   - A double-quoted, single-quoted, or backtick literal
 *     WITHOUT any `${` is a literal message. The raw string
 *     content is recorded with escape sequences kept exactly
 *     as written — no unescaping is performed.
 *   - A backtick template containing `${`, a literal followed
 *     by `+` (concatenation), or any non-literal first
 *     argument (identifier, call, expression) is a dynamic
 *     entry: message null, dynamic true.
 *   - `throw new <Name>()` with no argument is a no-message
 *     entry: message null, dynamic false, note
 *     "no message argument".
 * - Documented limitation: only the first line is inspected.
 *   If a literal does not close on that line (its argument
 *   list spans lines), the entry is treated as dynamic.
 *
 * Documented checks: when `docs` is provided, a literal
 * message is documented iff it appears verbatim as a substring
 * of some docs content. Dynamic and no-message entries always
 * carry documented null, as does every entry when docs are
 * not provided. Counts for documented / undocumented count
 * only literal entries and are both 0 when docs are absent.
 *
 * Duplicate throws are separate entries — the catalog is per
 * throw site, never deduplicated.
 */
import type {
  CatalogResult,
  DocFileInput,
  ErrorEntry,
  SourceFileInput,
} from "./types.js";

export const VERSION = "0.1.0";

export const NO_MESSAGE_NOTE = "no message argument";

const THROW_RE = /\bthrow\s+new\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

function validateFiles(
  value: unknown,
  label: string,
): SourceFileInput[] | DocFileInput[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is required and must be an array`);
  }
  return value.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`${label}[${i}] must be an object with path and content`);
    }
    const item = entry as { path?: unknown; content?: unknown };
    if (typeof item.path !== "string") {
      throw new Error(`${label}[${i}].path is required`);
    }
    if (typeof item.content !== "string") {
      throw new Error(`${label}[${i}].content is required`);
    }
    return { path: item.path, content: item.content };
  });
}

type FirstArg =
  | { kind: "literal"; message: string }
  | { kind: "dynamic" }
  | { kind: "no_message" };

/** Inspect the text after the opening `(` on the same line. */
function inspectFirstArg(rest: string): FirstArg {
  const trimmed = rest.trimStart();
  if (trimmed.length === 0) {
    // The argument (if any) starts on a later line; only the
    // first line is inspected, so this cannot be a literal.
    return { kind: "dynamic" };
  }
  const first = trimmed[0];
  if (first === ")") return { kind: "no_message" };
  if (first === '"' || first === "'" || first === "`") {
    let i = 1;
    let hasInterpolation = false;
    while (i < trimmed.length) {
      const ch = trimmed[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (first === "`" && ch === "$" && trimmed[i + 1] === "{") {
        hasInterpolation = true;
      }
      if (ch === first) {
        if (hasInterpolation) return { kind: "dynamic" };
        const after = trimmed.slice(i + 1).trimStart();
        if (after.startsWith("+")) return { kind: "dynamic" };
        return { kind: "literal", message: trimmed.slice(1, i) };
      }
      i += 1;
    }
    // The literal does not close on this line.
    return { kind: "dynamic" };
  }
  return { kind: "dynamic" };
}

function scanSource(
  source: SourceFileInput,
  docs: DocFileInput[] | undefined,
  out: ErrorEntry[],
): void {
  const lines = source.content.split(/\r\n|\r|\n/);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const lineText = lines[idx];
    THROW_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = THROW_RE.exec(lineText)) !== null) {
      const name = match[1];
      if (!name.endsWith("Error")) continue;
      const arg = inspectFirstArg(lineText.slice(THROW_RE.lastIndex));
      if (arg.kind === "no_message") {
        out.push({
          path: source.path,
          line: idx + 1,
          error_type: name,
          message: null,
          dynamic: false,
          documented: null,
          note: NO_MESSAGE_NOTE,
        });
      } else if (arg.kind === "dynamic") {
        out.push({
          path: source.path,
          line: idx + 1,
          error_type: name,
          message: null,
          dynamic: true,
          documented: null,
        });
      } else {
        const documented =
          docs === undefined
            ? null
            : docs.some((doc) => doc.content.includes(arg.message));
        out.push({
          path: source.path,
          line: idx + 1,
          error_type: name,
          message: arg.message,
          dynamic: false,
          documented,
        });
      }
    }
  }
}

/** Catalogue every `throw new <Name>Error(...)` in the sources. */
export function catalogErrors(sources: unknown, docs?: unknown): CatalogResult {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("sources is required and must be a non-empty array");
  }
  const sourceFiles = validateFiles(sources, "sources") as SourceFileInput[];
  const docFiles =
    docs === undefined ? undefined : (validateFiles(docs, "docs") as DocFileInput[]);
  const docsProvided = docFiles !== undefined;

  const errors: ErrorEntry[] = [];
  for (const source of sourceFiles) {
    scanSource(source, docFiles, errors);
  }

  let literal = 0;
  let dynamic = 0;
  let noMessage = 0;
  let documented = 0;
  let undocumented = 0;
  for (const entry of errors) {
    if (entry.note !== undefined) {
      noMessage += 1;
    } else if (entry.dynamic) {
      dynamic += 1;
    } else {
      literal += 1;
      if (docsProvided) {
        if (entry.documented) documented += 1;
        else undocumented += 1;
      }
    }
  }

  return {
    errors,
    counts: {
      total: errors.length,
      literal,
      dynamic,
      no_message: noMessage,
      documented,
      undocumented,
    },
    docs_provided: docsProvided,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
