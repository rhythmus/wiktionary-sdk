# Wiktionary SDK — Codebase audit (read-only)

**Date:** 2026-04-04  
**Path refresh:** 2026-04-05 — annotations updated for the modular `src/` layout on `master` (`ingress/`, `parse/`, `decode/`, `pipeline/`, `present/`, `convenience/`, `infra/`, `model/`; see `docs/src-layout-refactor-plan.md`).  
**Scope:** Documentation in `docs/` (full read of normative and supporting docs; chat-history logs treated as non-normative archives), core `src/`, `webapp/src/`, `cli/`, `server.ts`, `test/`, and `tools/`.  
**Constraint:** This report does not change runtime behaviour; it records findings and recommendations for future refactors.

---

## 1. Executive summary

The project delivers a **source-faithful** Wiktionary extraction pipeline with a layered `src/` layout: **public barrel** (`src/index.ts`), **domain model** (`src/model/`), **ingress** (`src/ingress/` — API, cache, rate limiter, server fetch), **parse** (`src/parse/`), **decode** (`src/decode/registry/` tree), **pipeline** (`src/pipeline/` — `wiktionary-core`, `form-of-parse-enrich`), **present** (`src/present/` — formatter, templates, display groups), **convenience** (`src/convenience/` — wrappers, morphology, stem), and **infra** (`src/infra/` — utils, constants), plus **consumers** (CLI, webapp, HTTP server). The written specification (`docs/wiktionary-sdk-spec.md` v3.4+) is unusually well aligned with the implementation and explicitly calls out known edges (lemma cycles, fuzzy merge, form-of Lua vs wikitext, REST parity gaps).

Main risks for maintainability and robustness:

1. **Residual module coupling** — The former `index` ↔ `library` and `morphology` ↔ `library` cycles are **removed** (`convenience/*` imports `wiktionary` from `pipeline/wiktionary-core`, not the barrel). **`present/format-core.ts`** still imports **types** from `convenience/morphology.ts` and `convenience/stem.ts` (`GrammarTraits`, `WordStems`) for formatter APIs — a **present → convenience** edge that could be dropped by moving those interfaces into `model/` if desired. Tree-shaking and test doubles are healthier than before.
2. **Registry surface area** — Decoder registration is **split** across `src/decode/registry/register-*.ts` and `register-all-decoders.ts`, but the combined registry story remains **large and order-sensitive** (merge-conflict and registration-order sensitivity documented in `AGENTS.md`).
3. **No network timeouts or abort** on `fetch()` in `mwFetchJson` — hung requests can stall callers indefinitely; rate limiter queues can grow without bound under burst concurrency.
4. **Concrete bugs / sharp edges:** several **public TypeScript return types** on wrappers that do not match the actual `GroupedLexemeResults` shape; webapp **popstate** updates query state without refetching. *(Historical: debug padding used `Array.fill` with a shared array reference — **fixed** in `pipeline/wiktionary-core.ts` via `Array.from` factories.)*
5. **Spec vs types drift:** `translate()` is documented as returning `GroupedLexemeResults<string[]>` but is annotated as such only at the function; many sibling wrappers are still declared as bare `Promise<LexemeResult<T>[]>` though they return `mapLexemes()` envelopes.

The existing test story (goldens, decoder coverage, parser invariants, cross-interface parity, schema negatives) is strong. The final section lists **additional tests** that would best protect a heavy refactor.

---

## 2. Documentation review

### 2.1 Normative and high-value docs (read in full or in large part)

| Document | Role |
|----------|------|
| `docs/wiktionary-sdk-spec.md` | Ground truth for API options, data model, pipeline, decoder philosophy, formatter/homonym merge, known caveats (e.g. lemma-resolved rows and empty `debug`). |
| `docs/query-result-dimensional-matrix.md` | Combinatorics of axes (strict/fuzzy, lang, etymology, PoS, type, enrichment); good for test design. |
| `docs/form-of-display-and-mediawiki-parse.md` | Rationale for `action=parse` on definition-line wikitext; boundaries vs scraping. |
| `docs/ROADMAP.md` | Remaining work: audit-aligned phases 0–10, product phases 8–10; delivered history in `CHANGELOG.md`. |
| `docs/TEXT_TO_DICTIONARY_PLAN.md` | Consumer-layer vision; marks Wikidata SPARQL as aspirational — not implemented in core SDK path. |
| `docs/wiktionary_morphology_engine.md` | Context for Lua/Scribunto; aligns with `src/convenience/morphology.ts` parse fallback. |
| `docs/Prior and Related Work.md` | Background (if present in tree). |
| `test/README.md` / `AGENTS.md` | Operational rules for agents and tests (mock `api`, not partial `index` mocks). |

### 2.2 Alignment notes

- **REST server** (`server.ts`): Spec §11.1 correctly states limited query surface vs CLI/webapp (`matchMode`, `sort`, `debugDecoders`, true `pos` filter). Default `lang` is `el` on the server vs `"Auto"` in `wiktionary()` — intentional mismatch worth centralizing in one “defaults” module when refactoring.
- **Schema version:** `SCHEMA_VERSION` lives in `src/model/schema-version.ts` (re-exported via `src/index.ts`); it tracks the **output** schema (currently `3.3.0`), while the **spec document** carries its own revision label — both are called out in the README version table; keep them in sync when bumping (`VERSIONING.md`).
- **Chat exports under `docs/AI agents chat history/`:** Historical; not treated as product requirements.

---

## 3. Architecture, separation of concerns, folder layout

### 3.1 Strengths

- **Core engine** is mostly environment-agnostic; templates are bundled in `src/present/templates/templates.ts` per `AGENTS.md` (no runtime `fs` for HTML/CSS in consumers).
- **PoS-boundary rule** in `splitEtymologiesAndPOS()` is the correct answer to the “flat heading” problem; spec §4.2 matches code.
- **Wrapper invocation** is centralized in `src/convenience/wrapper-invoke.ts` and reused by CLI and webapp — good defence against signature drift.
- **Formatter** separates Handlebars/CSS from extraction; `lexeme-display-groups.ts` keeps homonym merge **display-only**, preserving normalized `lexemes[]` API (spec §12.10.6).

### 3.2 Weaknesses

- **Registry navigation:** Decoders and helpers are **folderized** under `src/decode/registry/` (`register-*.ts`, `register-all-decoders.ts`, pure helpers). The **barrel** `decode/registry.ts` and **`decoder-registry.ts`** remain a broad surface — continue to treat registration order as a contract (`registry-decoder-order.test.ts`).
- **Form-of display vs enrichment (mostly addressed):** Morph-line helpers live in **`src/form-of-display.ts`**. Both **`pipeline/form-of-parse-enrich.ts`** and **`present/formatter.ts`** (re-)export through that module, so enrichment no longer reaches into the full formatter implementation. **Residual:** `present/format-core.ts` imports **types** from **`convenience/morphology.ts`** / **`convenience/stem.ts`** for `GrammarTraits` / `WordStems` — acceptable but couples **present → convenience** until those types migrate to `model/`.
- **Convenience split (done):** Former monolithic **`library.ts`** is replaced by **`src/convenience/*.ts`** (`grouped-results`, `lemma-translate`, `relations`, `page-enrichment`, `rich-entry`, `lexical-wrappers`, `morphology`, `stem`, `wrapper-invoke`, barrel `index.ts`). Further clarity is incremental (docs / naming), not a single-file split.

### 3.3 UI vs logic vs styling (webapp)

- **`App.tsx` is very large** (~1500+ lines): search, comparison mode, YAML inspector, debugger, playground triple-window, URL sync, and layout logic interleave. Extracting hooks (`useWiktionarySearch`, `useUrlQuery`, `usePlaygroundApi`) and presentational components would improve readability and testability without changing behaviour.
- **Styling** has moved toward `webapp/src/index.css` with semantic classes (per spec roadmap notes); remaining inline concerns are mostly dynamic or third-party (framer-motion).
- **`dangerouslySetInnerHTML`:** Used for formatted entry HTML and terminal-html preview — appropriate given Handlebars output; ensure any future user-controlled strings never flow into templates without escaping (current data is SDK-derived, not arbitrary HTML).

---

## 4. Circular dependencies and module graph

Observed edges:

```
index.ts → convenience/* (re-export), pipeline/wiktionary-core, present/*, decode/registry, …
convenience/* → pipeline/wiktionary-core (wiktionary), ingress/* as needed
convenience/morphology.ts → grouped-results, lemma-translate, ingress/api, pipeline/wiktionary-core
convenience/stem.ts → pipeline/wiktionary-core
present/format-core.ts → ../model, ../convenience/morphology|stem (types), ../form-of-display
pipeline/form-of-parse-enrich.ts → ingress/api, decode/registry, form-of-display, infra/utils
```

**Why it works:** Convenience code imports **`wiktionary`** from **`pipeline/wiktionary-core`**, not from `index.ts`, so the barrel is not on the hot path for those modules. The spec still warns that partial `vi.mock("../src/index")` may not replace **`wiktionary` bindings inside `src/convenience/*.ts`** — stub **`ingress/api`** or **`pipeline/wiktionary-core`** for reliable tests (`test/README.md`).

**Risks:**

- Refactors that add **top-level side effects** or **cyclic type-only imports** can cause TDZ or undefined bindings in some bundlers or test runners.
- **Tree-shaking / dead-code elimination** may be suboptimal when everything re-exports through `index.ts`.

**Refactor direction (largely shipped on `master`):**

- **`src/pipeline/wiktionary-core.ts`** exports `wiktionary` / `wiktionaryRecursive` without pulling in convenience or present.
- **`src/convenience/*`** imports core from `wiktionary-core`, not from `index.ts`.
- **`src/form-of-display.ts`** shares morph-line logic between pipeline enrichment and present layer.
- **`src/index.ts`** remains the public **barrel** (core + convenience + constants + headings + registry predicates).

---

## 5. Concurrency, timeouts, rate limiting, and “runaway” behaviour

### 5.1 `mwFetchJson` (`src/ingress/api.ts`)

- Uses global `fetch` with **no `AbortSignal`, no timeout**. A slow or stuck MediaWiki response blocks the caller until the platform gives up.
- **Recommendation:** Optional `timeoutMs` (or caller-supplied `signal`) with `AbortController` + `fetch`; document default for CLI/server vs browser.

### 5.2 Rate limiter (`src/ingress/rate-limiter.ts`)

- Serializes requests with a minimum interval — good for Wikimedia etiquette.
- **`proxyUrl` is stored but never applied** to `fetch`; spec and tests mention configuration, but HTTP traffic does not use the proxy. Either implement (e.g. Node `undici` proxy agent or documented limitation) or mark as reserved in API docs.
- **Unbounded queue:** Every `throttle()` pushes a resolver; a burst of concurrent tasks (e.g. fuzzy mode × many lemma resolutions × form-of parse batch) can enqueue large resolver lists. Consider a **max queue** with back-pressure or batching for server deployments.

### 5.3 Parallel lemma resolution (`wiktionaryRecursive`)

- `Promise.all` over unique lemma fetches is correct for correctness; combined with global throttle it becomes **serial in practice** for HTTP but still allocates concurrent async stacks. For server scale, explicit **concurrency limit** (p-limit pattern) would bound memory and make latency more predictable.

### 5.4 Form-of parse batch

- `enrichFormOfMorphLinesFromParseBatch` uses `Promise.all` per lexeme needing enrichment — same stampede pattern; acceptable for typical page sizes but worth a concurrency cap in server contexts.

### 5.5 Webapp nested lemma fetches

- Each `FormOfLexemeBlock` runs `wiktionary()` in `useEffect` with cancellation — good. Many visible form-of rows ⇒ **N parallel secondary fetches**; rate limiter mitigates but UI may show many spinners and stress browser tabs.

---

## 6. Memory, caches, and leaks

### 6.1 `TieredCache` (`src/ingress/cache.ts`)

- L1 `MemoryCache` grows with distinct keys; **no max size eviction** (TTL only). Long-running CLI batches or servers with huge title diversity can grow memory without bound.
- `get()` uses `JSON.parse` without **try/catch**; corrupted L2/L3 string values could throw and abort a fetch pipeline. Hardening: catch, delete key, miss as cache miss.

### 6.2 React lifecycle

- `matchMedia` listener in `App.tsx` is correctly removed on unmount.
- `popstate` listener removed on unmount — good.
- Lemma resolve effects use `cancelled` flag — good pattern.

---

## 7. Bugs, correctness risks, and spec-adjacent issues

### 7.1 Debug array padding — shared reference bug

In `src/pipeline/wiktionary-core.ts`, when `debugDecoders` is true, debug padding for resolved lemma rows uses **`Array.from({ length: n }, () => [])`** so each slot is a **fresh array** (avoids the historical `Array.fill([])` shared-reference bug).

### 7.2 Fuzzy mode + `debugDecoders`

- Merged lexemes dedupe by `id`; `debug` rows are pushed in merge order with `debugRows[idx] ?? []`. If deduplication skips lexemes, **debug alignment with `lexemes[i]`** may be off in edge cases. Worth a dedicated test matrix (strict vs fuzzy, duplicate ids across variants).

### 7.3 Type annotations vs runtime shape (`src/convenience/*.ts`)

- Many async wrappers return `mapLexemes(...)`, which produces **`GroupedLexemeResults<T>`** (array + `order` + `lexemes`), but signatures often say `Promise<LexemeResult<T>[]>`. TypeScript structural typing may still accept this in some directions, but **consumers reading `.d.ts` files** get wrong guidance. Align declarations with `GroupedLexemeResults<T>` (spec §12.26 / §3.9).
- `translate()` return type is correctly `GroupedLexemeResults<string[]>`; **synonyms/antonyms/…** should match for consistency.

### 7.4 `src/convenience/morphology.ts` — `extractMorphologyFromLexeme`

- For Greek verbs lemmas, sets default person/number/tense/voice from surface form endings — documented as “smart defaults” for conjugation UX. This is **behavioural inference** relative to strict template-only extraction; it is limited to the morphology wrapper, not normalized `Lexeme` fields, but maintainers should not confuse it with core extractor invariants.

### 7.5 Webapp URL / history

- **Initial mount:** `useEffect(() => { handleSearch(); }, [])` intentionally omits deps; stale closures are mitigated by using state initializers. Documented eslint disable is honest.
- **`popstate` handler** only calls `setQuery` from URL; it does **not** call `handleSearch()`. After back/forward, the search box may show a new `q` while **results still reflect the previous query** — a user-visible inconsistency. Either refetch on popstate or treat URL as source of truth only on load.

### 7.6 `PlainLexemeHtmlBlock` format errors

- On `format()` throw, logs to `console.error` and returns empty string — user sees a blank card. Prefer a visible inline error stub (same information as log) for polish.

### 7.7 Server `preferredPos` vs `pos`

- Query param `pos` maps to `preferredPos` in `wiktionary()`, not to `pos` filtering — matches spec. Easy to misunderstand; parity work should expose both explicitly.

---

## 8. Redundant, obsolete, or stray code

- **Root `verify_v2.ts`:** Appears to be a manual verification script; consider moving under `tools/` or documenting in README as non-package entry (low priority).
- **`console.error` in `convenience/lemma-translate.ts`** for `getNativeSenses` failures (`[lightweight-scraper]` prefix): legacy naming; consider structured logging hook or silent return with optional `onError` callback for consumers.
- **Tools and CLI `console.log`:** Appropriate for CLI UX; not an issue.
- **`LANG_PRIORITY`:** defined in **`src/infra/constants.ts`** and re-exported from `index.ts`; roadmap configurability remains a product follow-up.

---

## 9. Naming consistency

- Mixed **camelCase** file names vs **kebab-case** docs — acceptable.
- **`phonetic` vs `ipa`, `derivations` vs `derivedTerms`, `audioDetails` vs `audioGallery`:** Aliases documented in spec §12.19; keep but consider deprecation warnings in JSDoc only (no runtime change).
- **“lightweight-scraper”** log tag in **`convenience/lemma-translate.ts`** does not match product name “Wiktionary SDK”.

---

## 10. Security and robustness (brief)

- Server enables **CORS `*`** — fine for demo API; production deployments should restrict origins.
- **No request size limits** on `server.ts` for GET — normal.
- Output is derived from Wiktionary/Wikidata; **XSS risk** is in embedding apps that inject HTML without sanitization; SDK HTML is intended as trusted fragment from known templates — document for integrators.

---

## 11. Visual / UX polish (webapp)

- **Popstate / refetch** (above).
- **Compare mode** second fetch uses `enrich: false` while main uses `enrich: true` — intentional for speed; could surprise users comparing “Wikidata-rich” vs not; a tooltip could clarify.
- **Decoder column in debug mode:** `extractDecoderMatches` in `App.tsx` uses heuristic template-name → field mapping; it may **not** match true `DecoderDebugEvent` semantics — risk of misleading debugger UI vs `debugDecoders` output.
- **Empty format result:** silent failure on format errors (above).

---

## 12. Refactoring proposals (behaviour-preserving when done carefully)

1. **Continue registry ergonomics** — optional shrinks of `decoder-registry.ts` / helper extraction without reordering `reg.register` (`docs/ROADMAP.md` Phase 4.5 follow-ups).
2. ~~**Break the `index` ↔ `library` cycle**~~ — **Done** (`pipeline/wiktionary-core` + `convenience/*`).
3. ~~**Extract `form-of-display` helpers**~~ — **Done** (`src/form-of-display.ts`).
4. ~~**Centralize defaults**~~ — **Done** (`src/infra/constants.ts` for `LANG_PRIORITY`, cache TTL, rate-limit interval; server default lang in same module).
5. **Thin `App.tsx`:** hooks + subcomponents; keep props identical to preserve UI.
6. **Optional concurrency primitives:** extend use of **`parallelMap`** (`src/infra/utils.ts`) with tighter limits for lemma batch and form-of parse batch where needed.
7. **Fetcher abstraction:** single place for timeout, retries (if ever added), and metrics.

---

## 13. Unit and integration tests to add or strengthen

Existing coverage (goldens, decoder coverage, registry ids, parser invariants, wrapper contract, cross-interface parity, fallback enrichment matrix, negative schema, integration adapters) is a solid baseline. For a **heavy refactor**, prioritize:

### 13.1 Orchestration (`pipeline/wiktionary-core.ts`; barrel `index.ts`)

- **Cycle detection:** visited set prevents infinite recursion; assert note text and empty lexeme list.
- **Combining-mark retry:** mock missing page then hit for stripped title; assert single visit behaviour and optional note when `debugDecoders`.
- **Fuzzy merge:** two variants return overlapping `id`s; merged length and notes; **debug array length** matches merged `lexemes`.
- **`sort: "priority"`:** ordering for synthetic multi-language fixtures.
- **`pos` filter:** blocks with non-matching `lexemeMatchesPosQuery` (strict PoS, section slug, or heading) are skipped.
- **Lemma batch deduplication:** two `INFLECTED_FORM` rows same lemma/lang ⇒ one recursive fetch.
- **`debugDecoders` padding:** assert resolved lemma rows have **independent** `debug` arrays (after fixing `fill([])` bug, regression test for aliasing).

### 13.2 API / network hardening

- **`mwFetchJson`:** mock `fetch` resolving/rejecting; when timeout added, test abort path.
- **`normalizeWiktionaryQueryPage`:** edge cases (missing slots, empty categories) — extend `network-replay.test.ts` fixtures.

### 13.3 Cache

- Corrupt JSON in L1/L2 string → parse failure handled as miss (once implemented).
- TTL expiry: clock mock or short TTL test.

### 13.4 Rate limiter

- Ordering: N concurrent `throttle()` calls fire spaced by `minIntervalMs`.
- Queue drain: after burst, `processing` returns false.

### 13.5 Parser

- Additional fixtures for **implicit etymology** / empty `etyms` branches in `splitEtymologiesAndPOS`.
- Heading tolerance: variable `=` counts (already partially covered).

### 13.6 Registry / decoders

- **Golden or targeted tests** for every allowlisted decoder in `DECODER_EVIDENCE_ALLOWLIST` (goal: shrink allowlist).
- **`stripWikiMarkup`:** nested `[[…]]` and `{{…}}` edge cases; emphasis ordering (`'''` vs `''`).
- **Form-of predicates:** `isFormOfTemplateName` / `isVariantFormOfTemplateName` / `isPerLangFormOfTemplate` tables driven from a shared fixture file.

### 13.7 Form-of parse enrichment

- Mock `mwFetchJson` for `action=parse`; assert `display_morph_lines` and `display_morph_lines_source`.
- HTML with no `ol ol > li` → no mutation.
- **`lexemeNeedsFormOfParseEnrichment` gate matrix:** subsenses present, abbrev-only, already enriched — boolean expectations.

### 13.8 Morphology

- `parseMorphologyTags` exhaustive tag combinations.
- `conjugate` / `decline` with mocked parse HTML: table coordinate extraction; full-table `{}` mode shape.
- Template discovery limits: first matching `el-conjug-*` vs multiple templates on lexeme (document which wins).

### 13.9 Formatter

- **`formatFetchResult`:** notes block, empty lexemes, homonym group boundaries (consecutive-only rule).
- **Morph line merge helpers:** `expandDualPersonInflectionLine` vectors from `form-of-display-and-mediawiki-parse.md`.
- **Regression:** `GroupedLexemeResults` / wrapper row formatting branch in `format()` (§3b array path).

### 13.10 Library wrappers

- **Type-level tests** (e.g. `expectTypeOf`) ensuring wrappers return `GroupedLexemeResults` where spec says so.
- **`lemma()` priority:** INFLECTED_FORM vs LEXEME vs diacritic-insensitive cases with mocked `wiktionary`.
- **`richEntry()`:** two `wiktionary` calls and `lemma_triggered_by_lexeme_id` attachment logic.

### 13.11 `src/convenience/wrapper-invoke.ts`

- Extend `cli-combinatorics` or dedicated tests for **every** special-case branch (`translate`, `wikipediaLink`, `isInstance`, `conjugate`, `hyphenate`, default).

### 13.12 Webapp (component / e2e optional)

- **`FormOfLexemeBlock`:** effect cleanup prevents state update after unmount (React Testing Library).
- **Popstate:** after navigation, either assert refetch or document intentional behaviour with a test that locks current semantics.
- **Playground:** `handleApiExecute` invalid JSON path returns `{ error: 'Invalid JSON' }`.

### 13.13 Server

- Missing `query` → 400.
- `format=yaml` content-type.
- When extended: parity params with CLI.

### 13.14 Schema

- Whenever **`src/model/`** changes, keep **JSON Schema + docs/schemata** in lockstep (`AGENTS.md`); CI runs **`check:schema-artifact`** after YAML edits.

---

## 14. Conclusion

The codebase is **coherent and well documented** relative to typical open-source extraction projects. After the modular `src/` layout, the main engineering debt is **residual layering** (present → convenience type imports), **registry/order discipline** (still large), **operational hardening** (timeouts, cache parse safety, optional queue bounds), and **sharp typing/UX edges** (wrapper return types vs `GroupedLexemeResults`, URL popstate). Addressing these with the test matrix above would make further refactors **mechanical and reversible** while preserving the project’s source-faithful contract.

---

*End of audit.*
