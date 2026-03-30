# Wiktionary SDK: Implementation Roadmap (v2.0 & Beyond)

This roadmap defines the remaining tasks for the v2.0 final release and the strategic goals for future development.

## Principles (non-negotiable)

- **Extraction, not inference**: only extract what is explicitly present in
  Wikitext/template parameters.
- **Traceability**: every structured field must be traceable to a source
  template, line, or section.
- **Registry-first**: mapping/decoding logic lives in `src/registry.ts`, not in
  the parser or orchestration layer.

---

## 🏗️ Stage 14: v2.0 Final Release & Reliability (Delivered)

**Goal**: resolve infrastructure bottlenecks and ensure 100% parity with the Comprehensive Schema Proposal.

- **Infrastructure: Test suite (largely delivered)**
    - **Done:** `enrichment.test.ts`, `auto.test.ts`, `stem.test.ts`, and `library.test.ts` stub `src/api` so default `npm test` avoids live HTTP; perf tests split (`test:perf` / `test:all`); golden snapshots, decoder-coverage guard, parser invariants, offline API replay, and `test/README.md` are in place.
    - **Remaining:** consolidation of hybrid mocks in `library.test.ts`, shrinking decoder allowlists, and optional items documented in [Testing suite: deferred work and follow-ups](#testing-suite-deferred-work-and-follow-ups) below.
- **Registry: Final Refinements**
    - Ensure subsense labeling (register/domain) is fully functional for all indentation levels.
    - Expand `TAG_LABEL_MAP` for 100% coverage of common Wiktionary morphological tags.
- **QA: Final Verification**
    - Conduct a full Unit Test audit using the v2-final specification as the ground truth.
    - Cross-verify `γράφω` and `έγραψε` output in the playground to ensure 100% field population.

## 🚀 Stage 15: Deep Enrichment & Multi-language Robustness (Delivered)

**Goal**: expand beyond the Greek-heavy focus and refine the structure of linguistic metadata.

- **Sense Qualifiers**: implement structured extraction of parenthetical register/usage qualifiers (e.g., "(nautical)", "(colloquial)") into the `qualifier` field.
- **Etymology Prose**: populate the `raw_text` field for etymology blocks systematically across all language sections.
- **Language Priority Expansion**: expand the `LANG_PRIORITY` engine and language mapping for Dutch, German, French, and Russian.
- **Audio URL Resolution**: standardize the file-to-URL resolution for audio templates beyond the Greek-specific ones.

## 🧪 Stage 16: Advanced Integrations & Playground Overhaul (Delivered)

**Goal**: research external data sources and integrate legacy linguistic mappings.

- **External Data**: research Wiktionary RDF/SPARQL endpoints for potential hybrid extraction.
- **Legacy Mappings**: integrate Dutch-Russian and Greek-Dutch mappings derived from prior AI-assisted research (see `docs/AI agents chat history/`).
- **Webapp Polish**: add a "Schema Inspector" to the playground to help users understand the v2 structure interactively.

---

## Testing suite: deferred work and follow-ups

This section records **intentionally partial** choices from the testing hardening pass, **deferred** work, and **optional improvements**. Ground rules and scripts live in [`test/README.md`](../test/README.md); agent context in [`AGENTS.md`](../AGENTS.md).

### Context (what already shipped)

- Default **`npm test`** excludes `test/bench.test.ts`; **`npm run test:perf`** runs wall-clock parser checks (with **`PERF_SLACK`** when `CI` is set).
- **`npm run test:all`** runs the full unit/integration suite then perf.
- **`npm run test:network`** sets **`WIKT_TEST_LIVE=1`** and runs `test/network-replay.test.ts` (offline JSON replay always; live `mwFetchJson` block only with that env).
- **`normalizeWiktionaryQueryPage`** in `src/api.ts` supports offline fixtures and replay tests.
- **`test/golden/entry-snapshots.test.ts`** snapshots a stable projection of LEXEME / INFLECTED_FORM output for `basic-verb` and `form-of-inflected` fixtures.
- **`test/decoder-coverage.test.ts`** scans `test/**/*.ts`, `test/**/*.wikitext`, and `test/**/*.json` for evidence that each registry decoder is exercised or explicitly allowlisted.
- **`test/parser.invariants.test.ts`** asserts structural properties of `parseTemplates(..., true)` (raw slices, non-overlap, nesting, bad braces).
- **`derivations`** is exported as an alias of **`derivedTerms`**; spec and README aligned on `{ term, … }[]` style return shape for derived-term items.

---

### Deferred / intentionally partial

#### 1. Library tests: hybrid mocking (Phase 2 not fully unified)

**Status:** Documented, not fully migrated.

**What we did:** `test/library.test.ts` uses **`vi.mock("../src/index")`** with a stub **`wiktionary`** for tests that need **hand-crafted `FetchResult`** objects (e.g. translate gloss mode with NL `schrijven`, empty LEXEME edge cases). A **`beforeEach`** still stubs **`fetchWikitextEnWiktionary`** / **`fetchWikidataEntity`** on **`../src/api`** so any code path that binds to the **real** `wiktionary` inside `library.ts` (e.g. `lemma`) never opens a socket.

**Why it stayed partial:** Several assertions depend on **shapes or gloss strings** that are **not** reproduced by current `test/fixtures/*.wikitext` (e.g. specific translation rows). Moving those tests to “API mock + real `wiktionary()`” would require **new or extended fixtures** or **relaxing assertions** to match fixture-grounded output.

**Done when:** Either (a) every `library.test.ts` case that can use fixtures does so and calls real `wiktionary({ enrich: false })` with API mocks, or (b) the file header and `test/README.md` explicitly list each remaining mock-only case and the reason (fixture gap).

---

#### 2. Decoder coverage allowlist (evidence by exception)

**Status:** Several decoders are listed in **`DECODER_EVIDENCE_ALLOWLIST`** in `test/decoder-coverage.test.ts` instead of being proven by wikitext in the corpus.

**Current intent of the allowlist (non-exhaustive; see source for truth):**

- **Universal / framework:** `store-raw-templates` (matches everything; evidence is implicit once any `{{…}}` exists in corpus).
- **Greek headword templates not yet present in any test string or fixture:** e.g. `el-pron-head`, `el-numeral-head`, `el-participle-head`, `el-adv-head`, `el-art-head` — add minimal `===…===` + `{{el-pron|…}}` (etc.) to a shared fixture or a tiny `test/fixtures/decoder-smoke.wikitext` and register it in integration or golden tests, then **remove** the corresponding allowlist entries.
- **Pronunciation auxiliaries underrepresented in corpus:** `romanization`, `rhymes` — same approach: one line of wikitext per template in a fixture.
- **Section decoders without matching headings in current fixtures:** `alternative-forms`, `see-also`, `anagrams` — add `====Alternative forms====`, `====See also====`, `====Anagrams====` blocks with minimal `{{l|…}}` / list content so the section decoders fire in a deterministic test, then drop from allowlist.

**Done when:** Allowlist only contains decoders that are **truly** universal or **documented** as intentionally untested in v2.0 (with a one-line comment per id).

---

### Possible follow-ups (improvements)

#### 3. Expand golden snapshot coverage

**Idea:** Add golden tests (same pattern as `test/golden/entry-snapshots.test.ts`: mock API, real `wiktionary`, stable projection, Vitest snapshot) for additional fixtures, for example:

- `γράφω.wikitext` — large real page shape, catches regressions in multi-section / translation / conjugation templates.
- `nested-templates.wikitext`, `translations-multi.wikitext`, `nested-pipe-bug.wikitext` — guards parser + translation / nesting edge cases.

**Operational note:** Intentional extraction changes require `npx vitest run test/golden/entry-snapshots.test.ts -u` and a careful review of `.snap` diffs in PRs.

**Done when:** At least one additional fixture is snapshotted and documented in `test/README.md` under goldens.

---

#### 4. Stronger end-to-end library tests (fixture-first)

**Idea:** For each `library.test.ts` case that today only checks wrappers against a fake `FetchResult`, add or reuse a fixture so the pipeline is **wikitext → parse → registry → `FetchResult` → wrapper**, with API layer mocked only.

**Priorities:** `translate` (gloss) with a fixture that actually contains `{{t|…|nl|…}}` rows; `lemma` paths already benefit from API stubs but could be asserted against fixture-derived entries only (no `vi.mocked(wiktionary)`).

**Done when:** A short table in `test/README.md` lists each library wrapper group and whether it is **fixture-backed** or **mock-result-only**, with no silent drift.

---

#### 5. Cross-platform / CI documentation for live tests

**Idea:** `npm run test:network` uses Unix env injection (`WIKT_TEST_LIVE=1`). On **Windows** shells, document equivalents (`set WIKT_TEST_LIVE=1 && npx vitest run …`) or add **`cross-env`** as an optional devDependency and a single cross-platform script.

**Done when:** `test/README.md` includes a “Windows / CI” subsection with copy-paste commands or points to `cross-env` usage.

---

#### 6. CHANGELOG and release notes

**Idea:** When cutting a release that includes the testing overhaul and **`derivations`**, add a **CHANGELOG.md** entry (or extend an existing one) summarizing: new npm scripts, golden/decoder/parser tests, `normalizeWiktionaryQueryPage`, **`derivations` alias**, and default exclusion of perf tests from `npm test`.

**Done when:** CHANGELOG reflects user-visible testing and API surface changes for the release that ships this work.

---

#### 7. Optional: refresh workflow for API recordings

**Idea:** `tools/refresh-api-recording.ts` and `npm run refresh-recording` can overwrite `test/fixtures/api-recordings/minimal-query.json`. Document a **review checklist** (diff size, no secrets, NFC normalization, still minimal) in `test/README.md` or this roadmap.

**Done when:** Contributors have a single place describing when to refresh the JSON and how to validate the offline test still passes.

---

#### 8. Optional: reduce duplication between README compliance and goldens

**Idea:** `readme_examples.test.ts` and golden tests both exercise fixture-backed `wiktionary()`. Long term, consider sharing a small **`test/helper/fixture-fetch.ts`** (load wikitext, build mock `fetchWikitextEnWiktionary` implementation) to avoid divergent mock setups.

**Done when:** At least one helper is extracted and used by two test files without changing behavior.

---

## 💎 Stage 17: High-Fidelity Extraction & Interface Parity (v2.1 — Delivered)

**Goal**: ensure the SDK ecosystem is perfectly synchronized and extracts every "buried" data point from Wiktionary/Wikidata.

- **Data: High-Fidelity "Buried" Data**
    - **Done:** Structured extraction of audio details (multiple files + labels), usage examples (with translation/transcription), internal/external page links, and Wikidata "instance of" (P31) / "subclass of" (P279) types.
- **Infrastructure: Public API Synchronization**
    - **Done:** Achieved 100% parity across `src/library.ts`, `webapp/src/App.tsx`, and `cli/index.ts` for all 35+ convenience wrappers.
- **UI: API Playground Polish**
    - **Done:** Reorganized the playground dropdown into semantic categories (`optgroup`) and implemented a dark-island monospace aesthetic for a professional "terminal-like" experience.
- **Policy: Parity Mandate**
    - **Done:** Added strict synchronization rules to `AGENTS.md` to prevent future parity drift.

## 💎 Stage 19: Buried Data Extraction (v2.2 — Delivered)

**Goal**: surface linguistic data currently ignored or flattened by the SDK, including multi-audio galleries and structured literary citations.

- **Pronunciation: Audio Galleries**
    - **Done:** Captures all dialectal audio files (US, UK, Au) from multiple `{{audio}}` templates into a structured gallery.
- **Senses: Structured Citations**
    - **Done:** Decodes literary metadata (author, year, source, passage) from `{{quote-book}}`, `{{quote-journal}}`, etc.
- **Ontology: Subclass Relationships**
    - **Done:** Extracts Wikidata `subclass_of` (P279) to complement `instance_of` (P31).
- **Interface: Playground & CLI Parity**
    - **Done:** Added `audioGallery()`, `citations()`, and `isSubclass()` to all public interfaces.

## 💎 Stage 20: Premium Rendering & Typographic Standards (v2.2 — Delivered)

**Goal**: transition to a professional-grade, font-neutral rendering engine using specialized Handlebars templates.

- **Infrastructure: Handlebars Templating Engine**
    - **Done:** Integrated `handlebars` for high-fidelity HTML/Markdown output, enabling complex logic and reusable partials.
- **Design: "Gold Standard" Typographic Specimen**
    - **Done:** Implemented `src/templates/entry.html.hbs` and `entry.css` to emulate premium printed academic dictionaries.
- **Architecture: Font-Neutral Snippets**
    - **Done:** Re-engineered the renderer to produce CSS-neutral fragments that inherit typography from their host environment, ensuring seamless embedding.
- **Data: RichEntry Expansion**
    - **Done:** Expanded the aggregate mapping to capture principal parts, structured citations, and usage notes for high-fidelity display.

## 💎 Stage 21: Non-Lemma Morphological Rendering (v2.3.0 — Delivered)

**Goal**: support the rendering of inflected forms with a professional redirect-style layout.

- **Engine: Morphological Resolution**
    - **Done:** Enhanced `richEntry()` to detect inflected variants, extract their specific morphological profiles, and resolve the parent lemma.
- **Templates: Redirect-Style Layout**
    - **Done:** Implemented `is-redirect` logic in HTML/Markdown templates to show the inflected form's analysis followed by the lemma's full record.
- **Design: Academic Typography**
    - **Done:** Added directional arrow (`→`) prefixes and hierarchical styling for grammatical redirects, matching premium printed dictionary standards.

## 💎 Stage 22: Granular Subclasses & Etymological Relations (v2.4.0 — Delivered)

**Goal**: enhance the rendering engine to support specialized typography for variants and complex etymologies.

- **Engine: Granular Subclass Extraction**
    - **Done:** Updated the `form-of` decoder to systematically extract subclasses (misspelling, abbreviation, clipping, diminutive, plural) from template names.
- **Etymology: Granular Relation Symbols**
    - **Done:** Expanded `TEMPLATE_RELATION_MAP` to preserve specific types (affix, compound, alternative) and mapped them to academic symbols (`~`, `←`, `<`) via a new Handlebars helper.
- **Design: Subclass-Specific CSS**
    - **Done:** Implemented CSS selectors for all subclasses, including the "Gold Standard" red wavy underline for misspellings and small-caps for abbreviations.
- **Infrastructure: v2.4.0 Schema Synchronization**
    - **Done:** Formalized the `subclass` field in `types.ts`, the JSON Schema, and the YAML specification.

## 🌍 Stage 18: Multi-lingual Expansion & Schema Consolidation (v2.1 — Delivered)

**Goal**: transition from "Greek-only" to a multi-lingual foundation and formalize high-level API outputs.

- **Languages: Dutch & German (NL/DE)**
    - **Done:** Bootstrapped `nl-noun-head`, `nl-verb-head`, `de-noun-head`, etc. with gender extraction for nominals.
- **Classification: Variant vs. Inflection**
    - **Done:** Refined `EntryType` logic to distinguish between grammatical inflections (`INFLECTED_FORM`) and lexical variants/abbreviations (`FORM_OF`).
- **Schema: High-Fidelity Consolidations**
    - **Done:** Added formal JSON Schema definitions for `RichEntry` and `InflectionTable` to ensure parity with the high-level convenience API.
- **Etymology: Compositional Relations**
    - **Done:** Expanded `TEMPLATE_RELATION_MAP` to handle `affix`, `compound`, `back-formation`, and `clipping`.

---

## 💎 Stage 22: High-Fidelity Extraction & "Purist" Rendering (v2.5.0 — Delivered)

**Goal**: resolve lingering morphology bugs and surface "buried" data via high-fidelity template decoding while decoupling rendering from styling.

- **Data: High-Fidelity "Buried" Data**
    - **Done:** Implemented native decoders for Greek verb/noun templates to extract stems and principal parts directly from parameters.
    - **Done:** Structured extraction of register labels (colloquial, archaic) and alternative forms classification.
- **Rendering: "Purist" Aesthetic**
    - **Done:** Overhauled HTML/CSS snippets to remove font-family, colors, and layout constraints, ensuring perfect embedding as neutral fragments.
- **Architecture: Methodology Pivot**
    - **Done:** Shifted the primary morphological strategy from DOM scraping to source-faithful template decoding (Level 1).

---

## 🔀 Stage 23: Configurable Lexeme Sort & Language Priorities (TBD)

**Goal**: make the `sort: "priority"` language ranking user-configurable and expand the default priority table beyond the current three-language prototype.

- **Configurable Priority Map**
    - Allow callers to supply a custom `Record<string, number>` mapping language codes to priority values, overriding or extending the built-in defaults.
    - Support configuration via both the TypeScript API (`sort: { strategy: "priority", priorities: { ... } }`) and a CLI flag (`--sort-priority --lang-priorities el=1,grc=2,...`).
- **Expanded Default Priorities**
    - Research Wiktionary usage statistics to establish a sensible default priority ranking for the top 20–30 languages.
    - Consider ISO 639-3 macro-language groupings (e.g. treating all Greek varieties as a cluster).
- **Secondary Sort Keys**
    - Within the same language, allow sorting by `etymology_index` (ascending) and then by PoS heading.
    - Expose an option for custom secondary comparators for domain-specific consumers.
- **CLI & Webapp Integration**
    - Add `--sort source|priority` flag to the CLI (`cli/index.ts`).
    - Surface a sort toggle in the webapp Playground UI.
- **Documentation & Schema**
    - Update the spec, README, and JSON Schema to reflect any extended configuration surface.

---

## 📖 Stage 24: Lexicographic Standard Output Formats (TBD)

**Goal**: add Handlebars templates and/or serializers for established lexicographic data interchange formats and semantically rigorous HTML, so the SDK can produce output consumable by academic tools, NLP pipelines, digital humanities corpora, and linked-data platforms.

### Context

The SDK's `format()` function already supports multiple output modes (`text`,
`markdown`, `html`, `ansi`, `terminal-html`) via registered styles. The HTML
output uses a Handlebars template (`entry.html.hbs`) that prioritizes
typographic density and print-dictionary aesthetics. However, none of the
current formats conform to established lexicographic data standards used in
academia and the language-technology ecosystem. Adding these would
dramatically broaden the SDK's utility as a "Layer 1" data source.

### Deliverables

#### 1. Semantic HTML5 ("purist" rendition)

A Handlebars template producing semantically correct HTML Living Standard
markup for a single dictionary entry, using the most appropriate native
elements:

- `<article lang="…">` as the entry wrapper (with BCP-47 `lang` attribute).
- `<header>` containing the headword in `<h1>` (or `<h2>` for embedding)
  and PoS/morphology metadata in a `<dl>` (definition list).
- `<abbr title="…">` for genuine abbreviations (e.g., *n.*, *v.*, *adj.*,
  *masc.*, *fem.*), not for full words that happen to be labels.
- `<dl>` / `<dt>` / `<dd>` for the senses list — the HTML-native fit for
  term–definition pairs, with sense numbers and register labels in `<dt>`.
- `<ol>` for numbered subsenses, `<blockquote>` for usage examples and
  literary citations (with `<cite>` for attributed sources).
- `<aside>` for etymology, pronunciation, and "See also" sections.
- `<ruby>` for romanization/transliteration annotation where appropriate.
- Microdata or `data-*` attributes carrying machine-readable fields
  (`data-pos`, `data-lang`, `data-sense-id`) for downstream JS consumers.
- ARIA roles where beneficial (e.g., `role="definition"` on `<dd>`).

**Rationale:** A semantically correct HTML fragment is maximally accessible,
indexable by search engines, and style-agnostic. It can be embedded in any
web context and styled entirely by the host's CSS.

**Implementation:** New Handlebars template `entry.semantic-html.hbs` +
a registered `FormatterStyle` named `"semantic-html"`.

#### 2. TEI Lex-0 (Text Encoding Initiative — Lexicographic subset)

TEI is the dominant XML standard in digital humanities for encoding texts.
**TEI Lex-0** is a constrained profile of TEI P5 specifically designed for
machine-readable dictionaries. It is the format used by major digitisation
projects (DARIAH, ELEXIS, Lexical Computing).

Key elements to map:

| SDK field | TEI Lex-0 element |
|-----------|-------------------|
| Entry / headword | `<entry>` with `<form type="lemma"><orth>γράφω</orth></form>` |
| Part of speech | `<gramGrp><gram type="pos">verb</gram></gramGrp>` |
| Pronunciation (IPA) | `<form type="lemma"><pron notation="IPA">/ˈɣra.fo/</pron></form>` |
| Sense / gloss | `<sense n="1"><def>to write, pen</def></sense>` |
| Usage example | `<cit type="example"><quote>…</quote><cit type="translation"><quote>…</quote></cit></cit>` |
| Etymology | `<etym><mentioned xml:lang="grc">γράφω</mentioned></etym>` |
| Semantic relations | `<xr type="synonymy"><ref target="…">σημειώνω</ref></xr>` |
| Translations | `<cit type="translation" xml:lang="nl"><quote>schrijven</quote></cit>` |

**Rationale:** TEI Lex-0 is the _de facto_ standard for interoperability
between dictionary projects in the European research infrastructure. Adding
this format lets the SDK feed into CLARIN, DARIAH-EU, and Sketch Engine
pipelines directly.

**Implementation:** New Handlebars template `entry.tei.hbs` producing a TEI
`<entry>` XML fragment (not a full `<TEI>` document — consumers wrap it).
Registered as `FormatterStyle` named `"tei"`.

**Reference:** [TEI Lex-0 specification](https://dariah-eric.github.io/lexicalresources/pages/TEILex0/TEILex0.html)

#### 3. OntoLex-Lemon (JSON-LD / RDF)

OntoLex-Lemon is the W3C community standard for representing lexical
resources as Linked Data. It is the format used by Wikidata Lexemes,
DBnary, and BabelNet.

Key mappings:

| SDK field | OntoLex-Lemon class/property |
|-----------|------------------------------|
| Lexeme (entry) | `ontolex:LexicalEntry` |
| Headword / lemma | `ontolex:canonicalForm` → `ontolex:Form` with `ontolex:writtenRep` |
| Part of speech | `lexinfo:partOfSpeech` (using LexInfo vocabulary URIs) |
| Sense | `ontolex:LexicalSense` with `skos:definition` |
| Translation | `vartrans:Translation` linking two `ontolex:LexicalEntry` instances |
| Etymology | `lexinfo:etymology` (or custom `wikt:etymologicalLink`) |
| Synonym/Antonym | `vartrans:lexicalRel` with `lexinfo:synonym` / `lexinfo:antonym` |

Output would be a JSON-LD `@graph` array conforming to the OntoLex module
ontology, with `@context` referencing `ontolex:`, `lexinfo:`, `vartrans:`,
and `skos:` namespaces.

**Rationale:** JSON-LD is the most web-developer-friendly RDF serialization.
Producing OntoLex output lets the SDK interoperate with the Linguistic
Linked Open Data cloud, SPARQL endpoints, and knowledge-graph platforms.

**Implementation:** A serializer function (not Handlebars — JSON-LD is
better produced programmatically) registered as `FormatterStyle` named
`"jsonld"` or `"ontolex"`.

**Reference:** [OntoLex-Lemon](https://www.w3.org/2016/05/ontolex/),
[LexInfo](https://lexinfo.net/)

#### 4. LMF (Lexical Markup Framework — ISO 24613)

LMF is the ISO standard for the representation of computational lexicons.
It provides a meta-model for NLP lexicons (morphological analysers,
machine translation dictionaries, etc.). LMF XML is used by tools like
GATE, FreeLing, and Apertium.

Core structure: `<LexicalResource>` → `<Lexicon>` → `<LexicalEntry>` →
`<Lemma>`, `<Sense>`, `<WordForm>`.

**Rationale:** LMF bridges the gap between human-readable dictionaries and
NLP-consumable lexicons. For users who want to feed Wiktionary data into
computational morphology pipelines, LMF is the expected interchange format.

**Implementation:** XML serializer registered as `FormatterStyle` named
`"lmf"`. May share structural logic with the TEI serializer.

**Reference:** [ISO 24613:2008](https://www.iso.org/standard/37327.html)

#### 5. XDXF (XML Dictionary Exchange Format)

XDXF is a lightweight XML format for bilingual/multilingual dictionaries,
used by StarDict, GoldenDict, and other desktop dictionary applications.

**Rationale:** XDXF export would allow the SDK's output to be imported
directly into popular desktop dictionary readers, making Wiktionary data
available offline in GoldenDict/StarDict format.

**Implementation:** XML serializer or Handlebars template, registered as
`FormatterStyle` named `"xdxf"`.

### Architecture notes

- **Fragment-first:** All formats should produce entry-level fragments, not
  full documents. Consumers wrap fragments into `<TEI>` documents, JSON-LD
  `@graph` arrays, or LMF `<LexicalResource>` containers as needed.
- **Round-trip fidelity:** Every field in the output must be traceable back
  to a `Lexeme` field. No data is synthesized or inferred.
- **Environment agnosticism:** Templates and serializers must be bundled as
  TypeScript strings (per `AGENTS.md` §5) so they work in both Node and
  browser contexts.
- **Priority order:** Semantic HTML5 and TEI Lex-0 are highest priority
  (broadest user base). OntoLex-Lemon is medium priority (Linked Data
  community). LMF and XDXF are lower priority (specialised NLP / desktop
  dictionary use cases).

---

## 🚀 Stage 25: Recursive Resolution & Paradigm Expansion (TBD)

**Goal**: expand the depth of alternative forms and automate full paradigm reconstruction.

- **Recursion**: implement recursive resolution for "Alternative forms" to fetch the variant's full lexeme.
- **Paradigms**: research the feasibility of reconstructing full 5×6 tables from template-extracted stems without API fallbacks.
- **MetaLang**: finalize the mapping of Wiktionary translations to MetaLang concept IDs.
