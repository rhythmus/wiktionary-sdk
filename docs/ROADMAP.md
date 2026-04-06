# Staged implementation plan (remaining work)

**Status:** Forward-looking engineering and product backlog. **Normative contracts** remain in `docs/wiktionary-sdk-spec.md` and `AGENTS.md`. This file does not redefine extraction rules.

**Delivered roadmap history** (stages 14–22, testing baseline): see **`CHANGELOG.md`** → *Roadmap history — delivered engineering stages*.

**Supporting docs (read before large changes):**

| Document | Use |
|----------|-----|
| `docs/wiktionary-sdk-spec.md` | API, data model, §11.1 REST gaps, §12.x rationale, **§15 future vectors** |
| `audit.md` | Architecture risks, refactor direction, §13 test matrix |
| `docs/query-result-dimensional-matrix.md` | Combinatorics for tests; extend §11 when adding axes (e.g. new enrichment gates) |
| `docs/form-of-display-and-mediawiki-parse.md` | Parse enrichment boundaries vs scraping |
| `docs/TEXT_TO_DICTIONARY_PLAN.md` | **T2D Layer 2** — consumer app; out of SDK core |
| `docs/wiktionary_morphology_engine.md` | Lua / `action=parse` context for morphology |
| `test/README.md` | Mocking tiers, npm scripts, golden workflow |
| `docs/src-layout-refactor-plan.md` | **Phased modular `src/` layout** (alpha: path churn allowed; see `AGENTS.md` § Project stage: alpha) |

**Principles (non-negotiable)**

- **Extraction, not inference:** only what Wikitext/templates expose.
- **Traceability:** structured fields map to source lines/templates.
- **Registry-first:** decoding in `src/decode/registry/` (barrel `decode/registry.ts`), not in the parser orchestrator.
- **Cross-interface parity:** `src/convenience/` ↔ `cli/index.ts` ↔ `webapp/src/App.tsx` ↔ `server.ts` where applicable (`AGENTS.md`).
- **Schema + templates parity** on structural type changes (`AGENTS.md`).

---

## How to use this plan

- Execute **one phase at a time**; keep **`npm test`**, **`npm run build`**, and **`webapp` `npm run build`** (when touched) green before merging.
- Prefer **small, revertible PRs** inside a phase.
- After behaviour-visible changes: update **spec**, **JSON Schema**, **`docs/schemata/`**, **goldens**, and **bundled `templates.ts`** as required.

---

## Execution spine (recommended order)

1. **Phase 0** — Baseline and hygiene (unblocks CI and docs).
2. In parallel where safe: **Phase 7** items that do not touch module graph (golden expansion, README tables, `cross-env` docs).
3. **Phase 1** — Network, cache, and concurrency bounds (operational safety).
4. **Phase 2** — Types, REST surface, centralized defaults (consumer honesty).
5. **Phase 3** — Break cycles, introduce `wiktionary-core` / shared display helpers (**high risk** — do before heavy registry surgery).
6. **Phase 4** — Registry decomposition (**order-preserving** registration). Optional follow-up: **Phase 4.5** — per-family `register-*` modules and shared helpers (`register-all-decoders.ts` as thin orchestrator only).
7. **Phase 5** — Library and morphology clarity (non-Greek hooks, documentation of “smart defaults”).
8. **Phase 6** — Webapp UX and component boundaries.
9. **Phase 7** — Close remaining testing debt (fixture-first library tests, allowlist shrinkage, CI glue).
10. **Phase 8** — Configurable lexeme sort / language priorities (**spec §15 item 1**, former “Stage 23”).
11. **Phase 9** — Standard lexicographic output formats (**spec §15 item 6**, former “Stage 24”).
12. **Phase 10** — Long horizon: recursion, paradigms, multi-wiki, persistent cache, T2D, SPARQL (**spec §15 items 3, 5, 8, 9** + roadmap).

---

## Phase 0 — Baseline, hygiene, and unblockers

**Goal:** Clean tree, reproducible builds, no hidden failures before refactors.

| # | Todo | Verification |
|---|------|----------------|
| 0.1 | Resolve **strict TypeScript** issues that break **`webapp` `npm run build`** (unused locals, strict template types, etc.). | `cd webapp && npm run build` |
| 0.2 | Add a short **version matrix** to README: npm package version vs `SCHEMA_VERSION` vs spec revision (align with `audit.md` §2.2). | Review in PR |
| 0.3 | Relocate or document **root `verify_v2.ts`** under `tools/` or README “manual checks” (`audit.md` §8). | No semantic change |
| 0.4 | Keep **regression coverage** for orchestration hardening called out in spec §12.32–12.33: debug array alignment, `TieredCache` JSON parse resilience, `buildApiFetchResponse` wiring. Extend tests if gaps appear during refactors. | `npm test` |

**Risk:** Low. **Depends on:** nothing.

---

## Phase 1 — Operational safety (network, cache, rate limiting, concurrency)

**Goal:** Bounded failure modes for CLI, server, and browser **without** changing extraction semantics.

| # | Todo | Notes |
|---|------|--------|
| 1.1 | **`mwFetchJson`:** optional `timeoutMs` and/or `signal: AbortSignal`; document Node/server vs browser defaults (`audit.md` §5.1). | Mock `fetch` + abort tests |
| 1.2 | **`proxyUrl`:** document as **unsupported** *or* implement minimal proxy for Node `fetch` (`audit.md` §5.2). | Avoid silent misconfiguration |
| 1.3 | **Rate limiter:** optional `maxQueue` / back-pressure; clear error when exceeded (`audit.md` §5.2). | Default: preserve current behaviour if unset |
| 1.4 | **Lemma batch + form-of parse batch:** shared **`parallelMap(items, limit, fn)`** with default `Infinity` (`audit.md` §5.3–5.4, §12 item 6). | Goldens unchanged |
| 1.5 | **TieredCache L1:** optional **max entries** or LRU via `configureCache` (`audit.md` §6.1). | Opt-in |

**Risk:** Medium if defaults change — prefer **opt-in** first. **Depends on:** Phase 0 (recommended).

---

## Phase 2 — Public API honesty and interface parity

**Goal:** TypeScript declarations, REST, and CLI reflect real runtime behaviour.

| # | Todo | Notes |
|---|------|--------|
| 2.1 | **`src/convenience/`:** align wrapper return types to **`Promise<GroupedLexemeResults<T>>`** where `mapLexemes` is used (`audit.md` §7.3, spec §12.26). | Possible **semver minor** for `.d.ts` consumers |
| 2.2 | **`server.ts` / `buildApiFetchResponse`:** expose **`matchMode`**, **`sort`**, **`debugDecoders`**, and distinguish **`pos`** vs **`preferredPos`** per spec §11.1 / §15 item 2. | Extend `server-fetch-audit` tests |
| 2.3 | **Centralize defaults** in `src/infra/constants.ts`: `LANG_PRIORITY`, default `lang` (**server `el` vs programmatic `Auto`** documented), cache TTL, rate-limit interval (`audit.md` §12, §8). | **Done** on `master` — see `infra/constants.ts`; keep docs in sync when adding knobs. |
| 2.4 | **Optional:** add **`wikidata_error`** to JSON Schema + YAML docs (spec §15 item 7). | Consumer validation only |

**Risk:** Medium. **Depends on:** Phase 0–1 optional.

---

## Phase 3 — Module graph and layering (core)

**Goal:** Remove fragile cycles; separate engine from barrel (`audit.md` §4, §12).

| # | Todo | Status / notes |
|---|------|----------------|
| 3.1 | Add **`src/pipeline/wiktionary-core.ts`:** `wiktionary`, `wiktionaryRecursive`; **no** re-export of convenience / full formatter. | **Done** — `convenience/*`, `server-fetch` import core; tests that stub `wiktionary` target **`pipeline/wiktionary-core`** (or `ingress/api`). |
| 3.2 | Keep **`src/index.ts`** as **public barrel** only. | **Done** — barrel re-exports core + packages. |
| 3.3 | Add **`src/form-of-display.ts`:** morph-line helpers shared by **`present/formatter`** and **`pipeline/form-of-parse-enrich.ts`** (`audit.md` §3.2). | **Done** — `present/formatter` re-exports for API parity; enrich imports `form-of-display` directly. |
| 3.4 | Move **`EtymologyStep`** (or equivalent) into the domain model. | **Done** — `EtymologyStep` in `src/model/etymology.ts`; `present/format-core` / `convenience` import from `../model` or package barrel. |

**Risk:** High (load order, Vitest mocks). **Depends on:** Phases 0–2 desirable.

---

## Phase 4 — Registry decomposition (incremental, order-preserving)

**Goal:** Smaller modules; **identical** decoder registration order (`AGENTS.md`: one `id` per decoder, order matters).

| # | Todo | Notes |
|---|------|--------|
| 4.1 | Inventory decoders by family; map to spec §5 / §14.1. | **Done** — `docs/registry-inventory.md` (registration order, informal families). |
| 4.2 | Extract pure helpers into **`src/decode/registry/`**; transitional re-exports from **`src/decode/registry.ts`**. | **Done** — `merge-patches.ts`, `form-of-predicates.ts`, `strip-wiki-markup.ts`; barrel re-exports predicates + `stripWikiMarkup`. |
| 4.3 | Per-family `register` blocks + **`registerAllDecoders()`** preserving historical order. | **Done** — `decoder-registry.ts`, `register-all-decoders.ts`, thin **`src/decode/registry.ts`** barrel; `registry-decoder-order.test.ts` locks id sequence. |
| 4.4 | Shrink **`DECODER_EVIDENCE_ALLOWLIST`** via `decoder-smoke.wikitext` / fixtures (ties to Phase 7.2). | Small PRs |

**Risk:** High — **never reorder** registrations casually. **Depends on:** Phase 3.3 helps.

---

## Phase 4.5 — Registry ergonomics: per-family modules and shared helpers (follow-up to 4.3)

**Goal:** Shrink **`register-all-decoders.ts`** into a **thin orchestrator** plus **`register*(reg)`** family modules and small **pure-helper** files. **Zero change** to global registration order or decoder semantics.

**Non-negotiables**

- After every sub-phase: **`npm test`**, **`npm run build`**, **`webapp` `npm run build`** (if touched), and **`test/registry-decoder-order.test.ts`** green — update **`EXPECTED_DECODER_IDS`** only when **adding** a decoder, never when splitting files.
- **Do not** reorder `reg.register` calls relative to the canonical sequence in **`docs/registry-inventory.md`**.
- Prefer **one cohesive PR per sub-phase** (or merge 4.5.1 alone, then one PR per family slice).

**Suggested module layout (target end state)**

| File | Responsibility |
|------|----------------|
| **`register-all-decoders.ts`** | **`registerAllDecoders(reg)`** only: sequential **`register*(reg)`** calls in historical order (thin orchestrator). |
| **`register-core-pronunciation.ts`** | `store-raw-templates`, `ipa`, `hyphenation`, `alternative-forms-section` + hyphenation helpers (or import from **`hyphenation.ts`**). |
| **`register-headwords-el-nl-de.ts`** | All `el-*-head`, `nl-*-head`, `de-*-head` decoders. |
| **`register-form-of-wikidata.ts`** | `form-of`, `wikidata-p31` + local label helpers **or** imports from **`form-of-display-label.ts`**. |
| **`register-translations.ts`** | `translations` + `parseTranslationsFromBlock`. |
| **`register-senses.ts`** | `senses` + `parseSenses` and **all** helpers used **only** by sense / usage-note paths (`parseLbTemplate`, `glossFromDefinitionLine`, …). |
| **`register-morphology-la.ts`** | `el-verb-morphology`, `el-noun-gender`, `la-noun-head` + verb/gender helpers. |
| **`register-semantic-relations.ts`** | `semantic-relations` + relation constants / `matchesSectionHeading`. |
| **`register-etymology.ts`** | `etymology` + etymology template maps + `normalizeEtymologyFields`. |
| **`register-pronunciation-extra.ts`** | `el-ipa`, `audio`, `romanization`, `rhymes`, `homophones`. |
| **`register-sections.ts`** | `section-links`, `alternative-forms`, `see-also`, `anagrams`, `usage-notes`, `references` — import **`section-extract.ts`** for shared section parsing. |
| **`register-inflection-stems.ts`** | `inflection-table-ref`, `el-verb-stems`, `el-noun-stems`. |
| **`section-extract.ts`** | `extractSectionByLevelHeaders`, `parseSectionLinkTemplates` (and optionally `matchesSectionHeading` if kept pure). |
| **`gender-map.ts`** | **`GENDER_MAP`** (single definition for nl/de/el-noun-gender/la paths). |
| **`form-of-display-label.ts`** | `TAG_LABEL_MAP`, `tagsToLabel`, `defaultFormOfKindLabel`, `buildFormOfDisplayLabel`. |

Exact file names are suggestions; keep **`src/decode/registry/`** as the home. **Avoid** circular imports: helpers must not import `register-*` modules.

---

### Sub-phases (execute in order)

| # | Todo | Scope | Verification |
|---|------|--------|----------------|
| **4.5.1** | **Extract pure helpers (no `reg.register` moves).** | **Done** — `section-extract.ts` (`extractSectionByLevelHeaders`, `parseSectionLinkTemplates`, `matchesSectionHeading`), `gender-map.ts`, `form-of-display-label.ts` (`buildFormOfDisplayLabel`); `register-all-decoders.ts` imports them. | Order test + full suite. |
| **4.5.2** | **Introduce orchestrator pattern.** | **Done** — `registerAllDecoders` composes family **`register*(reg)`** modules (Phase 4.5.3+); nested helpers were removed when **`register-sections`** / **`register-inflection-stems`** landed (4.5.12–13). | Order test. |
| **4.5.3** | **`register-core-pronunciation.ts`.** | **Done** — `store-raw-templates`, `ipa`, `hyphenation`, `alternative-forms-section` + hyphenation helpers in **`registerCoreAndPronunciation`** (`register-core-pronunciation.ts`). | Order test. |
| **4.5.4** | **`register-headwords-el-nl-de.ts`.** | **Done** — eight `el-*-head`, three `nl-*-head`, three `de-*-head` in **`register-headwords-el-nl-de.ts`**; **`GENDER_MAP`** from **`gender-map.ts`**. | Order test. |
| **4.5.5** | **`register-form-of-wikidata.ts`.** | **Done** — `form-of` + `wikidata-p31` in **`register-form-of-wikidata.ts`**; **`buildFormOfDisplayLabel`** from **`form-of-display-label.ts`**. | Order test. |
| **4.5.6** | **`register-translations.ts`.** | **Done** — `translations` decoder + **`parseTranslationsFromBlock`** in **`register-translations.ts`**. | Order test. |
| **4.5.7** | **`register-senses.ts`.** | **Done** — `senses` + sense helpers in **`register-senses.ts`**; **`formatUsageNoteLine`** in **`format-usage-note-line.ts`** for usage-notes / section decoders. | Largest file reduction; order test + golden/sense-heavy tests. |
| **4.5.8** | **`register-morphology-la.ts`.** | **Done** — `el-verb-morphology`, `el-noun-gender`, `la-noun-head` + helpers in **`register-morphology-la.ts`**. | Order test. |
| **4.5.9** | **`register-semantic-relations.ts`.** | **Done** — `semantic-relations` + relation maps in **`register-semantic-relations.ts`**; **`matchesSectionHeading`** from **`section-extract.ts`**. | Order test. |
| **4.5.10** | **`register-etymology.ts`.** | **Done** — `etymology` + template sets + **`normalizeEtymologyFields`** in **`register-etymology.ts`**. | Order test. |
| **4.5.11** | **`register-pronunciation-extra.ts`.** | **Done** — `el-ipa`, `audio`, `romanization`, `rhymes`, `homophones` in **`register-pronunciation-extra.ts`**. | Order test. |
| **4.5.12** | **`register-sections.ts`.** | **Done** — section/citation decoders in **`register-sections.ts`** (`section-extract`, **`format-usage-note-line`**). | Order test. |
| **4.5.13** | **`register-inflection-stems.ts`.** | **Done** — `inflection-table-ref`, `el-verb-stems`, `el-noun-stems` in **`register-inflection-stems.ts`**; **`register-all-decoders.ts`** is orchestrator-only. | Order test. |
| **4.5.14** | **Public **`registerAllDecoders`** re-export (optional).** | **Done** — **`src/decode/registry.ts`** re-exports **`registerAllDecoders`**; spec §14.1 registry row updated. | Typecheck; no default behaviour change. |
| **4.5.15** | **Single source of truth for canonical decoder `id` list (optional).** | **Done** — **`src/decode/registry/decoder-ids.ts`** exports **`EXPECTED_DECODER_IDS`**; **`registry-decoder-order.test.ts`** imports it; spec §14.1 row; **`docs/registry-inventory.md`** sync note. | Order test still passes; doc accuracy. |
| **4.5.16** | **CI / release guard (optional).** | **Done** — **`tools/assert-registry-order.ts`** compares a fresh registry to **`decoder-ids.ts`**; **`npm run check:registry-order`**; **`test:ci`** runs the check before Vitest. | CI green. |

---

### Explicitly out of scope (defer unless product asks)

- **Runtime plugin / dynamic decoder registration** — new public API surface and security/reproducibility concerns.
- **Reordering decoders** to “clean up” families — invalidates merge semantics; forbidden without a spec change and golden reset.
- **Splitting a single decoder’s `decode` body** across multiple files without a strong maintainability win — prefer one file per decoder **group**, not per template.

---

### Tie-in to Phase 4.4 and Phase 7

- **4.4 (allowlist shrink):** Family files make it obvious **which fixture** backs which decoder group; use **`register-senses.ts`** / **`register-sections.ts`** boundaries when adding `decoder-smoke.wikitext` snippets.
- **Phase 7.2 (testing debt):** Isolated **`DecoderRegistry`** via **`registerAllDecoders`** (4.5.14) simplifies tests that must not mutate the package singleton.

**Risk:** Medium (large moves, easy to accidentally reorder). **Mitigation:** run **`registry-decoder-order.test.ts`** after every edit; keep PRs per sub-phase.

---

## Phase 5 — Library, morphology, and cross-cutting extraction

**Goal:** Clear boundary between convenience API and engine; morphology beyond Greek (`spec` §14.5, §15 item 8).

| # | Todo | Notes |
|---|------|--------|
| 5.1 | Split or document convenience layer into projection vs async/network helpers (`audit.md` §3.2). | **Done** — `src/convenience/*.ts` modules + barrel; preserve `index.ts` exports |
| 5.2 | **`getNativeSenses`:** rename log tag; optional **`onError`** (`audit.md` §8–9). | |
| 5.3 | **`src/convenience/morphology.ts`:** thread **`title`** into `action=parse` where Lua needs page context; non-`el` template prefixes behind explicit options. | New fixtures per language |
| 5.4 | Document **`extractMorphologyFromLexeme`** smart defaults as **wrapper-only** inference (`audit.md` §7.4). | Spec/README + JSDoc |

**Risk:** Medium. **Depends on:** Phase 3.1.

---

## Phase 6 — Webapp UX, polish, and inspector accuracy

**Goal:** URL/history correctness; visible errors; debugger fidelity (`audit.md` §7.5–7.6, §11).

| # | Todo | Notes |
|---|------|--------|
| 6.1 | **Popstate:** either **refetch** when `q` changes from history, or **banner** “results are for previous search” (`audit.md` §7.5, `audit.md` §13.12). | Lock behaviour with a test |
| 6.2 | **`PlainLexemeHtmlBlock`:** show **inline format error** instead of blank card (`audit.md` §7.6). | |
| 6.3 | **Compare mode:** tooltip that secondary fetch uses **`enrich: false`** (`audit.md` §11). | |
| 6.4 | **Debug column:** prefer **`FetchResult.debug` / `DecoderDebugEvent`** over heuristic template→field mapping (`audit.md` §11). | |
| 6.5 | Thin **`App.tsx`** into hooks/components (`audit.md` §3.3). | Behaviour-neutral PRs |

**Risk:** Low.

---

## Phase 7 — Testing, CI, and documentation debt

**Goal:** Close intentional gaps from the testing hardening pass and `audit.md` §13. Ground rules: **`test/README.md`**.

### 7.1 Library tests — fixture-first

- [x] Migrate **`test/library.test.ts`** cases from hybrid **`vi.mock("../src/index")`** + API stub to **fixture-backed `wiktionary({ enrich: false })`** where shapes allow.
- [x] Where fixtures cannot match (e.g. specific translation rows), **document** each mock-only case in the test file header and **`test/README.md`**.

**Done when:** Every case is either fixture-backed or explicitly listed with rationale.

### 7.2 Decoder coverage allowlist

- [x] Add minimal wikitext in shared fixtures / `test/fixtures/decoder-smoke.wikitext` for allowlisted decoders (Greek heads, `romanization`, `rhymes`, section decoders, etc.).
- [x] Remove entries from **`DECODER_EVIDENCE_ALLOWLIST`** as evidence lands.

**Done when:** Allowlist is only universal/framework ids plus **one-line comments** for any intentional exceptions.

### 7.3 Golden snapshots

- [x] Add goldens (same pattern as `test/golden/entry-snapshots.test.ts`) for additional fixtures, e.g. `γράφω`, `nested-templates`, `translations-multi`, `nested-pipe-bug`.
- [x] Document new goldens in **`test/README.md`**.

### 7.4 Stronger library integration tests

- [x] Prioritize **`translate`** (gloss) with `{{t|…|nl|…}}` and **`lemma`** paths on fixture-derived pipelines.

**Done when:** **`test/README.md`** table lists each wrapper group as **fixture-backed** or **mock-result-only**.

### 7.5 Cross-platform live tests

- [x] Document **Windows** / CI invocation for `npm run test:network` (`WIKT_TEST_LIVE=1`), or add **`cross-env`** and a portable npm script.

### 7.6 CHANGELOG discipline

- [x] When shipping phases above, append user-visible testing/infra notes under the next version in **`CHANGELOG.md`** (Keep a Changelog style).

### 7.7 API recording refresh

- [x] Document **`npm run refresh-recording`** checklist in **`test/README.md`** (diff size, no secrets, NFC, minimal fixture).

### 7.8 Optional: shared fixture helper

- [x] Reduce duplication between **`readme_examples.test.ts`** and goldens via e.g. **`test/helper/fixture-fetch.ts`**.

### 7.9 Audit §13 follow-through

- [x] Add or extend tests from **`audit.md` §13** where not already covered (fuzzy+debug alignment, corrupt cache JSON, form-of parse gate matrix, etc.).
- [x] Optional: CI script asserting **types ↔ JSON Schema** sync (`audit.md` §13.14).

### 7.10 Query matrix maintenance

- [x] When adding behaviours (e.g. enrichment axes), update **`docs/query-result-dimensional-matrix.md`** §11 and the dimension tables as needed.

**Risk:** Low. **Can parallelize** with Phases 1–2 where files do not overlap.

---

## Phase 8 — Configurable lexeme sort and language priorities (product: former “Stage 23”)

**Maps to:** spec §12.28, §15 item 1.

**Goal:** Make **`sort: "priority"`** configurable instead of a fixed `LANG_PRIORITY` map.

| # | Todo |
|---|------|
| 8.1 | **Done** — API shape supports `sort: { strategy: "priority", priorities: Record<string, number> }` while keeping string shorthand; CLI adds `--lang-priorities`; REST accepts `langPriorities=el=1,grc=2,...`; spec §1 / §12.28 updated. |
| 8.2 | **Done** — comparator centralized in `wiktionary-core` with normalized sort option defaults from `LANG_PRIORITY`. |
| 8.3 | **Done** — secondary keys implemented for priority sort: same language → `etymology_index` asc → `part_of_speech_heading` alphabetical. |
| 8.4 | **Done** — CLI and webapp expose source vs priority strategy; webapp/search + playground pass sort strategy through; docs clarify default `source`. |
| 8.5 | **Done** — ordering tests extended with multi-language/custom-rank and same-language secondary-key assertions. |

**Risk:** Medium (API design). **Depends on:** Phases 2–3.

---

## Phase 9 — Lexicographic standard output formats (product: former “Stage 24”)

**Maps to:** spec §15 item 6; spec §12.10 formatter architecture.

**Goal:** Additional **fragment-first** serializers beside current Handlebars styles — consumable by DH/NLP/linked-data tooling.

### Priority order (ship incrementally)

1. **Semantic HTML5** — `entry.semantic-html.hbs`, `FormatterStyle` **`semantic-html`**: `<article lang>`, `<header>`, `<dl>`/`<dd>` senses, `<blockquote>` examples, microdata/`data-*`, ARIA as appropriate.
2. **TEI Lex-0** — `entry.tei.hbs` or serializer → TEI `<entry>` **fragment**; mapping table in spec.
3. **ODXML (ODict)** — **Full, spec-compliant** [ODict XML / ODXML](https://www.odict.org/docs/xml): root [`dictionary`](https://www.odict.org/docs/xml/dictionary), [`entry`](https://www.odict.org/docs/xml/entry) (`term`, optional `pronunciation`, `see`), [`ety`](https://www.odict.org/docs/xml/ety) (`description`, `id`), [`sense`](https://www.odict.org/docs/xml/sense) (`pos` per [ODict POS tags](https://www.odict.org/docs/reference/pos)), [`group`](https://www.odict.org/docs/xml/group), [`definition`](https://www.odict.org/docs/xml/definition) (`value`), [`example`](https://www.odict.org/docs/xml/example), [`note`](https://www.odict.org/docs/xml/note). Map from `FetchResult` / `Lexeme` / `Sense` / `EtymologyData`; document **lossy** fields (e.g. semantic relations, translations, Wikidata); define **lexeme-merge** policy when one page yields multiple slices; golden tests vs ODict CLI expectations where useful; **`FormatterStyle` `odxml`** or standalone serializer (fragment vs full document wrapper).
4. **OntoLex-Lemon (JSON-LD)** — programmatic `@graph`; **`jsonld`** or **`ontolex`** style.
5. **LMF (ISO 24613)** — XML serializer; may share mapping logic with TEI.
6. **XDXF** — XML for dictionary interchange.

**Architecture constraints**

- **Fragment-first:** consumers wrap in `<TEI>`, LMF container, or a single-root ODXML `dictionary` (per [ODXML](https://www.odict.org/docs/xml)), etc.
- **Traceability:** no synthetic fields beyond established extraction rules.
- **Environment-agnostic:** bundle templates as TS strings (`AGENTS.md` §5).
- **Verification:** golden or snapshot tests per format; update spec §12.10 distribution table.

**Risk:** High surface area. **Depends on:** Phase 4 optional (cleaner registry/formatter split).

---

## Phase 10 — Long-horizon initiatives

**Maps to:** spec §15 items 3, 5, 8, 9; `docs/TEXT_TO_DICTIONARY_PLAN.md`.

### 10.1 Stage 25 (recursive resolution and paradigms)

- [ ] **Alternative forms:** optional recursive fetch of variant lemmas (cycle limits, UX for N+1 fetches).
- [ ] **Paradigms:** research full table reconstruction from template-extracted stems **without** extra API fallbacks (explicitly non-goals stay non-goals).
- [ ] **MetaLang:** map Wiktionary translations to MetaLang concept IDs (research / separate module).

### 10.2 Non–en.wiktionary (spec §15 item 3)

- [ ] Site parameter; heading normalizers; per-wiki template families.

### 10.3 Persistent L2/L3 cache (spec §15 item 5)

- [ ] SQLite / IndexedDB / Redis adapters; document invalidation via **`revision_id`** / **`last_modified`**.

### 10.4 Decoder expansion (ongoing)

- [ ] Category-driven coverage (`template-introspect`, `report:form-of`); keep evidence in fixtures or documented allowlist.

### 10.5 T2D Layer 2 (spec §15 item 9)

- [ ] Sense disambiguation, token→lemma, vector store — **consumer layer** on top of `FetchResult`; not part of core extractor.

### 10.6 Wikidata SPARQL (spec / T2D)

- [ ] Hybrid extraction research; **not** core SDK path until product need is clear (`TEXT_TO_DICTIONARY_PLAN.md`).

---

## Global exit criteria (hardening track)

The hardening phases (0–7 + 8–9 as adopted) are **complete enough** when:

- [ ] No **undocumented** module cycles; **`convenience/stem`** / **`convenience/morphology`** do not import the public barrel for core fetch (use **`pipeline/wiktionary-core`**).
- [ ] Convenience wrappers expose **`GroupedLexemeResults<T>`** in `.d.ts` where applicable.
- [ ] **REST** query params match documented **CLI** parity for `matchMode`, `sort`, `debugDecoders`, `pos` vs `preferredPos`.
- [ ] **`mwFetchJson`** supports **bounded** wait time (or caller `signal`) in server/CLI scenarios.
- [ ] **Registry** split maintains **frozen** registration order (`registry-ids.test.ts` + decoder coverage green).
- [ ] Phase 7 **deferred** items are **done** or **explicitly listed** in `test/README.md` with rationale.

---

## Spec §15 cross-reference (quick map)

| §15 # | Topic | Primary phase |
|-------|--------|----------------|
| 1 | Configurable language priority | Phase 8 |
| 2 | REST/CLI parity | Phase 2 |
| 3 | Non–en.wiktionary | Phase 10.2 |
| 4 | Decoder expansion | Phase 4, 7.2, 10.4 |
| 5 | Persistent cache adapters | Phase 10.3 |
| 6 | Standard lexicographic exports | Phase 9 |
| 7 | Optional `wikidata_error` in schema | Phase 2.4 |
| 8 | Morphology beyond Greek | Phase 5 |
| 9 | Sense disambiguation layer (T2D) | Phase 10.5 |

---

*End of remaining-work implementation plan.*
