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

---

## 📜 Historical Stages (Delivered)
*See [CHANGELOG.md](../CHANGELOG.md) for details.*

- **Stage 17**: High-Fidelity Extraction, Interface Parity & v2.1 Schema.
- **Stage 14-16**: v2.0 Final Release, Deep Enrichment & Playground Overhaul.
- **Stage 13**: Comprehensive Schema v2.0, API Enrichment & Decoder Expansion.
- **Stage 12**: Auto-discovery, Optional Filtering & Robust Parsing.
- **Stage 11**: Compliance, Normalization & Doc Synchronization.
- **Stage 10**: Formatter Engine, Morphology Corrections & Playground Overhaul.
- **Stage 9**: Morphological API & Technical Documentation.
- **Stages 0-8**: Core Engine, Registry, Parser, and v1.0 Foundation.
