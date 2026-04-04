# Output Schema Versioning

Wiktionary SDK output follows **Semantic Versioning 2.0.0** for its normalized JSON/YAML schema.

The runtime string **`schema_version`** on each `FetchResult` is defined as **`SCHEMA_VERSION`** in [`src/types.ts`](src/types.ts). It must match the **current** row in this file for the same release.

## Current Version

**`3.0.0`** — formalized in [`schema/normalized-entry.schema.json`](schema/normalized-entry.schema.json), aligned with `Lexeme` / `FetchResult` in `src/types.ts`.

## Version Semantics

| Bump  | When                                                                 |
|-------|----------------------------------------------------------------------|
| MAJOR | A required field is removed, renamed, or changes type                |
| MINOR | A new optional field is added to `Lexeme` or a sub-object            |
| PATCH | Documentation-only corrections to the schema (no runtime impact)   |

## Guarantees

- The `schema_version` field in output indicates which version of this schema the data conforms to.
- Consumers can rely on all **required** fields being present on `FetchResult` and on each `Lexeme` as defined by the schema.
- Optional fields (`pronunciation`, `hyphenation`, `form_of`, `translations`, `wikidata`, `senses`, `semantic_relations`, `etymology`, `usage_notes`, …) appear **only** when the source wikitext (or API enrichment) supplies the corresponding data.

## Changelog

### 3.0.0 (Lexeme model)

- Top-level array is **`lexemes`**; each item is a **`Lexeme`** (renamed from `entries` / `Entry`).
- Lemma resolution metadata uses **`lemma_triggered_by_lexeme_id`** (replacing the former `lemma_triggered_by_entry_id` name in types and docs).

### 2.0.0 (summary)

- Broader schema evolution: etymology `chain` / `cognates`, extended `SemanticRelations`, `Sense` labels/topics, `headword_morphology`, richer `Pronunciation`, page/API metadata on `FetchResult`, etc. (see [`docs/wiktionary-sdk-spec.md`](docs/wiktionary-sdk-spec.md) and git history).

### 1.0.0 (2026-02-23)

- Initial formalization of normalized output types.
- Covers: `Pronunciation`, `Hyphenation`, `WiktionarySource`, `WikidataEnrichment`, form-of / translation shapes, `StoredTemplate`.
- Forward-compatible definitions for Phase 2 additions: `Sense`, `SemanticRelations`, `EtymologyData`, `usage_notes`.
