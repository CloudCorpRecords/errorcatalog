# errorcatalog — Build Report

MCP Rebuild 1000, Batch 12. Original program build from the
packages-100 plan (cluster G #80: "Every error message thrown
in the codebase, and whether it is documented."), built from
the program spec in
`~/workspace/mcp-rebuild-100/specs-batch12/errorcatalog.md`.
No external original exists; nothing was searched for or
rebuilt from one. Local build only — nothing pushed or
published.

Identity: repo `errorcatalog`, npm `@reneturcios/errorcatalog`,
MCP name `io.github.CloudCorpRecords/errorcatalog`, version
`0.1.0`, bin `errorcatalog` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Catalogue every
  error a codebase throws, and whether each message is
  documented.", 80 chars ≤100; npm entry carries
  `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/errorcatalog:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/errorcatalog"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright (c)
  2026 Rene Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27), `package-lock.json`
  (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`catalog` with `--sources`
  and optional `--docs`, `mcp`, `--version`; exit 2 usage /
  1 runtime error), `src/mcp.ts`, `src/types.ts`,
  `src/errorcatalog.ts` (core, `VERSION = "0.1.0"`)
- `test/errorcatalog.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/errorcatalog`)

## Tools implemented (1)

- `catalog_errors` — `sources` (array, required, minItems 1)
  of `{path, content}` source files; `docs` (array, optional)
  of `{path, content}` documentation texts. Returns
  `{errors, counts, docs_provided}`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals exactly matching the fixture, per the
  standing fleet rule; zod still validates every
  `tools/call`. When zod rejects a call, the core validator is
  consulted so the returned `isError` text names the offending
  path exactly as the spec requires (e.g.
  `sources[0].content is required`).
- Scanning is line-wise: a throw site matches
  `throw new <Name>(` where `<Name>` ends in `Error`. The
  first argument is inspected on that line only:
  - double-quoted, single-quoted, or backtick literal without
    `${` → literal message, raw content with escape sequences
    kept exactly as written (no unescaping);
  - backtick template containing `${`, a literal followed by
    `+`, or any non-literal first argument → dynamic entry
    (message null, dynamic true);
  - no argument → message null, dynamic false, `note`
    "no message argument", counted as `no_message`.
  - Documented limitation (in the spec and the README): only
    the first line is inspected, so a literal that does not
    close on that line — an argument list spanning lines — is
    treated as dynamic.
- Non-Error throws (`throw "str"`, `throw new Foo()`,
  `throw err`) are ignored. Duplicate throws are separate
  entries; ordering is source input order, then line
  ascending.
- Documented semantics: `documented` is true iff a literal
  message appears verbatim as a substring of some docs
  content; false when docs were supplied and it does not;
  null for dynamic / no-message entries and for every entry
  when docs are absent. When docs are absent,
  `docs_provided: false` and the documented / undocumented
  counts are both 0; otherwise those counts cover literal
  entries only.
- Local choice: the documented check is per docs content
  ("some docs content", per the spec's entry definition)
  rather than against a concatenation, so a message cannot
  be marked documented by text spanning a docs boundary.
- Local choice: a literal immediately followed by `+` is
  classified dynamic (concatenation), per the spec listing
  concatenation among the non-literal forms.
- The core is pure local text analysis: no network, no
  filesystem. The CLI reads the `--sources` / `--docs` JSON
  array files before calling it.

## Verification (foreground, this session)

- `npx tsc` exit 0 (`dist/cli.js` built)
- `npm test`: **21 tests, 21 pass, 0 fail** — double / single
  / backtick literals, escapes kept as written, custom
  *Error names, template with `${}` → dynamic, non-literal
  argument (identifier, call, concatenation start) →
  dynamic, literal-plus-concatenation → dynamic, no-arg →
  no_message note, multiline literal → dynamic, argument on
  the next line → dynamic, non-Error throws ignored,
  ordering across sources, duplicates kept, mixed counts,
  documented true/false with caller-supplied docs, documented
  null for dynamic / no-message entries, docs absent →
  `docs_provided` false with documented/undocumented 0,
  validation errors naming `sources[i]` / `docs[i]` paths
- `dist/cli.js --version` → `0.1.0`; unknown command exits 2
  with usage; CLI `catalog` run end-to-end over JSON files
  printed the catalog object (exit 0) with a documented
  literal and a dynamic custom error correctly classified
- Parity: `harness/parity.py` vs
  `harness/fixtures/errorcatalog-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1**

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
with only `package.json`, offline `npm install
--package-lock-only --ignore-scripts --offline`), verified:
parses, name `@reneturcios/errorcatalog`, **128 package
entries**. (The first Route 3 attempt's temp directory was
lost when /tmp was wiped by a VM restart; the generation was
re-run and its verified output copied into the build in the
same step.) Dependencies were installed locally with an
offline `npm install`, which succeeded — no copied
node_modules fallback was needed.

## Gaps / honest notes

- Line-wise scanning is the spec's own documented design,
  not a full parser: throws inside comments or string
  literals in the scanned code would be catalogued, and a
  throw split before its `(` is not seen. This follows the
  spec's stated first-line-only limitation.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
