# Wiktionary SDK: Implementation Roadmap (post-v1.0)

This roadmap proposes the next implementation stages for the
`wiktionary-sdk` ecosystem.

## Principles (non-negotiable)

- **Extraction, not inference**: only extract what is explicitly present in
  Wikitext/template parameters.
- **Traceability**: every structured field must be traceable to a source
  template, line, or section; store verbatim raw text alongside decoded data
  when practical.
- **Registry-first**: mapping/decoding logic lives in `src/registry.ts`, not in
  the parser or orchestration layer.

---

**Stage 9: Morphological API & Technical Documentation (Delivered)**
- Implementation of `conjugate()`, `decline()`, `stem()`, and `morphology()`.
- Added technical deep-dive documentation into Scribunto/Lua runtime.
- Formalized project rebranding to **Wiktionary SDK**.

**Stage 10: Formatter Engine, Morphology Corrections & Playground Overhaul (Delivered)**

- Added `src/formatter.ts`: polymorphic `format()` function with `text`, `markdown`, `html`,
  `ansi`, and `terminal-html` registered styles. `FormatterStyle` interface is public and
  pluggable via `registerStyle()`.
- Fixed `conjugate()` / `decline()` empty-criteria mode: returns full structured paradigm table
  (`Record<string, any>`) instead of an empty array.
- Fixed `morphology()`: non-linguistic entries (Pronunciation, References, etc.) are now
  filtered before form matching; case-insensitive match; LEXEME entries seed POS-appropriate
  grammatical defaults.
- Fixed row-header matching in `conjugate()` to accept ordinal suffixes (`1st sg`, `2nd pl`, …).
- CLI: `--format ansi` added; smart TTY default selects ANSI when stdout is interactive.
- Webapp: dual-theme UI (light dictionary + dark inspector); salve-style left-aligned Inter
  header with inline bold name and descriptor; macOS traffic-light terminal chrome.
- Webapp: pseudo-terminal renders exact CLI command (`~ wiktionary-sdk γράφω --extract stem`)
  before colour-coded `terminal-html` output.
- Webapp: GitHub corner (tholman-style with octocat wag animation).
- Webapp: removed misleading Wikidata checkbox; `enrich: true` hardcoded for playground.

**Stage 11: Compliance, Normalization & Doc Synchronization (Delivered)**

- **README Compliance Suite**: Integrated `test/readme_examples.test.ts` to ensure 100% parity
  between documentation and implementation.
- **Unicode Normalization (NFC)**: Forced all inputs (queries) and outputs (wikitext, titles) to
  NFC normalization in `src/api.ts` and `src/index.ts`, resolving cross-platform comparison
  failures.
- **Lemma Resolution Prioritization**: Updated `src/library.ts` to favor `INFLECTED_FORM` entries
  when searching for a lemma, preventing metadata blocks from intercepting resolution.
- **Robust IPA Decoding**: Updated `src/registry.ts` to find IPA even if slashes (`/`) or 
  brackets (`[]`) are missing in the wikitext template.
- **Hyphenation Support**: Confirmed `hyphenate()` returns arrays by default and supports 
  the `{ format: 'string' }` option for full flexibility.
- **API Aliases**: Added `phonetic()` and `derivations()` as semantic aliases for high-level 
  wrappers.

**Stage 12: Auto-discovery, Optional Filtering & Robust Parsing (Delivered)**

- **Auto-discovery Mode**: Implemented `lang="Auto"` as the default, enabling the SDK to scan
  and aggregate entries across all language sections found on a page.
- **Language Priority Engine**: Introduced a `LANG_PRIORITY` map to ensure results are 
  consistently sorted (Greek > Ancient Greek > English).
- **Optional PoS Filtering**: Added `pos` as an optional parameter (defaulting to `"Auto"`)
  supporting both precise PoS matching and broad discovery.
- **Robust H3-H5 Parser**: Refactored the core segmentation logic to use symmetrical regex
  for all heading levels from H3 to H5, resolving missing PoS blocks in complex etymologies.
- **Cross-Language Resolution**: Optimized `lemma()` and convenience wrappers to operate
  seamlessly across multiple languages in Auto mode, while maintaining language-affinity
  during recursive resolution.
- **Expanded Language Mapping**: Added support for 15+ additional languages in the internal
  mapping to improve the reliability of multi-language scans.
- **Webapp Integration**: Updated the React playground to use Auto-discovery by default,
  providing instant feedback on the SDK's ability to handle multi-entry pages like "bank".

**Stage 13: Comprehensive Schema v2.0, API Enrichment & Decoder Expansion (Delivered)**

- **API Enrichment** (`src/api.ts`, `src/index.ts`): Extended `prop` parameter to include
  `categories`, `langlinks`, and `info` alongside `revisions|pageprops`. New fields from
  the API response: `categories[]` (page categories, "Category:" stripped), `langlinks[]`
  (links to other Wiktionary editions), and `info` object (`touched` as `last_modified`,
  `length`, `pageid`, `lastrevid`). These are propagated to `FetchResult.metadata` (unfiltered)
  and to each `Entry` (`categories` filtered by language section, `langlinks`, and `metadata`).
  `source.wiktionary.revision_id`, `last_modified`, and `pageid` populated on every entry.

- **Schema v2.0.0** (`src/types.ts`, `schema/normalized-entry.schema.json`): Major version
  bump. Key interface changes:
  - `Pronunciation`: added `audio_url`, `romanization`, `rhymes`, `homophones`.
  - `WiktionarySource`: added `revision_id`, `last_modified`, `pageid`.
  - `Sense`: added `qualifier`, `labels`, `topics`.
  - `SemanticRelations`: added `coordinate_terms`, `holonyms`, `meronyms`, `troponyms`.
  - `EtymologyData`: replaced `links` with `chain` + `cognates`; added `raw_text`.
  - `EtymologyLink`: added `relation` field (`"inherited"` | `"borrowed"` | `"derived"` | `"cognate"`).
  - `Entry`: added `headword_morphology`, `alternative_forms`, `see_also`, `anagrams`,
    `references`, `inflection_table_ref`, `categories`, `langlinks`, `metadata`.
  - `form_of`: added `label` (human-readable from tag array).
  - `FetchResult`: added `metadata` block.
  - JSON Schema updated throughout to match.

- **Parser enhancement** (`src/parser.ts`): Etymology preamble text is now preserved as
  `etymology_raw_text` on each etymology block and passed through `DecodeContext`.

- **New decoders** (`src/registry.ts`):
  - `form-of` (extended): produces `label` from `tags[]` via `TAG_LABEL_MAP` + `tagsToLabel()`.
  - `etymology-v2`: splits `chain[]` (inh/der/bor) and `cognates[]` (cog); adds `relation`
    field and populates `raw_text` from the preamble.
  - `el-verb-morphology`: extracts `transitivity` (`tr`/`intr` params) and `principal_parts`
    (past/fut/pres_pass/etc.) from `{{el-verb}}`.
  - `el-noun-gender`: extracts `gender` from `{{el-noun}}` `g=` param.
  - `alternative-forms`: parses `====Alternative forms====` via `{{l}}`/`{{link}}`.
  - `see-also`: parses `====See also====` section.
  - `anagrams`: parses `====Anagrams====` section via `{{l}}`.
  - `references`: extracts `====References====` section text.
  - `inflection-table-ref`: captures the conjugation/declension template call.
  - `senses` (extended): extracts `qualifier` from parenthetical text and `labels`/`topics`
    from `{{lb|...}}` on definition lines.
  - `semantic-relations` (extended): adds `cot`, `hol`, `mer`, `tro` template families.
  - `pronunciation` (extended): adds `audio_url` (resolved Commons URL), `romanization`,
    `rhymes`, `homophones`.

- **New library wrappers** (`src/library.ts`):
  `principalParts()`, `gender()`, `transitivity()`, `alternativeForms()`, `seeAlso()`,
  `anagrams()`, `usageNotes()`, `derivedTerms()`, `relatedTerms()`, `descendants()`,
  `referencesSection()`, `etymologyChain()`, `etymologyCognates()`, `etymologyText()`,
  `categories()`, `langlinks()` (alias: `interwiki`), `isCategory()`, `pageMetadata()`,
  `inflectionTableRef()`.
  `pronounce()` updated to prefer `audio_url`. `etymology()` reads `chain` with `links` fallback.
  `richEntry()` extended with `coordinate_terms`, `holonyms`, `meronyms`, `troponyms`,
  `references`, `aspect`, `voice`.

- **Test suite** (`test/`): `phase2.test.ts`, `integration.test.ts`, `library.test.ts`,
  `readme_examples.test.ts`, `auto.test.ts` updated for renamed fields and new shapes.
  New `test/enrichment.test.ts` tests categories, interwiki links, and page metadata.

- **Documentation**: spec upgraded to v2.0; ROADMAP extended with this stage.
  `docs/schemata/DictionaryEntry — proposed v2 schema.yaml` added as comprehensive
  annotated field inventory.

**All planned stages (0–13) are complete.** This document is retained for
reference. Future work can be added here as new stages.
