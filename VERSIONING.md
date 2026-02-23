# Output Schema Versioning

WiktionaryFetch output follows **Semantic Versioning 2.0.0** for its normalized JSON/YAML schema.

## Current Version

**`1.0.0`** — defined in [`schema/normalized-entry.schema.json`](schema/normalized-entry.schema.json).

## Version Semantics

| Bump  | When                                                                 |
|-------|----------------------------------------------------------------------|
| MAJOR | A required field is removed, renamed, or changes type                |
| MINOR | A new optional field is added to `Entry` or a sub-object             |
| PATCH | Documentation-only corrections to the schema (no runtime impact)     |

## Guarantees

- The `schema_version` field in output (when present) indicates which version of this schema the data conforms to.
- Consumers can rely on all `required` fields being present in every entry.
- Optional fields (`pronunciation`, `hyphenation`, `form_of`, `translations`, `wikidata`, `senses`, `semantic_relations`, `etymology`, `usage_notes`) appear **only** when the source wikitext contains the corresponding data.

## Changelog

### 1.0.0 (2026-02-23)

- Initial formalization of existing `Entry` and `FetchResult` types.
- Covers: `Pronunciation`, `Hyphenation`, `WiktionarySource`, `WikidataEnrichment`, `FormOf`, `TranslationItem`, `StoredTemplate`.
- Forward-compatible definitions for Phase 2 additions: `Sense`, `SemanticRelations`, `EtymologyData`, `usage_notes`.
