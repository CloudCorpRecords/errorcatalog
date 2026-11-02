# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `catalog_errors` MCP tool and `catalog`
  CLI command cataloguing every `throw new <Name>Error(...)`
  in the supplied sources.
- Literal, dynamic, and no-message entries; verbatim
  documented checks against caller-supplied documentation;
  counts for each class, with `docs_provided` reported.
