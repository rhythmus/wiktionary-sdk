# Test suite guide

This document explains how tests are organized, how to mock Wiktionary/Wikidata access without live HTTP, and how to extend the suite safely.

## Scripts (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm test` / `npm run test:ci` / `npm run test:unit` | Default **offline** suite (excludes `test/bench.test.ts`). |
| `npm run test:perf` | Parser **wall-clock** checks in `test/bench.test.ts` only. |
| `npm run test:all` | Default suite **then** perf tests. |
| `npm run test:network` | Runs `test/network-replay.test.ts` with **`WIKT_TEST_LIVE=1`** so the optional live `en.wiktionary.org` check executes (still runs the offline JSON replay first). |
| `npm run refresh-recording` | Optional: `tsx tools/refresh-api-recording.ts [title]` to refresh `test/fixtures/api-recordings/minimal-query.json` from the API (review diff before commit). |

## Mocking: prefer stubbing `src/api`

The engine reaches the network through **`fetchWikitextEnWiktionary`**, **`fetchWikidataEntity`**, and **`mwFetchJson`** in `src/api.ts`.

**Recommended pattern** for end-to-end extraction tests:

1. `vi.mock("../src/api", async (importOriginal) => ({ ...await importOriginal(), fetchWikitextEnWiktionary: vi.fn(), fetchWikidataEntity: vi.fn(), ... }))`
2. In `beforeEach`, set `fetchWikitextEnWiktionary` to return `{ exists, title, wikitext, ... }` with **`wikitext` loaded from `test/fixtures/*.wikitext`** (or inline strings).
3. Set `fetchWikidataEntity` to `mockResolvedValue(null)` when `enrich` would run.

Then call the **real** `wiktionary()` so the parser and registry run on real wikitext.

### Partial `vi.mock("../src/index")` caveat

Replacing only the exported `wiktionary` with `vi.fn()` updates imports from `index` in **that** module graph, but **`library.ts`** (and similar) also does `import { wiktionary } from "./index"`. Depending on load order, that binding can still be the **real** implementation, which will call the API unless **`api` is mocked**.

So: either mock **`api`** as above, or avoid calling **`lemma`**, **`interwiki`**, **`pageMetadata`**, etc. unless you know the binding is safe.

## Golden snapshots

`test/golden/entry-snapshots.test.ts` runs **`wiktionary`** on selected fixtures (API mocked) and compares a **stable projection** of LEXEME / INFLECTED_FORM fields to snapshots in `test/golden/__snapshots__/`.

When you **intentionally** change extraction output:

```bash
npx vitest run test/golden/entry-snapshots.test.ts -u
```

Review the `.snap` diff in the PR.

## Decoder coverage

`test/decoder-coverage.test.ts` requires every registered decoder (by **`id`**) to have evidence in **`test/**/*.ts`**, **`test/**/*.wikitext`**, or **`test/**/*.json`**: either a handled template name appears as `{{template…` in that corpus, or the decoder is listed in **`DECODER_EVIDENCE_ALLOWLIST`** (with a short comment). Add real fixtures instead of allowlisting when possible.

## Parser invariants

`test/parser.invariants.test.ts` checks structural properties of **`parseTemplates(..., true)`** (raw slices, non-overlap, nesting). It does not assert linguistic correctness.

## Offline API replay

- **`test/fixtures/api-recordings/minimal-query.json`** — synthetic MediaWiki `query` JSON.
- **`test/network-replay.test.ts`** — asserts **`normalizeWiktionaryQueryPage`** (exported from `src/api.ts`) matches the shape used by **`fetchWikitextEnWiktionary`**.
- **Live block** — skipped unless `WIKT_TEST_LIVE` is set (`npm run test:network`).

## Performance tests

`test/bench.test.ts` uses **wall-clock** averages. Under **`CI`**, thresholds are relaxed (`PERF_SLACK`) to reduce flakes on shared runners. Tight checks still apply locally.
