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

**Principles (non-negotiable)**

- **Extraction, not inference:** only what Wikitext/templates expose.
- **Traceability:** structured fields map to source lines/templates.
- **Registry-first:** decoding in `src/registry.ts` (and split modules when introduced), not in the parser orchestrator.
- **Cross-interface parity:** `library.ts` ↔ `cli/index.ts` ↔ `webapp/src/App.tsx` ↔ `server.ts` where applicable (`AGENTS.md`).
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
6. **Phase 4** — Registry decomposition (**order-preserving** registration).
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
| 2.1 | **`library.ts`:** align wrapper return types to **`Promise<GroupedLexemeResults<T>>`** where `mapLexemes` is used (`audit.md` §7.3, spec §12.26). | Possible **semver minor** for `.d.ts` consumers |
| 2.2 | **`server.ts` / `buildApiFetchResponse`:** expose **`matchMode`**, **`sort`**, **`debugDecoders`**, and distinguish **`pos`** vs **`preferredPos`** per spec §11.1 / §15 item 2. | Extend `server-fetch-audit` tests |
| 2.3 | **Centralize defaults** in e.g. `src/constants.ts`: `LANG_PRIORITY`, default `lang` (**server `el` vs library `Auto`** documented), cache TTL, rate-limit interval (`audit.md` §12, §8). | |
| 2.4 | **Optional:** add **`wikidata_error`** to JSON Schema + YAML docs (spec §15 item 7). | Consumer validation only |

**Risk:** Medium. **Depends on:** Phase 0–1 optional.

---

## Phase 3 — Module graph and layering (core)

**Goal:** Remove fragile cycles; separate engine from barrel (`audit.md` §4, §12).

| # | Todo | Status / notes |
|---|------|----------------|
| 3.1 | Add **`src/wiktionary-core.ts`:** `wiktionary`, `wiktionaryRecursive`; **no** re-export of `library` / full `formatter`. | **Done** — `library`, `morphology`, `stem`, `server-fetch` import core; tests that stub `wiktionary` mock **`wiktionary-core`**. |
| 3.2 | Keep **`src/index.ts`** as **public barrel** only. | **Done** — barrel re-exports core + packages. |
| 3.3 | Add **`src/form-of-display.ts`:** morph-line helpers shared by **`formatter.ts`** and **`form-of-parse-enrich.ts`** (`audit.md` §3.2). | **Todo** — no output change when done |
| 3.4 | Move **`EtymologyStep`** (or equivalent) to **`types.ts`** or `types-etymology.ts`. | **Todo** — type-only |

**Risk:** High (load order, Vitest mocks). **Depends on:** Phases 0–2 desirable.

---

## Phase 4 — Registry decomposition (incremental, order-preserving)

**Goal:** Smaller modules; **identical** decoder registration order (`AGENTS.md`: one `id` per decoder, order matters).

| # | Todo | Notes |
|---|------|--------|
| 4.1 | Inventory decoders by family; map to spec §5 / §14.1. | Spreadsheet or markdown inventory OK |
| 4.2 | Extract pure helpers into **`src/registry/`**; transitional re-exports from `registry.ts`. | |
| 4.3 | Per-family `register` blocks + **`registerAllDecoders()`** preserving historical order. | `registry-ids.test.ts`, decoder coverage, goldens |
| 4.4 | Shrink **`DECODER_EVIDENCE_ALLOWLIST`** via `decoder-smoke.wikitext` / fixtures (ties to Phase 7.2). | Small PRs |

**Risk:** High — **never reorder** registrations casually. **Depends on:** Phase 3.3 helps.

---

## Phase 5 — Library, morphology, and cross-cutting extraction

**Goal:** Clear boundary between convenience API and engine; morphology beyond Greek (`spec` §14.5, §15 item 8).

| # | Todo | Notes |
|---|------|--------|
| 5.1 | Split or document **`library.ts`** into projection vs async/network helpers (`audit.md` §3.2). | Preserve `index.ts` exports |
| 5.2 | **`getNativeSenses`:** rename log tag; optional **`onError`** (`audit.md` §8–9). | |
| 5.3 | **`morphology.ts`:** thread **`title`** into `action=parse` where Lua needs page context; non-`el` template prefixes behind explicit options. | New fixtures per language |
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

- [ ] Migrate **`test/library.test.ts`** cases from hybrid **`vi.mock("../src/index")`** + API stub to **fixture-backed `wiktionary({ enrich: false })`** where shapes allow.
- [ ] Where fixtures cannot match (e.g. specific translation rows), **document** each mock-only case in the test file header and **`test/README.md`**.

**Done when:** Every case is either fixture-backed or explicitly listed with rationale.

### 7.2 Decoder coverage allowlist

- [ ] Add minimal wikitext in shared fixtures / `test/fixtures/decoder-smoke.wikitext` for allowlisted decoders (Greek heads, `romanization`, `rhymes`, section decoders, etc.).
- [ ] Remove entries from **`DECODER_EVIDENCE_ALLOWLIST`** as evidence lands.

**Done when:** Allowlist is only universal/framework ids plus **one-line comments** for any intentional exceptions.

### 7.3 Golden snapshots

- [ ] Add goldens (same pattern as `test/golden/entry-snapshots.test.ts`) for additional fixtures, e.g. `γράφω`, `nested-templates`, `translations-multi`, `nested-pipe-bug`.
- [ ] Document new goldens in **`test/README.md`**.

### 7.4 Stronger library integration tests

- [ ] Prioritize **`translate`** (gloss) with `{{t|…|nl|…}}` and **`lemma`** paths on fixture-derived pipelines.

**Done when:** **`test/README.md`** table lists each wrapper group as **fixture-backed** or **mock-result-only**.

### 7.5 Cross-platform live tests

- [ ] Document **Windows** / CI invocation for `npm run test:network` (`WIKT_TEST_LIVE=1`), or add **`cross-env`** and a portable npm script.

### 7.6 CHANGELOG discipline

- [ ] When shipping phases above, append user-visible testing/infra notes under the next version in **`CHANGELOG.md`** (Keep a Changelog style).

### 7.7 API recording refresh

- [ ] Document **`npm run refresh-recording`** checklist in **`test/README.md`** (diff size, no secrets, NFC, minimal fixture).

### 7.8 Optional: shared fixture helper

- [ ] Reduce duplication between **`readme_examples.test.ts`** and goldens via e.g. **`test/helper/fixture-fetch.ts`**.

### 7.9 Audit §13 follow-through

- [ ] Add or extend tests from **`audit.md` §13** where not already covered (fuzzy+debug alignment, corrupt cache JSON, form-of parse gate matrix, etc.).
- [ ] Optional: CI script asserting **types ↔ JSON Schema** sync (`audit.md` §13.14).

### 7.10 Query matrix maintenance

- [ ] When adding behaviours (e.g. enrichment axes), update **`docs/query-result-dimensional-matrix.md`** §11 and the dimension tables as needed.

**Risk:** Low. **Can parallelize** with Phases 1–2 where files do not overlap.

---

## Phase 8 — Configurable lexeme sort and language priorities (product: former “Stage 23”)

**Maps to:** spec §12.28, §15 item 1.

**Goal:** Make **`sort: "priority"`** configurable instead of a fixed `LANG_PRIORITY` map.

| # | Todo |
|---|------|
| 8.1 | Design **API shape** (TypeScript + CLI + REST): e.g. `sort: { strategy: "priority", priorities: Record<string, number> }` and `--lang-priorities el=1,grc=2,…`. Update spec §1 / §12.28. |
| 8.2 | Implement comparator in engine module (post–Phase 3); wire defaults via Phase 2.3 constants. |
| 8.3 | **Secondary sort keys:** same language → `etymology_index` asc → PoS heading; optional hooks for domain consumers. |
| 8.4 | **CLI & webapp:** sort strategy toggle; document vs **`sort: "source"`** default. |
| 8.5 | **Tests:** matrix-style multi-language fixtures for ordering. |

**Risk:** Medium (API design). **Depends on:** Phases 2–3.

---

## Phase 9 — Lexicographic standard output formats (product: former “Stage 24”)

**Maps to:** spec §15 item 6; spec §12.10 formatter architecture.

**Goal:** Additional **fragment-first** serializers beside current Handlebars styles — consumable by DH/NLP/linked-data tooling.

### Priority order (ship incrementally)

1. **Semantic HTML5** — `entry.semantic-html.hbs`, `FormatterStyle` **`semantic-html`**: `<article lang>`, `<header>`, `<dl>`/`<dd>` senses, `<blockquote>` examples, microdata/`data-*`, ARIA as appropriate.
2. **TEI Lex-0** — `entry.tei.hbs` or serializer → TEI `<entry>` **fragment**; mapping table in spec.
3. **OntoLex-Lemon (JSON-LD)** — programmatic `@graph`; **`jsonld`** or **`ontolex`** style.
4. **LMF (ISO 24613)** — XML serializer; may share mapping logic with TEI.
5. **XDXF** — XML for dictionary interchange.

**Architecture constraints**

- **Fragment-first:** consumers wrap in `<TEI>`, LMF container, etc.
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

- [ ] No **undocumented** module cycles; `library` / `stem` / `morphology` do not import the public barrel for core fetch.
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
