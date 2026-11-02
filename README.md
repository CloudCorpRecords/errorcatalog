# errorcatalog

Every error message thrown in a codebase, catalogued — and,
when you supply the documentation, a note of whether each
message is documented.

errorcatalog scans source text line by line for throw
statements of the form `throw new <Name>Error(...)`, where the
type name ends in `Error` (`Error`, `TypeError`, `RangeError`,
or a custom type such as `FooError`). For each throw site it
records the file, the 1-based line, the error type, and:

- **literal** — the first argument is a double-quoted,
  single-quoted, or backtick string with no `${` in it. The
  message is recorded exactly as written, escape sequences
  included — nothing is unescaped.
- **dynamic** — the first argument is anything else: a
  template containing `${`, an identifier, a call, a
  concatenation, or a literal that does not close on the same
  line. The message is `null`.
- **no message** — `throw new <Name>Error()` with no argument
  at all. The message is `null` and the entry carries the note
  `no message argument`.

Throws that are not `new <Name>Error(...)` — a bare string, a
non-Error constructor, a variable — are not catalogued.
Duplicate throws stay as separate entries: the catalog is per
throw site.

When documentation texts are supplied, each literal message
is checked verbatim against them: `documented` is true when
the message appears as a substring of some supplied doc,
false when it does not, and null for dynamic and no-message
entries — and for every entry when no docs are supplied, in
which case the result reports `docs_provided: false` and the
documented / undocumented counts are both 0.

Known limitation, by design: only the first line of a throw
statement is inspected, so a literal whose argument list spans
lines is catalogued as dynamic. The analysis is pure local
text work: no network, no filesystem access in the core.

## CLI

```bash
npx @reneturcios/errorcatalog catalog --sources sources.json --docs docs.json
npx @reneturcios/errorcatalog --version
```

`sources.json` and `docs.json` each contain a JSON array of
`{"path": "src/app.ts", "content": "..."}` objects. The
`--docs` flag is optional. The catalog is printed as JSON.

Exit codes: `0` on success, `1` on a runtime error (including
an unreadable or invalid JSON file, or a malformed entry —
the error names the offending path, e.g.
`sources[0].content is required`), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/errorcatalog mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "errorcatalog": {
      "command": "npx",
      "args": ["-y", "@reneturcios/errorcatalog", "mcp"]
    }
  }
}
```

### Tools

- `catalog_errors` — Catalogue every error thrown in the
  given sources, and whether each literal message is
  documented.
  - `sources` (array, required, at least 1) — source files as
    `{path, content}` objects
  - `docs` (array, optional) — documentation texts as
    `{path, content}` objects; literal messages are checked
    verbatim against them

  Returns `{errors, counts, docs_provided}`, where each error
  is `{path, line, error_type, message, dynamic, documented}`
  (plus `note` on no-message entries) and counts is
  `{total, literal, dynamic, no_message, documented,
  undocumented}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/errorcatalog
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/errorcatalog catalog --sources /w/sources.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
