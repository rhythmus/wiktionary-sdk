# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
for its output schema (see `VERSIONING.md`).

## [Unreleased]

### Added

- **Extraction support transparency:** optional **`LexemeResult.support_warning`** on grouped convenience output, merged by **`mapLexemes`** from **`withExtractionSupport`** (`src/convenience/extraction-support.ts`). Warnings explain empty/partial extractions when templates suggest a decoder or parse gap (relations, morphology, pronunciation, etymology, translations, examples, etc.). **`format()`** prints **Support:** for grouped wrapper arrays (branch 3b) across text, Markdown, HTML, terminal-HTML, and ANSI.
- **`stem()` / `extractStemsFromLexeme`:** Ancient Greek **`{{grc-conj}}`** / **`{{grc-decl}}`** stem extraction; expanded Greek Unicode validation (polytonic, breve); structured **`WordStems.support_warning`** when aliases are empty for coverage reasons; **`stem()`** lifts that string to the row so JSON does not duplicate it inside **`value`**. **`STEM_PARADIGM_TEMPLATE_FAMILY_SUMMARY`** exported for messages and docs.
- **Webapp:** **`wiktionary`** as a playground API method (full fetch with **`enrich`**, **`matchMode`**, **`debugDecoders`**); shared URL/query helpers for initial load and snippets.
- **Golden snapshots:** Added fixture-backed golden coverage for `γράφω`, `nested-templates`, `translations-multi`, and `nested-pipe-bug` in `test/golden/entry-snapshots.test.ts`.
- **Decoder coverage corpus evidence:** Added `test/fixtures/wikidata-pageprops.json` so `wikidata-p31` no longer requires allowlisting in `test/decoder-coverage.test.ts`.

### Changed

- **Drop `src/types.ts` shim:** in-repo code imports **`./model`** / **`../model`** (or **`@engine/model`** in the webapp); **`package.json`** Typedoc entrypoint is **`src/model/index.ts`**. Public types remain available from **`wiktionary-sdk`** via **`src/index.ts`**.
- **Modular `src/` layout** (see `docs/src-layout-refactor-plan.md`): engine code is grouped under **`ingress/`**, **`parse/`**, **`decode/`**, **`pipeline/`**, **`present/`**, **`convenience/`**, **`infra/`**, and **`model/`**. The former monolithic **`library.ts`** is replaced by split modules under **`src/convenience/`**; **`utils.ts`** / **`constants.ts`** live under **`src/infra/`**; domain types live in **`src/model/`** with in-repo imports pointing at **`./model`** / **`../model`** (no `src/types.ts` shim). Public **`wiktionary-sdk`** exports remain on the package barrel (`src/index.ts`).
- **Schema authoring**: Normalized JSON Schema is built from modular YAML under `schema/src/` (`npm run build:schema`); CI runs `check:schema-artifact` so `schema/normalized-entry.schema.json` stays in sync.
- **Output schema 3.3.0**: JSON Schema aligned with the TypeScript model (`src/model/`) — `schema_version` required on `FetchResult`; `RichEntry` fixes; `AlternativeForm` / `EtymologyData` / `TranslationItem.params` / `debug` / `metadata` tightened; new documentation `$defs` (lexicographic section slugs, langlinks, page metadata, decoder debug, library rows, morphology criteria). `EtymologyData.links` optional deprecated alias of `chain` in TypeScript.
- **Roadmap (Phase 9 / Stage 24)**: Documented **full ODXML ([ODict ODXML](https://www.odict.org/docs/xml))** export as a first-class deliverable alongside TEI Lex-0 (`docs/ROADMAP.md`, spec §12.10.7, §15 item 6).
- **Output schema 3.2.0**: `PartOfSpeech` / `PART_OF_SPEECH_VALUES` expanded with [ODict](https://www.odict.org/docs/reference/pos)-aligned standard tags (snake_case) and the full Japanese tag set (hyphens → underscores). JSON Schema `$defs.PartOfSpeech.enum` updated; `lexicographic-headings.ts` English heading mapping unchanged.
- `docs/ROADMAP.md` now lists **remaining work** only. Delivered multi-stage roadmap history is summarized in [Roadmap history — delivered engineering stages](#roadmap-history--delivered-engineering-stages) below.
- **Morphology parse context/options:** `conjugate()` / `decline()` now pass `title` in `action=parse` requests, and non-Greek paradigm families require explicit `MorphologyExpansionOptions` prefixes (`conjugationTemplatePrefixes` / `declensionTemplatePrefixes`).
- **Webapp compare and card UX:** compare fetch runs with `enrich: false` (tooltip updated), and plain lexeme formatter failures now render an inline error block instead of a blank card.
- **Webapp structure:** extracted `PlainLexemeHtmlBlock` and lexeme pill-group helper logic from `App.tsx` into dedicated modules for behavior-neutral component thinning.
- **Test docs:** `test/README.md` now documents cross-shell `WIKT_TEST_LIVE` invocation and a `refresh-recording` review checklist.
- **Library test strategy:** `test/library.test.ts` fixture-backed coverage was expanded (including phonetic and etymology paths), and mock-only cases are now explicitly documented in `test/README.md` via a wrapper coverage matrix.
- **Shared test fixture helper:** extracted reusable fixture-loading/API-stub utilities to `test/helper/fixture-fetch.ts`, and migrated `test/readme_examples.test.ts` plus `test/golden/entry-snapshots.test.ts` to reduce duplication while preserving behavior.
- **Configurable priority sort:** `wiktionary({ sort })` now accepts structured sort options (`{ strategy: "priority", priorities }`) in addition to string shorthand, with deterministic secondary keys (`etymology_index`, then PoS heading). CLI adds `--lang-priorities`, REST accepts `langPriorities=el=1,grc=2,...`, and webapp exposes source/priority strategy toggles.
- **Audit follow-through hardening:** orchestration tests now lock fuzzy-variant note emission alongside lexeme/debug alignment, and `test:ci` includes `check:types-schema-sync` so type/schema parity checks are guaranteed in CI rather than optional local runs.
- **Phase 7 closure docs:** `docs/ROADMAP.md` marks testing/doc debt items complete through 7.10, and `docs/query-result-dimensional-matrix.md` is refreshed for current fuzzy/debug behavior and ordering semantics.

---

## Roadmap history — delivered engineering stages

These items were formerly tracked in `docs/ROADMAP.md` as **Part I — Historical roadmap**. They are **done**; this appendix keeps a single traceability trail. Package-facing notes remain in the versioned sections above (`[2.0.0-rc.1]`, `[1.2.0]`, etc.).

| Stage (historical) | Focus (summary) |
|--------------------|-----------------|
| **14** (v2.0) | Offline-first test harness: API stubs, `test:perf` / `test:all` / `test:network`, goldens, decoder-coverage guard, parser invariants, `normalizeWiktionaryQueryPage`, `test/README.md`; registry subsense / `TAG_LABEL_MAP` refinements. |
| **15** | Sense qualifiers, etymology `raw_text`, `LANG_PRIORITY` expansion (NL/DE/FR/RU), audio beyond Greek-only templates. |
| **16** | RDF/SPARQL research notes; legacy mapping experiments; playground **Schema Inspector**. |
| **17** (v2.1) | Audio, examples, links, Wikidata P31/P279; **library / CLI / webapp parity** for convenience wrappers; playground UX; **AGENTS.md** cross-interface parity rules. |
| **18** (v2.1) | NL/DE headword decoders; `INFLECTED_FORM` vs `FORM_OF`; JSON Schema for `RichEntry` / `InflectionTable`; etymology `TEMPLATE_RELATION_MAP`. |
| **19** (v2.2) | Pronunciation audio galleries; structured citations; `subclass_of` (P279); `audioGallery()`, `citations()`, `isSubclass()`. |
| **20** (v2.2) | Handlebars HTML/Markdown, `entry.html.hbs` + `entry.css`, `richEntry()` extensions. |
| **21** (v2.3) | Non-lemma morphological rendering; inflected variants in `richEntry()`; redirect-style HTML/Markdown. |
| **22** (v2.4) | Form-of `subclass` granularity; etymology symbols + CSS; schema/YAML updates. |
| **22 / v2.5.0** (second tranche) | Greek verb/noun template depth; register / alternative-forms classification; HTML/CSS “purist” pass; morphology strategy documented (template decoding preferred over DOM scraping for core fields). |

**Testing baseline already shipped** (no longer a plan item): default `npm test` excludes bench; `test:perf`, `test:all`, `test:network` (`WIKT_TEST_LIVE`); golden snapshots; decoder corpus evidence test; `derivations` ↔ `derivedTerms` alias; README compliance suite — see `test/README.md` and the `[2.0.0-rc.1]` section above.

---

## [1.2.0] - 2026-03-29

### Added

**Granular Morphological Rendering (v2.4.0)**
- **Non-Lemma Subclasses**: Systematic extraction of `misspelling`, `abbreviation`, `clipping`, `diminutive`, and `plural` from `form-of` templates into the `subclass` field.
- **Academic Etymology Symbols**: Expanded `TEMPLATE_RELATION_MAP` to preserve specific relations (affix, compound, blend); implemented `etymSymbol` helper to map them to canonical symbols (`~` for variants, `←` for inheritance, `<` for derivation).
- **Premium Typographic Styling**: Added Red Wavy Underlines for misspellings and small-caps for abbreviations in `entry.css`.
- **Cross-Platform Bundling**: Templates and CSS re-bundled in `src/templates/templates.ts` for browser parity.

---

## [1.1.1] - 2026-03-29

### Added

**Buried Data Extraction (Stage 19)**
- **Audio Galleries**: Upgraded the `audio` decoder to collate all dialectal variants (US, UK, etc.) into `pronunciation.audio_details`.
- **Structured Citations**: Refined sense parsing to extract literary metadata (author, year, source, passage) from `{{quote-book}}` and related templates.
- **Ontological Depth**: Added `subclass_of` (P279) extraction from Wikidata to complement instance-of (P31).
- **Parity Wrappers**: New convenience functions `audioGallery()`, `citations()`, and `isSubclass()`.
- **Governance**: Added Schema Synchronization mandate to `AGENTS.md`.

---

## [1.1.0] - 2026-03-29

### Added

**Multi-lingual Expansion**
- **Dutch (NL) Support**: Initial headword decoders for nouns, verbs, and adjectives. Extractions include gender for nominals.
- **German (DE) Support**: Initial headword decoders for nouns, verbs, and adjectives. Extractions include gender for nominals.
- **Etymology Enrichment**: Added support for compositional templates: `affix`, `compound`, `back-formation`, `clipping`, `short for`, etc.

**Schema Consolidation (v2.1.0)**
- **High-Fidelity Output Schema**: Added formal JSON Schema definitions for `RichEntry` and `InflectionTable` for parity with high-level convenience wrappers.
- **New Entry Type**: Added `FORM_OF` entry type to the schema to represent lexical variants separately from grammatical inflections.
- **Metadata**: Added `lastrevid` to `Entry.metadata` and `FetchResult.metadata.info`.

### Changed

- **Classification Logic**: The extraction engine now systematically distinguishes between `INFLECTED_FORM` (grammatical paradigms) and `FORM_OF` (variants, abbreviations, misspellings).

---

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
- Lemma resolution for inflected forms with cycle protection and `lemma_triggered_by_lexeme_id` linkage metadata

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
