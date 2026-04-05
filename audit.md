# Wiktionary SDK — Codebase audit (read-only)

**Date:** 2026-04-04  
**Scope:** Documentation in `docs/` (full read of normative and supporting docs; chat-history logs treated as non-normative archives), core `src/`, `webapp/src/`, `cli/`, `server.ts`, `test/`, and `tools/`.  
**Constraint:** This report does not change runtime behaviour; it records findings and recommendations for future refactors.

---

## 1. Executive summary

The project delivers a **source-faithful** Wiktionary extraction pipeline with a clear split between **orchestration** (`src/index.ts`), **parsing** (`src/parser.ts`), **decoding** (`src/registry.ts`), **I/O** (`src/api.ts`, cache, rate limiter), **presentation** (`src/formatter.ts` + bundled Handlebars/CSS), and **consumers** (CLI, webapp, HTTP server). The written specification (`docs/wiktionary-sdk-spec.md` v3.3) is unusually well aligned with the implementation and explicitly calls out known edges (lemma cycles, fuzzy merge, form-of Lua vs wikitext, REST parity gaps).

Main risks for maintainability and robustness:

1. **Module cycles** (`index` ↔ `library` ↔ `index`, plus `morphology`/`stem` → `library` + `index`, and `form-of-parse-enrich` → `formatter` → `library`/`morphology`) — workable today but fragile for tree-shaking, static analysis, and test doubles.
2. **`registry.ts` as a megamodule** — thousands of lines mixing predicates, gloss/sense parsing, section extraction, and dozens of decoders; high merge-conflict and registration-order sensitivity (already documented in `AGENTS.md`).
3. **No network timeouts or abort** on `fetch()` in `mwFetchJson` — hung requests can stall callers indefinitely; rate limiter queues can grow without bound under burst concurrency.
4. **Concrete bugs / sharp edges:** shared-array reference when padding `debug` for resolved lemma lexemes; several **public TypeScript return types** on wrappers that do not match the actual `GroupedLexemeResults` shape; webapp **popstate** updates query state without refetching.
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
| `docs/STAGED_IMPLEMENTATION_PLAN.md` | Remaining work: audit-aligned phases 0–10, product phases 8–10; delivered history in `CHANGELOG.md`. |
| `docs/TEXT_TO_DICTIONARY_PLAN.md` | Consumer-layer vision; marks Wikidata SPARQL as aspirational — not implemented in core SDK path. |
| `docs/wiktionary_morphology_engine.md` | Context for Lua/Scribunto; aligns with `morphology.ts` parse fallback. |
| `docs/Prior and Related Work.md` | Background (if present in tree). |
| `test/README.md` / `AGENTS.md` | Operational rules for agents and tests (mock `api`, not partial `index` mocks). |

### 2.2 Alignment notes

- **REST server** (`server.ts`): Spec §11.1 correctly states limited query surface vs CLI/webapp (`matchMode`, `sort`, `debugDecoders`, true `pos` filter). Default `lang` is `el` on the server vs `"Auto"` in `wiktionary()` — intentional mismatch worth centralizing in one “defaults” module when refactoring.
- **Schema version:** Spec and `SCHEMA_VERSION` in `src/types.ts` remain `3.0.0` while spec revision is `v3.3` — version axes are documented but easy to confuse; a table in README linking “spec revision / npm version / SCHEMA_VERSION” would reduce support noise (documentation-only recommendation).
- **Chat exports under `docs/AI agents chat history/`:** Historical; not treated as product requirements.

---

## 3. Architecture, separation of concerns, folder layout

### 3.1 Strengths

- **Core engine** is mostly environment-agnostic; templates are bundled in `src/templates/templates.ts` per `AGENTS.md` (no runtime `fs` for HTML/CSS in consumers).
- **PoS-boundary rule** in `splitEtymologiesAndPOS()` is the correct answer to the “flat heading” problem; spec §4.2 matches code.
- **Wrapper invocation** is centralized in `src/wrapper-invoke.ts` and reused by CLI and webapp — good defence against signature drift.
- **Formatter** separates Handlebars/CSS from extraction; `lexeme-display-groups.ts` keeps homonym merge **display-only**, preserving normalized `lexemes[]` API (spec §12.10.6).

### 3.2 Weaknesses

- **`registry.ts` concentration:** Template decoders, `stripWikiMarkup`, sense parsing, section helpers, form-of predicates, and merge behaviour live in one file. This violates “single responsibility” and increases the cost of safe refactors. A future split (e.g. `registry-core.ts`, `decoders/pronunciation.ts`, `decoders/form-of.ts`, `decoders/senses.ts`) would improve navigation; registration order must remain explicit and tested.
- **`formatter.ts` imports presentation helpers used by enrichment:** `form-of-parse-enrich.ts` imports `expandDualPersonInflectionLine`, `formOfMorphLinesAreAbbrevTokensOnly`, and `inflectionMorphDisplayLines` from `formatter.ts`. That creates a **dependency from extraction-adjacent enrichment → formatter**, while `formatter` already depends on `morphology` and `library` types. For a stricter DAG, move morph-line utilities to a small neutral module (e.g. `src/form-of-display.ts`) imported by both `formatter` and `form-of-parse-enrich`.
- **`library.ts` mixed responsibilities:** High-level wrappers, `RichEntry` assembly, `getNativeSenses` (foreign wiki fetch + heuristic headers), and re-exports of morphology/stem behaviour. Splitting “network convenience API” from “pure projections on `FetchResult`” would clarify testing boundaries.

### 3.3 UI vs logic vs styling (webapp)

- **`App.tsx` is very large** (~1500+ lines): search, comparison mode, YAML inspector, debugger, playground triple-window, URL sync, and layout logic interleave. Extracting hooks (`useWiktionarySearch`, `useUrlQuery`, `usePlaygroundApi`) and presentational components would improve readability and testability without changing behaviour.
- **Styling** has moved toward `webapp/src/index.css` with semantic classes (per spec roadmap notes); remaining inline concerns are mostly dynamic or third-party (framer-motion).
- **`dangerouslySetInnerHTML`:** Used for formatted entry HTML and terminal-html preview — appropriate given Handlebars output; ensure any future user-controlled strings never flow into templates without escaping (current data is SDK-derived, not arbitrary HTML).

---

## 4. Circular dependencies and module graph

Observed edges:

```
index.ts  → library.ts (re-export)
library.ts → index.ts (wiktionary)
morphology.ts → library.ts + index.ts
stem.ts → library.ts + index.ts
formatter.ts → library.ts (type: EtymologyStep), morphology.ts
form-of-parse-enrich.ts → formatter.ts (+ api, registry)
index.ts → form-of-parse-enrich.ts
```

**Why it works:** ESM evaluation binds `wiktionary` after `index` finishes initializing exports; the spec even warns about partial `vi.mock("../src/index")` not replacing the binding inside `library.ts`.

**Risks:**

- Refactors that add **top-level side effects** or **cyclic type-only imports** can cause TDZ or undefined bindings in some bundlers or test runners.
- **Tree-shaking / dead-code elimination** may be suboptimal when everything re-exports through `index.ts`.

**Refactor direction (behaviour-preserving):**

- Introduce `src/wiktionary-core.ts` (or `fetch-engine.ts`) exporting `wiktionary` / `wiktionaryRecursive` with **no** re-exports of `library` or `formatter`.
- Let `library.ts` import from `wiktionary-core`, not `index`.
- Keep `index.ts` as a thin **barrel** that re-exports public API.

---

## 5. Concurrency, timeouts, rate limiting, and “runaway” behaviour

### 5.1 `mwFetchJson` (`src/api.ts`)

- Uses global `fetch` with **no `AbortSignal`, no timeout**. A slow or stuck MediaWiki response blocks the caller until the platform gives up.
- **Recommendation:** Optional `timeoutMs` (or caller-supplied `signal`) with `AbortController` + `fetch`; document default for CLI/server vs browser.

### 5.2 Rate limiter (`src/rate-limiter.ts`)

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

### 6.1 `TieredCache` (`src/cache.ts`)

- L1 `MemoryCache` grows with distinct keys; **no max size eviction** (TTL only). Long-running CLI batches or servers with huge title diversity can grow memory without bound.
- `get()` uses `JSON.parse` without **try/catch**; corrupted L2/L3 string values could throw and abort a fetch pipeline. Hardening: catch, delete key, miss as cache miss.

### 6.2 React lifecycle

- `matchMedia` listener in `App.tsx` is correctly removed on unmount.
- `popstate` listener removed on unmount — good.
- Lemma resolve effects use `cancelled` flag — good pattern.

---

## 7. Bugs, correctness risks, and spec-adjacent issues

### 7.1 Debug array padding — shared reference bug

In `src/index.ts`, when `debugDecoders` is true:

```ts
out.debug = allDebugEvents.concat(Array(resolvedLexemes.length).fill([]));
```

`Array.prototype.fill` with an object reuses **the same array instance** for every slot. Mutating one resolved-lexeme debug row could **alias** all others. Fix (when allowed to change code): `Array.from({ length: n }, () => [])`.

### 7.2 Fuzzy mode + `debugDecoders`

- Merged lexemes dedupe by `id`; `debug` rows are pushed in merge order with `debugRows[idx] ?? []`. If deduplication skips lexemes, **debug alignment with `lexemes[i]`** may be off in edge cases. Worth a dedicated test matrix (strict vs fuzzy, duplicate ids across variants).

### 7.3 Type annotations vs runtime shape (`src/library.ts`)

- Many async wrappers return `mapLexemes(...)`, which produces **`GroupedLexemeResults<T>`** (array + `order` + `lexemes`), but signatures often say `Promise<LexemeResult<T>[]>`. TypeScript structural typing may still accept this in some directions, but **consumers reading `.d.ts` files** get wrong guidance. Align declarations with `GroupedLexemeResults<T>` (spec §12.26 / §3.9).
- `translate()` return type is correctly `GroupedLexemeResults<string[]>`; **synonyms/antonyms/…** should match for consistency.

### 7.4 `morphology.ts` `extractMorphologyFromLexeme`

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
- **`console.error` in library** for `getNativeSenses` failures (`[lightweight-scraper]` prefix): legacy naming; consider structured logging hook or silent return with optional `onError` callback for library consumers.
- **Tools and CLI `console.log`:** Appropriate for CLI UX; not an issue.
- **Duplicate concepts:** `LANG_PRIORITY` inline in `index.ts` vs roadmap mentions of configurability — centralize constant when touching that code path.

---

## 9. Naming consistency

- Mixed **camelCase** file names vs **kebab-case** docs — acceptable.
- **`phonetic` vs `ipa`, `derivations` vs `derivedTerms`, `audioDetails` vs `audioGallery`:** Aliases documented in spec §12.19; keep but consider deprecation warnings in JSDoc only (no runtime change).
- **“lightweight-scraper”** log tag in `library.ts` does not match product name “Wiktionary SDK”.

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

1. **Split `registry.ts`** into logical modules + single `registerAll()` to preserve order.
2. **Break the `index` ↔ `library` cycle** via `wiktionary-core` module.
3. **Extract `form-of-display` helpers** from `formatter.ts` for shared use with `form-of-parse-enrich.ts`.
4. **Centralize defaults:** `LANG_PRIORITY`, API default languages (server vs library), rate-limit defaults, cache TTL in one `src/constants.ts` or config object.
5. **Thin `App.tsx`:** hooks + subcomponents; keep props identical to preserve UI.
6. **Optional concurrency primitives:** shared `parallelMap(items, limit, fn)` for lemma batch and form-of parse batch.
7. **Fetcher abstraction:** single place for timeout, retries (if ever added), and metrics.

---

## 13. Unit and integration tests to add or strengthen

Existing coverage (goldens, decoder coverage, registry ids, parser invariants, wrapper contract, cross-interface parity, fallback enrichment matrix, negative schema, integration adapters) is a solid baseline. For a **heavy refactor**, prioritize:

### 13.1 Orchestration (`index.ts`)

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

### 13.11 `wrapper-invoke.ts`

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

- Whenever `types.ts` changes, keep **JSON Schema + docs/schemata** in lockstep (already a project rule); add CI assertion script if not present.

---

## 14. Conclusion

The codebase is **coherent and well documented** relative to typical open-source extraction projects. The main engineering debt is **graph complexity** (cycles and god-module registry), **operational hardening** (timeouts, cache parse safety, optional queue bounds), and a few **sharp correctness/typing edges** (debug `fill`, wrapper return types, URL popstate). Addressing these with the test matrix above would make a large refactor **mechanical and reversible** while preserving the project’s source-faithful contract.

---

*End of audit.*
