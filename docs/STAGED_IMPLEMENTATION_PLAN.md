# Staged implementation plan (audit + merged roadmap + docs)

**Status:** planning document — not normative; does not replace `docs/wiktionary-sdk-spec.md` or `AGENTS.md`.  
**Canonical narrative:** This file is the **single** post‑v1.0 plan: historical stages, testing deferrals, audit-aligned engineering phases, and future Stages 23–25.

**Sources:** `audit.md`, `docs/wiktionary-sdk-spec.md` §15, `docs/query-result-dimensional-matrix.md`, `docs/form-of-display-and-mediawiki-parse.md`, `docs/TEXT_TO_DICTIONARY_PLAN.md`, `docs/wiktionary_morphology_engine.md`, `test/README.md`.

**Principles (non-negotiable)**

- **Extraction, not inference:** only extract what is explicitly present in Wikitext/template parameters.
- **Traceability:** every structured field must be traceable to a source template, line, or section.
- **Registry-first:** mapping/decoding logic lives in `src/registry.ts` (and split modules when introduced), not in the parser or orchestration layer.
- **Cross-interface parity** (library / CLI / webapp / server where applicable); offline-first `npm test`; schema + templates parity on structural changes (`AGENTS.md`).

---

## How to use this plan

- Work **one phase at a time**; merge each phase behind green CI (`npm test`, `npm run build`, webapp `npm run build` when touched).
- Prefer **small PRs** within a phase; each PR should have a clear rollback (revert commit).
- After any behaviour-visible change, update **spec / schema / goldens** as required by `AGENTS.md`.
- Treat **Stages 23–25** and **T2D** as **product roadmap**; treat **Phases 0–7** as **engineering hardening and structural health**.

---

# Part I — Historical roadmap (delivered)

The following summarizes **delivered** work from the project roadmap history, in roughly **chronological / version order** (some older roadmap drafts ordered sections thematically, not temporally).

## Stage 14: v2.0 final release and reliability (delivered)

**Goal:** Resolve infrastructure bottlenecks and ensure parity with the comprehensive schema proposal.

- **Test suite (largely delivered):** `enrichment.test.ts`, `auto.test.ts`, `stem.test.ts`, `library.test.ts` stub `src/api` so default `npm test` avoids live HTTP; perf split (`test:perf` / `test:all`); golden snapshots, decoder-coverage guard, parser invariants, offline API replay, `test/README.md`.
- **Remaining from Stage 14** (carried into [Testing suite: deferred work and follow-ups](#testing-suite-deferred-work-and-follow-ups) and Phase 4 / Phase 7 below): consolidation of hybrid mocks in `library.test.ts`, shrinking decoder allowlists, optional items in the testing section.
- **Registry refinements:** subsense labeling (register/domain) for indentation levels; expand `TAG_LABEL_MAP` for common morphological tags.
- **QA:** full unit test audit vs v2-final spec; cross-verify `γράφω` / `έγραψε` in playground for field population.

## Stage 15: Deep enrichment and multi-language robustness (delivered)

**Goal:** Expand beyond Greek-heavy focus; refine linguistic metadata structure.

- Sense qualifiers (register/usage) → `qualifier`; etymology `raw_text` across language sections; `LANG_PRIORITY` and mapping for Dutch, German, French, Russian; audio file-to-URL beyond Greek-specific templates.

## Stage 16: Advanced integrations and playground overhaul (delivered)

**Goal:** External data research and legacy mappings; playground improvements.

- Wiktionary RDF/SPARQL research; Dutch–Russian and Greek–Dutch legacy mappings (`docs/AI agents chat history/`); playground **Schema Inspector**.

## Stage 17: High-fidelity extraction and interface parity (v2.1 — delivered)

**Goal:** Synchronize ecosystem; extract “buried” Wikitext/Wikidata data.

- Audio details, usage examples (translation/transcription), internal/external links, Wikidata P31 / P279; **100% parity** across `library.ts`, `webapp/App.tsx`, `cli` for 35+ wrappers; playground dropdown `optgroup` and dark monospace aesthetic; **AGENTS.md** parity mandate.

## Stage 18: Multi-lingual expansion and schema consolidation (v2.1 — delivered)

**Goal:** NL/DE foundation; formal high-level API outputs.

- `nl-noun-head`, `nl-verb-head`, `de-noun-head`, etc. with gender; `EntryType` **INFLECTED_FORM** vs **FORM_OF**; JSON Schema for `RichEntry` / `InflectionTable`; etymology `TEMPLATE_RELATION_MAP` (affix, compound, back-formation, clipping).

## Stage 19: Buried data extraction (v2.2 — delivered)

- Pronunciation audio galleries (multi-`{{audio}}`); structured citations (`{{quote-book}}`, etc.); Wikidata `subclass_of` (P279); playground & CLI: `audioGallery()`, `citations()`, `isSubclass()`.

## Stage 20: Premium rendering and typographic standards (v2.2 — delivered)

- Handlebars for HTML/Markdown; `entry.html.hbs` + `entry.css` academic specimen; font-neutral CSS fragments; `richEntry()` mapping for principal parts, citations, usage notes.

## Stage 21: Non-lemma morphological rendering (v2.3.0 — delivered)

- `richEntry()` inflected variants, morph profiles, parent lemma; redirect-style HTML/Markdown; `→` typography and hierarchy.

## Stage 22 (v2.4.0): Granular subclasses and etymological relations (delivered)

- `form-of` decoder subclasses (misspelling, abbreviation, clipping, diminutive, plural); `TEMPLATE_RELATION_MAP` + Handlebars `etymSymbol`; subclass CSS (e.g. misspelling underline); `subclass` in `types.ts`, JSON Schema, YAML.

## Stage 22 / v2.5.0: High-fidelity extraction and “purist” rendering (delivered)

_Note: Original roadmap used a second “Stage 22” heading for v2.5.0._

- Greek verb/noun template decoders (stems, principal parts); register labels and alternative-forms classification; HTML/CSS purist pass (no font-family/colors/layout constraints); morphological strategy: template decoding (Level 1) over DOM scraping.

---

# Part II — Testing suite: deferred work and follow-ups

This section records **intentionally partial** choices, **deferred** work, and **optional improvements** from the testing hardening pass. Ground rules and scripts: [`test/README.md`](../test/README.md); agent context: [`AGENTS.md`](../AGENTS.md).

## Context (what already shipped)

- Default **`npm test`** excludes `test/bench.test.ts`; **`npm run test:perf`** runs wall-clock parser checks (with **`PERF_SLACK`** when `CI` is set).
- **`npm run test:all`** runs full unit/integration then perf.
- **`npm run test:network`** sets **`WIKT_TEST_LIVE=1`** and runs `test/network-replay.test.ts` (offline JSON replay always; live `mwFetchJson` only with that env).
- **`normalizeWiktionaryQueryPage`** in `src/api.ts` supports offline fixtures and replay tests.
- **`test/golden/entry-snapshots.test.ts`** snapshots a stable projection for `basic-verb` and `form-of-inflected` fixtures.
- **`test/decoder-coverage.test.ts`** scans `test/**/*.ts`, `test/**/*.wikitext`, `test/**/*.json` for decoder evidence or allowlist.
- **`test/parser.invariants.test.ts`** asserts `parseTemplates(..., true)` structural properties.
- **`derivations`** is an alias of **`derivedTerms`**; spec/README aligned on `{ term, … }[]` for derived-term items.

## Deferred / intentionally partial

### 1. Library tests: hybrid mocking (Phase 2 not fully unified)

**Status:** Documented, not fully migrated.

**What we did:** `test/library.test.ts` uses **`vi.mock("../src/index")`** with stub **`wiktionary`** for tests needing hand-crafted **`FetchResult`** (e.g. translate gloss with NL `schrijven`, empty LEXEME edge cases). **`beforeEach`** still stubs **`fetchWikitextEnWiktionary`** / **`fetchWikidataEntity`** on **`../src/api`** so paths binding real `wiktionary` inside `library.ts` (e.g. `lemma`) never open a socket.

**Why partial:** Some assertions depend on shapes or gloss strings **not** reproduced by current `test/fixtures/*.wikitext` (e.g. specific translation rows). Fixture-backed `wiktionary()` would need **new/extended fixtures** or **relaxed assertions**.

**Done when:** Either (a) every case that can use fixtures does, with API mocks + real `wiktionary({ enrich: false })`, or (b) file header and `test/README.md` list each remaining mock-only case and reason.

### 2. Decoder coverage allowlist (evidence by exception)

**Status:** Several decoders live in **`DECODER_EVIDENCE_ALLOWLIST`** in `test/decoder-coverage.test.ts` without wikitext corpus proof.

**Intent (non-exhaustive; source is the test file):**

- **Universal / framework:** `store-raw-templates` (implicit once any `{{…}}` exists).
- **Greek headword templates missing from fixtures:** e.g. `el-pron-head`, `el-numeral-head`, `el-participle-head`, `el-adv-head`, `el-art-head` — add minimal sections + templates to shared fixture or `test/fixtures/decoder-smoke.wikitext`, register in integration/golden tests, **remove** allowlist entries.
- **Pronunciation auxiliaries:** `romanization`, `rhymes` — one line of wikitext per template in a fixture.
- **Section decoders:** `alternative-forms`, `see-also`, `anagrams` — add `====Alternative forms====`, `====See also====`, `====Anagrams====` with minimal `{{l|…}}` / lists.

**Done when:** Allowlist only **truly universal** or **documented** intentionally untested decoders (one-line comment per id).

### Possible follow-ups (improvements)

#### 3. Expand golden snapshot coverage

Add goldens (same pattern as `entry-snapshots.test.ts`: mock API, real `wiktionary`, stable projection, Vitest snapshot) for e.g. `γράφω.wikitext`, `nested-templates.wikitext`, `translations-multi.wikitext`, `nested-pipe-bug.wikitext`. Intentional extraction changes: `npx vitest run test/golden/entry-snapshots.test.ts -u` and review `.snap` diffs.

**Done when:** At least one additional fixture is snapshotted and documented in `test/README.md` under goldens.

#### 4. Stronger end-to-end library tests (fixture-first)

For each `library.test.ts` case that only checks wrappers against a fake `FetchResult`, add/reuse a fixture so pipeline is **wikitext → parse → registry → FetchResult → wrapper**, API mocked only. Priorities: `translate` (gloss) with `{{t|…|nl|…}}`; `lemma` paths asserted on fixture-derived entries only.

**Done when:** `test/README.md` table lists each wrapper group as **fixture-backed** or **mock-result-only**, with no silent drift.

#### 5. Cross-platform / CI documentation for live tests

`npm run test:network` uses Unix env injection (`WIKT_TEST_LIVE=1`). On **Windows**, document `set WIKT_TEST_LIVE=1 && …` or add **`cross-env`** and a cross-platform script.

**Done when:** `test/README.md` has a “Windows / CI” subsection with copy-paste or `cross-env` usage.

#### 6. CHANGELOG and release notes

When cutting releases that include testing overhaul / **`derivations`**, add **CHANGELOG.md** summarizing npm scripts, golden/decoder/parser tests, `normalizeWiktionaryQueryPage`, **`derivations` alias**, perf exclusion from default `npm test`.

**Done when:** CHANGELOG reflects user-visible testing and API changes for that release.

#### 7. Optional: refresh workflow for API recordings

`tools/refresh-api-recording.ts` / `npm run refresh-recording` can overwrite `test/fixtures/api-recordings/minimal-query.json`. Document review checklist (diff size, no secrets, NFC, still minimal) in `test/README.md` or here.

**Done when:** Single place describes when/how to refresh and validate offline tests.

#### 8. Optional: reduce duplication between README compliance and goldens

Consider **`test/helper/fixture-fetch.ts`** (load wikitext, build mock `fetchWikitextEnWiktionary`) shared by `readme_examples.test.ts` and goldens.

**Done when:** At least one helper used by two test files without behaviour change.

---

# Part III — Staged engineering phases (audit-aligned)

Phases **0–7** are **structural and operational hardening** (from `audit.md` and spec §15). They complement Part II (testing debt) and precede Part IV (Stages 23–25).

## Phase 0 — Baseline, hygiene, and unblockers

**Goal:** Clean tree, reproducible builds, and no “hidden” failures before larger refactors.

| Step | Work | Verification |
|------|------|--------------|
| 0.1 | Fix **strict TypeScript** issues that break **webapp** `tsc -b` (e.g. unused locals in `src/formatter.ts`, `src/registry.ts` if still present). | `cd webapp && npm run build` |
| 0.2 | Add a short **version matrix** to README: npm package version vs `SCHEMA_VERSION` vs spec revision (per audit §2.2). | Doc-only review |
| 0.3 | Relocate or document **root `verify_v2.ts`** under `tools/` or README “manual checks” (audit §8). | No runtime change |
| 0.4 | Confirm **audit §7.1** (`debug` padding) and **§6.1** (cache JSON parse) fixes remain covered by tests; extend if gaps found. | `npm test` |

**Dependencies:** None. **Risk:** Low.

## Phase 1 — Operational safety (network, cache, rate limiting, concurrency)

**Goal:** Bounded failure modes for CLI, server, and browser without changing extraction semantics.

| Step | Work | Notes |
|------|------|--------|
| 1.1 | **`mwFetchJson`:** optional `timeoutMs` and/or `signal: AbortSignal`; default conservative timeout for Node/server; document browser vs Node defaults (audit §5.1). | Unit tests with mocked `fetch` + abort (audit §13.2). |
| 1.2 | **Rate limiter:** document **`proxyUrl`** as unsupported *or* implement minimal proxy for Node `fetch` (audit §5.2). | Avoid silent misconfiguration. |
| 1.3 | **Rate limiter queue:** optional `maxQueue` or back-pressure; clear error when exceeded. | Default preserves unbounded if unset. |
| 1.4 | **Lemma batch / form-of parse batch:** shared **`parallelMap(items, limit, fn)`**; default `Infinity` (audit §5.3–5.4, §12 item 6). | Goldens unchanged. |
| 1.5 | **TieredCache L1:** optional **max entries** or LRU via `configureCache` (audit §6.1). | Opt-in. |

**Dependencies:** Phase 0. **Risk:** Medium if defaults change — prefer opt-in first.

## Phase 2 — Public API honesty and interface parity

**Goal:** Types, REST, and CLI reflect real behaviour.

| Step | Work | Notes |
|------|------|--------|
| 2.1 | **`library.ts` return types:** **`Promise<GroupedLexemeResults<T>>`** on `mapLexemes` wrappers (audit §7.3, spec §12.26). | Possible semver minor for consumers. |
| 2.2 | **`server.ts` / `buildApiFetchResponse`:** **`matchMode`, `sort`, `debugDecoders`**, **`pos` vs `preferredPos`** (spec §11.1 / §15 item 2). | `server-fetch-audit` + spec §11.1. |
| 2.3 | **Centralize defaults** in `src/constants.ts`: `LANG_PRIORITY`, default `lang`, cache TTL, rate-limit interval (audit §12, §8). | |
| 2.4 | **Optional:** **`wikidata_error`** in JSON Schema (spec §15 item 7). | Schema + YAML docs. |

**Dependencies:** Phase 0–1 optional. **Risk:** Medium.

## Phase 3 — Module graph and layering (core)

**Goal:** Remove fragile cycles; clarify engine vs barrel (audit §4, §12).

| Step | Work | Notes |
|------|------|--------|
| 3.1 | **`src/wiktionary-core.ts`:** `wiktionary`, `wiktionaryRecursive`; no re-export of `library` / full `formatter`. | `library.ts`, `morphology.ts`, `stem.ts` import core, not `index.ts`. |
| 3.2 | **`src/index.ts`** as **public barrel** only. | Same import paths for consumers. |
| 3.3 | **`src/form-of-display.ts`:** shared helpers for formatter + `form-of-parse-enrich` (audit §3.2). | No output change. |
| 3.4 | **`EtymologyStep`:** move to **`types.ts`** (or `types-etymology.ts`). | Type-only. |

**Dependencies:** Phases 0–2 desirable. **Risk:** High (load order / mocks).

## Phase 4 — Registry decomposition (incremental, order-preserving)

**Goal:** Smaller `registry.ts`; **identical** registration order (`AGENTS.md`).

| Step | Work | Notes |
|------|------|--------|
| 4.1 | Inventory decoders by family. | Map to spec §5 / §14.1. |
| 4.2 | Extract pure helpers into `src/registry/`; transitional re-exports from `registry.ts`. | |
| 4.3 | Per-family `register` blocks + **`registerAllDecoders()`** in historical order. | `registry-ids.test.ts`, decoder coverage, goldens. |
| 4.4 | **Stage 14 follow-up:** shrink **`DECODER_EVIDENCE_ALLOWLIST`** via `decoder-smoke.wikitext` / fixtures ([§2 above](#2-decoder-coverage-allowlist-evidence-by-exception)). | Small PRs. |

**Dependencies:** Phase 3.3 helps. **Risk:** High — never reorder registrations casually.

## Phase 5 — Library, morphology, and cross-cutting extraction

**Goal:** Convenience API vs engine; non-Greek morphology hooks (spec §14.5, §15 item 8).

| Step | Work | Notes |
|------|------|--------|
| 5.1 | Split or document **`library.ts`** modules (projection vs async wrappers) (audit §3.2). | Preserve `index.ts` exports. |
| 5.2 | **`getNativeSenses`:** rename log tag; optional **`onError`** (audit §8–9). | |
| 5.3 | **`morphology.ts`:** thread **`title`** into `action=parse`; non-`el` template prefixes behind explicit opts. | New fixtures per language. |
| 5.4 | Document **`extractMorphologyFromLexeme`** smart defaults as wrapper-only (audit §7.4). | Spec/README + JSDoc. |

**Dependencies:** Phase 3.1. **Risk:** Medium.

## Phase 6 — Webapp UX, polish, and inspector accuracy

**Goal:** URL/history behaviour; errors; debugger vs engine (audit §7.5–7.6, §11).

| Step | Work | Notes |
|------|------|--------|
| 6.1 | **Popstate:** (A) refetch when `q` changes, or (B) banner “results are for previous search” (audit §7.5, §13.12). | Spec / query-matrix. |
| 6.2 | **`PlainLexemeHtmlBlock`:** visible **format error** (audit §7.6). | |
| 6.3 | **Compare mode:** tooltip for **`enrich: false`** (audit §11). | |
| 6.4 | **Debug column:** prefer **`FetchResult.debug`** / `DecoderDebugEvent` (audit §11). | |
| 6.5 | Thin **`App.tsx`** into hooks/components (audit §3.3). | No behaviour change per PR. |

**Risk:** Low.

## Phase 7 — Testing, CI, and documentation debt (maps to Part II)

**Goal:** Close [Testing suite: deferred work and follow-ups](#part-ii--testing-suite-deferred-work-and-follow-ups) and audit §13.

| Step | Work | Maps to |
|------|------|--------|
| 7.1 | Library tests: fixture-backed `wiktionary()` where possible; document mock-only cases. | [§1](#1-library-tests-hybrid-mocking-phase-2-not-fully-unified) |
| 7.2 | New golden fixture + doc. | [§3](#3-expand-golden-snapshot-coverage) |
| 7.3 | Shared **`fixture-fetch`** helper. | [§8](#8-optional-reduce-duplication-between-readme-compliance-and-goldens) |
| 7.4 | Windows / **`cross-env`** for `test:network`. | [§5](#5-cross-platform--ci-documentation-for-live-tests) |
| 7.5 | **CHANGELOG** discipline. | [§6](#6-changelog-and-release-notes) |
| 7.6 | API recording refresh checklist. | [§7](#7-optional-refresh-workflow-for-api-recordings) |
| 7.7 | Audit §13 gaps; optional CI **types ↔ schema** sync script (audit §13.14). | |
| 7.8 | Update **`docs/query-result-dimensional-matrix.md`** §11 when adding axes. | |

**Dependencies:** Can parallelize with Phases 1–2. **Risk:** Low.

---

# Part IV — Future product roadmap (Stages 23–25)

## Phase 8 — Stage 23: Configurable lexeme sort and language priorities (TBD)

**Goal:** Make `sort: "priority"` **user-configurable** and expand default priority beyond the current prototype.

**Deliverables (from roadmap):**

- **Configurable priority map:** callers supply `Record<string, number>` overriding/extending built-ins — TypeScript API e.g. `sort: { strategy: "priority", priorities: { … } }` and CLI e.g. `--sort-priority` / `--lang-priorities el=1,grc=2,…`.
- **Expanded default priorities:** research Wiktionary usage for top 20–30 languages; consider ISO 639-3 macro-language clusters (e.g. Greek varieties).
- **Secondary sort keys:** within same language, sort by `etymology_index` (asc) then PoS heading; optional custom secondary comparators for domain consumers.
- **CLI & webapp:** `--sort source|priority` in `cli/index.ts`; sort toggle in playground.
- **Documentation & schema:** spec, README, JSON Schema for extended configuration.

**Staged implementation order (engineering):**

1. Design **API shape** — update spec §1 / §12.28.
2. Implement comparator in **`wiktionary-core`** (post–Phase 3); wire defaults from Phase 2.3.
3. Secondary keys as above.
4. CLI + webapp.
5. Matrix-style tests for multi-language pages.

**Dependencies:** Phases 2–3. **Risk:** Medium (API design).

## Phase 9 — Stage 24: Lexicographic standard output formats (TBD)

**Goal:** Handlebars templates and/or serializers for interchange formats and semantically rigorous HTML — **Layer 1** consumable by academic tools, NLP, DH, linked data.

### Context

`format()` already supports `text`, `markdown`, `html`, `ansi`, `terminal-html` via registered styles (`entry.html.hbs` emphasizes typographic density). None conform to **established lexicographic standards**; adding them broadens SDK utility.

### Deliverable 1 — Semantic HTML5 (“purist” rendition)

Handlebars template with appropriate elements:

- `<article lang="…">` wrapper (BCP-47).
- `<header>`: headword in `<h1>` / `<h2>` for embed; PoS/morph in `<dl>`.
- `<abbr title="…">` for real abbreviations (*n.*, *v.*, *masc.*), not arbitrary labels.
- `<dl>` / `<dt>` / `<dd>` for senses; `<ol>` subsenses; `<blockquote>` examples/citations with `<cite>`.
- `<aside>` for etymology, pronunciation, see-also.
- `<ruby>` for romanization where appropriate.
- Microdata or `data-*` (`data-pos`, `data-lang`, `data-sense-id`); ARIA e.g. `role="definition"` on `<dd>`.

**Implementation:** `entry.semantic-html.hbs` + `FormatterStyle` **`semantic-html`**.

### Deliverable 2 — TEI Lex-0

Constrained TEI P5 profile for machine-readable dictionaries (DARIAH, ELEXIS, Lexical Computing).

| SDK field | TEI Lex-0 |
|-----------|-----------|
| Entry / headword | `<entry>`, `<form type="lemma"><orth>…</orth></form>` |
| PoS | `<gramGrp><gram type="pos">…</gram></gramGrp>` |
| IPA | `<form type="lemma"><pron notation="IPA">…</pron></form>` |
| Sense | `<sense n="1"><def>…</def></sense>` |
| Example | `<cit type="example"><quote>…</quote><cit type="translation"><quote>…</quote></cit></cit>` |
| Etymology | `<etym><mentioned xml:lang="…">…</mentioned></etym>` |
| Relations | `<xr type="synonymy"><ref target="…">…</ref></xr>` |
| Translations | `<cit type="translation" xml:lang="…"><quote>…</quote></cit>` |

**Implementation:** `entry.tei.hbs` → TEI `<entry>` **fragment** (not full `<TEI>`); `FormatterStyle` **`tei`**.

**Reference:** [TEI Lex-0](https://dariah-eric.github.io/lexicalresources/pages/TEILex0/TEILex0.html)

### Deliverable 3 — OntoLex-Lemon (JSON-LD / RDF)

W3C community standard; used by Wikidata Lexemes, DBnary, BabelNet.

| SDK field | OntoLex-Lemon |
|-----------|----------------|
| Lexeme | `ontolex:LexicalEntry` |
| Lemma | `ontolex:canonicalForm` → `ontolex:Form` / `ontolex:writtenRep` |
| PoS | `lexinfo:partOfSpeech` |
| Sense | `ontolex:LexicalSense` / `skos:definition` |
| Translation | `vartrans:Translation` |
| Etymology | `lexinfo:etymology` or custom predicate |
| Syn/ant | `vartrans:lexicalRel` + `lexinfo:synonym` / `antonym` |

**Implementation:** Programmatic JSON-LD `@graph`; `FormatterStyle` **`jsonld`** or **`ontolex`**.

**References:** [OntoLex-Lemon](https://www.w3.org/2016/05/ontolex/), [LexInfo](https://lexinfo.net/)

### Deliverable 4 — LMF (ISO 24613)

`<LexicalResource>` → `<Lexicon>` → `<LexicalEntry>` → `<Lemma>`, `<Sense>`, `<WordForm>` — NLP lexicons (GATE, FreeLing, Apertium).

**Implementation:** XML serializer, `FormatterStyle` **`lmf`**. May share logic with TEI.

**Reference:** [ISO 24613:2008](https://www.iso.org/standard/37327.html)

### Deliverable 5 — XDXF

Lightweight XML for bilingual/multilingual dicts; StarDict, GoldenDict.

**Implementation:** XML serializer or Handlebars, `FormatterStyle` **`xdxf`**.

### Architecture notes (Stage 24)

- **Fragment-first:** entry-level fragments; consumers wrap in `<TEI>`, LMF container, etc.
- **Round-trip fidelity:** every output field traceable to `Lexeme`; no synthesis beyond extraction rules.
- **Environment agnosticism:** bundle as TS strings (`AGENTS.md` §5).
- **Priority order:** Semantic HTML5 and TEI Lex-0 **highest**; OntoLex-Lemon **medium**; LMF and XDXF **lower**.

**Engineering cadence:** One format per release where possible; update spec §12.10 / distribution table; goldens or snapshots for stable XML/JSON fragments.

**Dependencies:** Phase 4 optional. **Risk:** High surface area.

## Phase 10 — Stage 25 and long-horizon initiatives (TBD)

### Stage 25 (roadmap): Recursive resolution and paradigm expansion

- **Recursion:** recursive resolution for **Alternative forms** to fetch the variant’s full lexeme.
- **Paradigms:** research reconstructing full 5×6 tables from template-extracted stems **without** API fallbacks.
- **MetaLang:** finalize mapping of Wiktionary translations to MetaLang concept IDs.

### Other long-horizon (spec §15, T2D)

| Initiative | Scope | Notes |
|------------|--------|--------|
| **Non–en.wiktionary** | Site parameter, normalizers, template families | Spec §15 item 3 |
| **Persistent L2/L3 cache** | SQLite / IndexedDB / Redis | Spec §15 item 5; `revision_id` invalidation docs |
| **T2D Layer 2** | Sense disambiguation, token→lemma, vector store | `TEXT_TO_DICTIONARY_PLAN.md`; separate consumer layer |
| **Wikidata SPARQL** | Hybrid extraction research (Stage 16) | Not core SDK path until product need is clear |

---

# Part V — Chronological execution summary

1. **Part II** (testing deferrals) can run in parallel with **Phases 0–2** where it does not block refactors.  
2. **Phase 0** — builds green, docs clarity.  
3. **Phase 1** — timeouts, queue/cache bounds, optional concurrency.  
4. **Phase 2** — types, server parity, constants.  
5. **Phase 3** — `wiktionary-core`, `form-of-display`, type moves.  
6. **Phase 4** — registry split.  
7. **Phase 5** — library/morphology.  
8. **Phase 6** — webapp UX.  
9. **Phase 7** — close Part II items + audit §13.  
10. **Phase 8** — Stage 23.  
11. **Phase 9** — Stage 24.  
12. **Phase 10** — Stage 25, multi-wiki, cache backends, T2D.

---

# Exit criteria (hardening track)

- No **undocumented** module cycles; `library` / `stem` / `morphology` do not import the public barrel for core fetch.
- Convenience wrappers typed **`GroupedLexemeResults`** where applicable.
- **Server** query params match documented CLI parity for `matchMode`, `sort`, `debugDecoders`, `pos` vs `preferredPos`.
- **`mwFetchJson`** supports **bounded** wait time in server/CLI contexts.
- **Registry** split with **frozen** registration order contract tests.
- **Part II** deferred items **done** or **explicitly listed** in `test/README.md` with rationale.

---

*End of merged roadmap and staged implementation plan.*
