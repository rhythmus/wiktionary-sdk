# Test suite guide

This document explains how tests are organized, how to mock Wiktionary/Wikidata access without live HTTP, and how to extend the suite safely.

## Scripts (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm test` / `npm run test:ci` / `npm run test:unit` | Default **offline** suite (excludes `test/bench.test.ts`). |
| `npm run check:types-schema-sync` | Runs parity checks for `PartOfSpeech` enum/schema sync and grouped-wrapper type shape tests. |
| `npm run test:perf` | Parser **wall-clock** checks in `test/bench.test.ts` only. |
| `npm run test:all` | Default suite **then** perf tests. |
| `npm run test:network` | Runs `test/network-replay.test.ts` with **`WIKT_TEST_LIVE=1`** so the optional live `en.wiktionary.org` check executes (still runs the offline JSON replay first). |
| `npm run refresh-recording` | Optional: `tsx tools/refresh-api-recording.ts [title]` to refresh `test/fixtures/api-recordings/minimal-query.json` from the API (review diff before commit). |
| `npm run report:form-of` | Optional (network): `tsx tools/form-of-template-report.ts` — compares en.wiktionary Category:Form-of templates to `isFormOfTemplateName()`; writes `tools/form-of-template-report.md`. |

### `test:network` on Windows / CI shells

`npm run test:network` is portable, but if you need to run the env-gated test directly:

- **bash/zsh**: `WIKT_TEST_LIVE=1 vitest run test/network-replay.test.ts`
- **PowerShell**: `$env:WIKT_TEST_LIVE=1; vitest run test/network-replay.test.ts`
- **cmd.exe**: `set WIKT_TEST_LIVE=1 && vitest run test/network-replay.test.ts`

## Mocking: prefer stubbing `src/api`

The engine reaches the network through **`fetchWikitextEnWiktionary`**, **`fetchWikidataEntity`**, and **`mwFetchJson`** in `src/api.ts`.

**Recommended pattern** for end-to-end extraction tests:

1. `vi.mock("../src/api", async (importOriginal) => ({ ...await importOriginal(), fetchWikitextEnWiktionary: vi.fn(), fetchWikidataEntity: vi.fn(), ... }))`
2. In `beforeEach`, set `fetchWikitextEnWiktionary` to return `{ exists, title, wikitext, ... }` with **`wikitext` loaded from `test/fixtures/*.wikitext`** (or inline strings).
3. Set `fetchWikidataEntity` to `mockResolvedValue(null)` when `enrich` would run.

Then call the **real** `wiktionary()` so the parser and registry run on real wikitext.

### Stubbing `wiktionary` in convenience tests

**`src/convenience/*.ts`** (wrappers, **`morphology.ts`**, **`stem.ts`**) import **`wiktionary`** from **`pipeline/wiktionary-core.ts`**. To replace it with `vi.fn()`, use:

`vi.mock("../src/pipeline/wiktionary-core", async (importOriginal) => ({ ...(await importOriginal()), wiktionary: vi.fn() }))`

Tests that import **`wiktionary`** from **`index.ts`** can still **`vi.mock("../src/index", …)`** when they only use the barrel export (e.g. **`enrichment.test.ts`**). Prefer mocking **`api`** for orchestration tests that should run the **real** engine on fixtures.

## Golden snapshots

`test/golden/entry-snapshots.test.ts` runs **`wiktionary`** on selected fixtures (API mocked) and compares a **stable projection** of LEXEME / INFLECTED_FORM fields to snapshots in `test/golden/__snapshots__/`.

Current golden fixture set includes:

- `basic-verb`
- `form-of-inflected` (INFLECTED_FORM projection)
- `γράφω`
- `nested-templates`
- `translations-multi`
- `nested-pipe-bug`

When you **intentionally** change extraction output:

```bash
npx vitest run test/golden/entry-snapshots.test.ts -u
```

Review the `.snap` diff in the PR.

## Decoder coverage

`test/decoder-coverage.test.ts` requires every registered decoder (by **`id`**) to have evidence in **`test/**/*.ts`**, **`test/**/*.wikitext`**, or **`test/**/*.json`**: either a handled template name appears as `{{template…` in that corpus, or the decoder is listed in **`DECODER_EVIDENCE_ALLOWLIST`** (with a short comment). Add real fixtures instead of allowlisting when possible.

**Duplicate `id` values are invalid**: the coverage test deduplicates by `id`, so a second decoder with the same `id` is never checked for evidence and can mask missing fixtures. **`test/registry-ids.test.ts`** fails if any decoder `id` appears more than once in `registry.getDecoders()`.

**Registration order** is locked by **`test/registry-decoder-order.test.ts`** (canonical `id` sequence; update when adding a decoder — see **`docs/registry-inventory.md`**).

## Audit regression suites (`*-audit.test.ts`)

Targeted tests that lock in expectations from **`audit.md`** (architecture,
orchestration, REST surface, parser/registry edges) without inflating the main
feature tests:

- **`orchestration-audit.test.ts`** — `wiktionary()` / fuzzy / `debugDecoders` padding behaviour.
- **`api-fetch-audit.test.ts`** — MediaWiki client shapes used by the engine.
- **`wrapper-invoke-audit.test.ts`** — `invokeWrapperMethod` argument wiring.
- **`server-fetch-audit.test.ts`** — `buildApiFetchResponse()` status, YAML `Content-Type`, injectable `wiktionaryFn`.
- **`parser-audit.test.ts`**, **`registry-markup-formof-audit.test.ts`** — parser + registry invariants tied to audit notes.
- **`formatter-audit.test.ts`**, **`form-of-parse-enrich-audit.test.ts`**, **`morphology-tags-audit.test.ts`**, **`library-audit.test.ts`** — presentation and enrichment boundaries.
- **`types-grouped-results.test.ts`** — `GroupedLexemeResults` typing expectations.

## Webapp component tests (jsdom + RTL)

**`test/webapp/*.test.ts(x)`** run under **`@vitest-environment jsdom`** with
**`@testing-library/react`** and **`@testing-library/jest-dom`**. Shared setup:
**`test/vitest-setup.ts`** (jest-dom matchers, RTL `cleanup` after each test).
**`vitest.config.ts`** dedupes `react` / `react-dom` and includes `*.test.tsx`.

Modules under test mirror extractions from **`webapp/src/App.tsx`**:
**`FormOfLexemeBlock`**, **`usePopstateQuerySync`**, **`runPlaygroundApiExecute`**.

## Interface + contract hardening suites

- **`test/integration-adapters.test.ts`** validates formatter handling of wrapper-row arrays and SDK/Webapp API method parity.
- **`test/integration-hardening.test.ts`** covers rare PoS heading normalization, formatter sparse-data behavior, and CLI wrapper-route contracts.
- **`test/translate-lemma-integration.test.ts`** fixture-backed lemma resolution and `translate(..., { mode: "gloss" })` flow from inflected query to lemma-page translations.
- **`test/cross-interface-parity.test.ts`** enforces shared invocation semantics across SDK direct calls, CLI extract routing, and webapp playground routing.
- **`test/cli-combinatorics-generator.test.ts`** runs a generated wrapper/argument matrix to catch signature drift as wrappers evolve.
- **`test/fallback-enrichment-matrix.test.ts`** asserts QID enrichment fallback order (pageprops -> Wiktionary title -> Wikipedia title -> no enrichment).
- **`test/negative-schema-hardening.test.ts`** asserts malformed payloads are rejected by `schema/normalized-entry.schema.json` (generated from `schema/src/*.yaml`; `npm run test:ci` runs `check:schema-artifact` so the JSON matches the YAML).

## Library wrapper coverage matrix

`test/library.test.ts` intentionally mixes fixture-backed and synthetic assertions.
This matrix is the source of truth for which wrapper groups are currently
fixture-backed versus mock-result-only.

| Wrapper group | Coverage mode | Notes |
|---|---|---|
| `translate` (gloss path) | fixture-backed | Uses fixture-derived pipeline execution. |
| `translate` (`mode: "senses"`, target `en`) | fixture-backed | Uses fixture-derived lemma page senses. |
| `translate` (`mode: "senses"`, non-`en`) | mock-result-only | Locks explicit native-senses scrape branch shape. |
| `lemma` | fixture-backed | Inflected-to-lemma resolution from fixtures. |
| `synonyms`, `antonyms` | fixture-backed | Real extraction from Greek verb fixtures. |
| `ipa`, `phonetic` | fixture-backed | Fixture-backed pronunciation extraction. |
| `hyphenate` | fixture-backed | Covers string and array output modes. |
| `partOfSpeech`, `usageNotes` | fixture-backed | Baseline lexical boundary assertions. |
| `etymology` | fixture-backed | Inflected-to-lemma chain path from fixtures. |
| `derivedTerms` / `derivations`, `relatedTerms`, `hypernyms`, `hyponyms` | mock-result-only | Current fixtures do not provide stable arrays for these exact assertions. |
| `pronounce` audio URL prioritization | mock-result-only | Requires explicit synthetic media payload. |
| `wikidataQid`, `image`, `wikipediaLink` | mock-result-only | Requires synthetic entity/media payload shapes. |

## Parser invariants

`test/parser.invariants.test.ts` checks structural properties of **`parseTemplates(..., true)`** (raw slices, non-overlap, nesting). It does not assert linguistic correctness.

## Offline API replay

- **`test/fixtures/api-recordings/minimal-query.json`** — synthetic MediaWiki `query` JSON.
- **`test/network-replay.test.ts`** — asserts **`normalizeWiktionaryQueryPage`** (exported from `src/api.ts`) matches the shape used by **`fetchWikitextEnWiktionary`**.
- **Live block** — skipped unless `WIKT_TEST_LIVE` is set (`npm run test:network`).

### Refresh recording checklist (`npm run refresh-recording`)

When updating `test/fixtures/api-recordings/minimal-query.json`:

1. Keep the fixture minimal (single title path; avoid broad captures).
2. Verify no secrets/tokens/headers are introduced.
3. Check that text stays NFC-normalized (no accidental Unicode drift).
4. Review diff size and structure; avoid unrelated fixture churn.
5. Re-run `npm run test -- test/network-replay.test.ts` before committing.

## Performance tests

`test/bench.test.ts` uses **wall-clock** averages. Under **`CI`**, thresholds are relaxed (`PERF_SLACK`) to reduce flakes on shared runners. Tight checks still apply locally.
