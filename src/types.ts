/**
 * errorcatalog types.
 *
 * errorcatalog scans source text for throw statements of the
 * form `throw new <Name>Error(...)` and catalogues every site:
 * the error type, the message when it is written as a literal,
 * whether the message is dynamic or missing, and — when the
 * caller supplies documentation — whether a literal message
 * appears verbatim in that documentation.
 *
 * All analysis is pure local text analysis: no network, no
 * filesystem, no parsing beyond the line-wise rules described
 * in the core module.
 */

/** A source file supplied by the caller. */
export interface SourceFileInput {
  /** File path, carried verbatim into each catalog entry. */
  path: string;
  /** File content to scan, line by line. */
  content: string;
}

/** A documentation text supplied by the caller. */
export interface DocFileInput {
  /** Documentation file path. */
  path: string;
  /** Documentation file content. */
  content: string;
}

/** One catalogued throw site. */
export interface ErrorEntry {
  path: string;
  /** 1-based line number within the source file. */
  line: number;
  /** The thrown type name, e.g. Error, TypeError, FooError. */
  error_type: string;
  /** Literal message (escapes kept as written), or null. */
  message: string | null;
  /** True when the first argument is not a closed literal. */
  dynamic: boolean;
  /**
   * True iff the literal message appears verbatim in some
   * supplied docs content; null when docs were not provided,
   * or the entry is dynamic, or it has no message.
   */
  documented: boolean | null;
  /** Present only for a throw with no message argument. */
  note?: string;
}

/** Aggregate counts for a catalog run. */
export interface CatalogCounts {
  total: number;
  literal: number;
  dynamic: number;
  no_message: number;
  /** Literal entries found in the docs (0 when no docs). */
  documented: number;
  /** Literal entries not found in the docs (0 when no docs). */
  undocumented: number;
}

/** The catalog output object. */
export interface CatalogResult {
  errors: ErrorEntry[];
  counts: CatalogCounts;
  docs_provided: boolean;
}
