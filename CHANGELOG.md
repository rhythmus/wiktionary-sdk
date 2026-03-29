# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
for its output schema (see `VERSIONING.md`).

## [2.0.0-rc.1] - 2026-03-29

### Added

**Schema v2.0 & API Enrichment**
- **Metadata**: Support for `categories`, `langlinks` (interwiki), and `info` (pageid, revision_id, last_modified) from MediaWiki API.
- **Traceability**: All entries now carry full source provenance (`revision_id`, `last_modified`, `pageid`).
- **Structured Sections**: New decoders for `Usage notes`, `References`, `Alternative forms`, `Anagrams`, `See also`, and `Hyphenation`.
- **Phonetics**: Added `audio_url` (resolved Commons links), `romanization`, `rhymes`, and `homophones`.
- **Semantics**: Expanded relations to include `coordinate_terms`, `holonyms`, `meronyms`, and `troponyms`.

**Morphological Engine**
- New high-level API: `conjugate()`, `decline()`, `stem()`, `morphology()`.
- **Principal Parts**: Extraction of primary paradigm slots (simple past, future, etc.) from headword templates.
- **Verbal Features**: Extraction of `aspect` (perfective/imperfective), `voice` (active/passive/mediopassive) and `transitivity`.
- **Nominal Features**: Extraction of `gender` for nouns and adjectives.
- **Human Labels**: `form_of.label` generates human-readable strings (e.g., "1st pers. singular perfective past") from raw tag arrays.

**SDK Capabilities**
- **Auto-discovery**: `lang="Auto"` and `pos="Auto"` enable cross-language aggregation and discovery.
- **Language Priority**: Weighted sorting of results (Greek > Ancient Greek > English).
- **Formatter Engine**: `src/formatter.ts` with ANSI, Terminal-HTML, and Markdown support.
- **Performance**: Tiered caching (L1/L2) and rate-limiting integrated into the Wikimedia API client.

**Interfaces & Tooling**
- CLI: Interactive TTY support with `--format ansi`.
- Webapp: Live API Playground with dual-theme UI, pseudo-terminal simulation, and decoder-match inspector.
- Introspection: Crawler tool for identifying missing template decoders.

**Testing & verification (offline-first)**
- `normalizeWiktionaryQueryPage()` in `src/api.ts`: shared mapping from MediaWiki `query.pages[]`
  JSON to the same shape as `fetchWikitextEnWiktionary` (for fixtures and replay tests).
- `test/README.md`: mocking rules (`api` vs partial `index` mock), npm scripts, goldens,
  decoder coverage, network replay; linked from `AGENTS.md` and root `README.md`.
- npm scripts: `test:ci`, `test:unit`, `test:perf` (parser wall-clock only),
  `test:all`, `test:network` (`WIKT_TEST_LIVE` for optional live check),
  `refresh-recording` (optional API JSON refresh).
- `vitest.config.ts` excludes `test/bench.test.ts` from default `npm test`;
  `vitest.bench.config.ts` runs it under `test:perf`.
- Golden entry snapshots (`test/golden/`), decoder registry corpus evidence test,
  parser structural invariants, offline `minimal-query.json` + `network-replay.test.ts`,
  `tools/refresh-api-recording.ts`.
- Library: `derivations` exported as alias of `derivedTerms` (spec/README aligned on
  `{ term, … }[]` items).

### Changed

- **Normalization**: Enforced Unicode NFC normalization across all inputs/outputs.
- **Parser**: Refactored H3-H5 heading logic for robust segmentation in complex etymologies.
- **Lemma Resolution**: Prioritizes `INFLECTED_FORM` entries over metadata blocks.
- **Parser perf test**: `test/bench.test.ts` uses higher thresholds when `CI` is set
  (`PERF_SLACK`) to reduce flakes on shared runners.

### Fixed

- `morphology()`: Filters non-linguistic blocks and seeds LEXEME defaults for better matching.
- Row-header matching: Accepted ordinal suffixes in conjugation tables.
- **Unit tests**: `enrichment`, `auto`, `stem`, and `library` suites stub `src/api` so
  `lemma` / `interwiki` / etc. do not hit live `en.wiktionary.org` (avoids hangs, rate
  limits, and cache-dependent timing). `library.test.ts` uses full `api` mock spread
  and fixes `derivedTerms` expectations; `derivations` alias covered by test.

---

## [1.0.0] - 2026-02-23

### Added

**Core engine & extraction**
- Wiktionary and Wikidata fetch via MediaWiki API; brace-aware template parser with pipe splitting that preserves `|` inside `[[links]]` and `{{templates}}`
- Registry of template decoders: headword (el-verb, el-noun, etc.), pronunciation (IPA, el-IPA, audio, hyphenation), form-of, translations, senses, semantic relations (syn/ant/hyper/hypo), etymology (inh/der/bor/cog), usage notes
- Sense-level structuring: `#` / `##` / `#:` lines → `Sense` objects with IDs, subsenses, examples; brace-aware `stripWikiMarkup` for glosses
- Section decoders for `{{l}}`/`{{link}}` in Derived terms, Related terms, Descendants; stores `raw_text` and structured `items`
- Lemma resolution for inflected forms with cycle protection and `lemma_triggered_by_entry_id` linkage metadata

**Infrastructure**
- Multi-tier cache (L1 memory, pluggable L2/L3); rate limiter (10 req/s); template introspection tool
- `--sample N` mode on template-introspect: samples Greek entries, reports top missing templates by frequency
- Declared decoder coverage (`handlesTemplates`, `getHandledTemplates()`) for stable coverage reporting

**Interfaces**
- React webapp: YAML preview, Wikidata media gallery, click-to-source template inspector, debugger mode (decoder match table), comparison view
- CLI: single/batch lookup, yaml/json output, `--batch`, `--output`
- HTTP API: `GET /api/fetch`, `GET /api/health`, CORS
- Dual ESM/CJS build; Docker containerization

**Schema & tooling**
- JSON Schema (draft-07) at `schema/normalized-entry.schema.json`; `SCHEMA_VERSION` in output
- Decoder debug mode: `fetchWiktionary({ debugDecoders: true })` returns `FetchResult.debug` with per-entry decoder match info
- `Entry.templates_all`: templates in document order with optional `start`, `end`, `line` for click-to-source

### Changed

- Unknown language codes: `langToLanguageName()` returns `null`; `fetchWiktionary()` returns early with a note (no silent fallback to Greek)
- Translation items: `term` (required), `gloss?`, `transliteration?`, `gender?`, `alt?` from explicit params only
- Packaging: CLI and server compiled to `dist/`; `bin` points to built JS; cache keys normalize redirects
- `EntryType` tightened to match schema enum (`LEXEME` | `INFLECTED_FORM` | `FORM_OF`)

### Fixed

- Brace-aware pipe splitting: pipes inside nested `{{...}}` no longer cause mis-parsed template params
- Brace-aware gloss stripping: `[[link]]` and `[[link|display]]` no longer duplicate or corrupt text; nested `{{...}}` removed correctly

### Documentation

- `docs/wiktionary-fetch-spec.md`: formal v1.0 spec with design rationale
- `docs/ROADMAP.md`: principles retained; completed stages removed
- `AGENTS.md`: commit style guide, type prefixes, examples

---

## Development history (pre-1.0)

- **Init**: Prototype from ChatGPT conversation; core engine; React frontend; web → webapp rename
- **Phases 1–6**: JSON Schema, semantic decoders, cache/rate-limit/introspect, CLI/build/Docker, benchmarks, template inspector
- **Post-v1.0 hardening**: Fixture-based integration tests, schema_version, brace-aware parsing, translation semantics, packaging, decoder debug, template location, cycle protection, gloss_raw, section links, sample mode, brace-aware stripping

[1.0.0]: https://github.com/woutersoudan/wiktionary-fetch/releases/tag/v1.0.0
