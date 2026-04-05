# Output Schema Versioning

Wiktionary SDK output follows **Semantic Versioning 2.0.0** for its normalized JSON/YAML schema.

The runtime string **`schema_version`** on each `FetchResult` is defined as **`SCHEMA_VERSION`** in [`src/model/schema-version.ts`](src/model/schema-version.ts). It must match the **current** row in this file for the same release.

## Current Version

**`3.3.0`** — formalized in [`schema/normalized-entry.schema.json`](schema/normalized-entry.schema.json) (built from [`schema/src/`](schema/src/) YAML via `npm run build:schema`), aligned with `Lexeme` / `FetchResult` in `src/model/`.

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

### 3.3.0 (schema documentation + required `schema_version`)

- **`schema_version`** is **required** on `FetchResult` in JSON Schema (it was always emitted at runtime).
- New `$defs`: `LexicographicSectionSlug`, `WiktionaryLanglink`, `PageMetadataInfo`, `MatchedTemplateRef`, `DecoderDebugEvent`, morphology criteria (`ConjugateCriteria`, `DeclineCriteria`, `GrammarTraits`), `LexemeResult`, `GroupedLexemeMapValue`; `EtymologyData.links` (deprecated alias of `chain`); `AlternativeForm.type` / `labels`; corrected **`RichEntry`** (`etymology`, `headword_morphology`, `images`, `translations` items); tighter `debug`, `metadata`, and `TranslationItem.params`.

### 3.0.0 (Lexeme model)

- Top-level array is **`lexemes`**; each item is a **`Lexeme`** (renamed from `entries` / `Entry`).
- Lemma resolution metadata uses **`lemma_triggered_by_lexeme_id`** (replacing the former `lemma_triggered_by_entry_id` name in types and docs).

### 2.0.0 (summary)

- Broader schema evolution: etymology `chain` / `cognates`, extended `SemanticRelations`, `Sense` labels/topics, `headword_morphology`, richer `Pronunciation`, page/API metadata on `FetchResult`, etc. (see [`docs/wiktionary-sdk-spec.md`](docs/wiktionary-sdk-spec.md) and git history).

### 1.0.0 (2026-02-23)

- Initial formalization of normalized output types.
- Covers: `Pronunciation`, `Hyphenation`, `WiktionarySource`, `WikidataEnrichment`, form-of / translation shapes, `StoredTemplate`.
- Forward-compatible definitions for Phase 2 additions: `Sense`, `SemanticRelations`, `EtymologyData`, `usage_notes`.
