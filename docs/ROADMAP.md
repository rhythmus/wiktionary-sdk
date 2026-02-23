# WiktionaryFetch: Exhaustive Implementation Roadmap

This document outlines the detailed, staged evolution of the WiktionaryFetch engine, transitioning from a v1.0 Alpha to a production-grade, 100% coverage extraction ecosystem for Greek lexicographic data.

---

## 🏛️ Phase 1: DX, Quality & Observability
**Goal**: Stabilize the existing engine and provide developers with tools to debug and verify extraction logic deterministically.

### 1.1 Developer Inspector UI
- **Status**: **DONE** (Implemented as a premium React dashboard in `/webapp`).
- **Details**: Real-time inspection of matched decoders, extracted fields, and raw wikitext.

### 1.2 Library Modularization
- **Status**: **DONE** (Core logic extracted into `/src`).
- **Details**: Tree-shakeable TypeScript modules for API, Parser, Registry, and Utils.

### 1.3 JSON Schema & Versioning
- **Status**: **DONE**.
- **Delivered**:
    - `schema/normalized-entry.schema.json` — formal JSON Schema (draft-07) describing the full output shape: `Entry`, `FetchResult`, `Pronunciation`, `Hyphenation`, `WiktionarySource`, `WikidataEnrichment`, `FormOf`, `TranslationItem`, `StoredTemplate`, plus forward-compatible Phase 2 definitions (`Sense`, `SemanticRelations`, `EtymologyData`).
    - `VERSIONING.md` — documents semantic versioning policy for the output format (MAJOR/MINOR/PATCH) with a changelog.
    - `SCHEMA_VERSION` constant exported from `src/types.ts` (currently `"1.0.0"`).

### 1.4 Gold Standard Test Suite
- **Status**: **DONE**.
- **Delivered**:
    - Vitest test runner configured at repo root (`vitest.config.ts`, `npm run test`).
    - 62 tests across 6 test files, all passing:
        - `test/parser.test.ts` — 17 unit tests for template parsing, language section extraction, etymology/POS splitting, heading mapping, pipe splitting.
        - `test/registry.test.ts` — 10 tests for decoder registry behaviour (raw template storage, IPA, headword templates, form-of, hyphenation).
        - `test/schema.test.ts` — 4 JSON Schema validation tests using AJV (valid FetchResult, pronunciation, inflected form, rejection of incomplete data).
        - `test/phase2.test.ts` — 18 tests covering senses, semantic relations, etymology, pronunciation, and usage notes decoders.
        - `test/phase3.test.ts` — 11 tests for MemoryCache, TieredCache, and RateLimiter.
        - `test/bench.test.ts` — 2 performance assertion tests (sub-10ms parser, sub-1ms section extraction).

---

## 🧠 Phase 2: Semantic & Linguistic Depth
**Goal**: Extract deeper structural meaning from entries without crossing into linguistic inference.

### 2.1 Sense-Level Structuring
- **Status**: **DONE**.
- **Delivered**: `parseSenses()` function and `senses` decoder in `src/registry.ts`. Parses `#` lines into `Sense` objects with unique IDs (`S1`, `S2`, ...), `##` lines into nested `subsenses` (`S1.1`, `S1.2`, ...), and `#:` lines into `examples`. Wiki markup (`[[links]]`, `'''bold'''`, `''italic''`, templates) is stripped from glosses. New `Sense` interface added to `src/types.ts`.

### 2.2 Semantic Relations
- **Status**: **DONE**.
- **Delivered**: Decoder in `src/registry.ts` for `{{syn}}`, `{{ant}}`, `{{hyper}}`, `{{hypo}}` templates. Outputs structured `SemanticRelations` object with `synonyms`, `antonyms`, `hypernyms`, `hyponyms` arrays. Each relation captures `term`, optional `sense_id`, and optional `qualifier`. New `SemanticRelation` and `SemanticRelations` interfaces in `src/types.ts`.

### 2.3 Structured Etymology & Cognates
- **Status**: **DONE**.
- **Delivered**: Decoder for `{{inh}}`, `{{der}}`, `{{bor}}`, `{{cog}}` (and their long-form aliases `inherited`, `derived`, `borrowed`, `cognate`). Correctly handles the parameter offset between `cog` (source lang at pos[0]) and the others (target lang at pos[0], source lang at pos[1]). Captures `source_lang`, `term`, `gloss` (from `t=` named param or positional), and `raw`. New `EtymologyLink` and `EtymologyData` interfaces in `src/types.ts`.

### 2.4 Advanced Pronunciation (IPA/Audio)
- **Status**: **DONE**.
- **Delivered**: Two new decoders alongside the existing `IPA` decoder:
    - `el-ipa` — decodes `{{el-IPA}}` template (Greek-specific pronunciation).
    - `audio` — decodes `{{audio}}` template, extracting the audio filename.

### 2.5 Usage Notes & Inflection Notes
- **Status**: **DONE**.
- **Delivered**: Decoder that locates `===Usage notes===` sections in the POS block wikitext, extracts bullet-pointed or plain text lines, and stores them as `usage_notes: string[]` on the `Entry`. Stops at the next section heading. New `usage_notes` field in `Entry` interface.

---

## 🚀 Phase 3: Total Coverage & Scalability
**Goal**: Move from selective template support to exhaustive coverage and production reliability.

### 3.1 Template Introspection Engine (Auto-Discovery)
- **Status**: **DONE**.
- **Delivered**: `tools/template-introspect.ts` — a standalone script (runnable via `npm run introspect`) that:
    - Crawls `Category:Greek headword-line templates` and `Category:Greek inflection-table templates` on en.wiktionary.org via the MediaWiki API.
    - Cross-references discovered templates against the registered decoders in the registry.
    - Produces a **Missing Decoder Report** in markdown or JSON format, showing coverage percentage and listing all missing templates.
    - Supports `--category <name>` and `--json` flags.

### 3.2 Production Caching Layer
- **Status**: **DONE**.
- **Delivered**: `src/cache.ts` implementing a multi-tier cache architecture:
    - `MemoryCache` — L1 in-memory cache with TTL-based expiration.
    - `CacheAdapter` interface — pluggable contract for L2 (IndexedDB, SQLite) and L3 (Redis) backends.
    - `TieredCache` — orchestrator that tries L1 -> L2 -> L3 on reads and writes to all tiers, with automatic promotion of L2/L3 hits into L1.
    - `getCache()` / `configureCache()` — global singleton management.
    - Integrated into `src/api.ts`: both `fetchWikitextEnWiktionary()` and `fetchWikidataEntity()` now cache successful responses automatically.

### 3.3 Rate Limiting & Proxy Management
- **Status**: **DONE**.
- **Delivered**: `src/rate-limiter.ts` implementing:
    - Request throttling with configurable minimum interval (default 100ms / 10 req/s per Wikimedia guidelines).
    - Custom `User-Agent` header (`WiktionaryFetch/1.0`).
    - Optional `proxyUrl` configuration for high-volume batch processing.
    - `getRateLimiter()` / `configureRateLimiter()` — global singleton management.
    - Integrated into `mwFetchJson()` in `src/api.ts`: every API request is throttled and uses the configured User-Agent.

---

## 🌐 Phase 4: Multi-Client & Distribution
**Goal**: Broaden the reach of the engine through diverse consumption patterns.

### 4.1 CLI Tool (`cli/`)
- **Status**: **DONE**.
- **Delivered**: `cli/index.ts` — a full-featured CLI (runnable via `npm run cli` or `npx tsx cli/index.ts`):
    - `wiktionary-fetch <term> --lang=el --format=yaml` — single-term lookup.
    - `--batch <file>` — batch processing from CSV (one term per line) or JSON array files.
    - `--output <file>` — write results to file instead of stdout.
    - `--pos`, `--no-enrich`, `--format json|yaml` — all engine options exposed.
    - `--help` — full usage documentation.

### 4.2 NPM Package Distribution
- **Status**: **DONE**.
- **Delivered**: Dual ESM/CJS build pipeline:
    - `tsconfig.json` — ESM output to `dist/esm/`.
    - `tsconfig.cjs.json` — CJS output to `dist/cjs/`.
    - `package.json` `exports` field with proper condition ordering (`types` -> `import` -> `require`).
    - `files` whitelist (`dist`, `schema`, `VERSIONING.md`) for clean publishing.
    - `npm run build` compiles both targets.

### 4.3 Containerization
- **Status**: **DONE**.
- **Delivered**:
    - `server.ts` — lightweight HTTP API wrapper using Node.js built-in `http` module (no Express dependency). Endpoints: `GET /api/fetch?query=...&lang=...&format=...`, `GET /api/health`. CORS enabled.
    - `Dockerfile` — multi-stage build on `node:22-alpine` (builder stage compiles TypeScript, production stage copies only `dist/` and `schema/`).
    - `.dockerignore` — excludes `node_modules`, `webapp`, `docs`, `test`, etc.
    - `npm run serve` — runs the API server locally via tsx.

---

## ⚖️ Phase 5: Quality & Engineering Excellence
**Goal**: Ensure the library is robust, documented, and easy to maintain.

### 5.1 Automated API Documentation
- **Status**: **DONE**.
- **Delivered**: TypeDoc installed and configured. JSDoc comments added to key exported functions and interfaces (`fetchWiktionary`, `Entry`, `FetchResult`, `SCHEMA_VERSION`). `npm run docs` generates static HTML documentation to `docs/api/`.

### 5.2 Benchmarking & Optimization
- **Status**: **DONE**.
- **Delivered**:
    - `test/bench.bench.ts` — Vitest benchmark file (`npm run bench`) with benchmarks for `parseTemplates`, `extractLanguageSection`, and `splitEtymologiesAndPOS` on large (5x repeated) realistic wikitext.
    - `test/bench.test.ts` — performance assertion tests: parser averages under 10ms per run on large entries (100 iterations), language section extraction averages under 1ms (1000 iterations). Both assertions pass.

---

## 🎨 Phase 6: Webapp Polish & Evolution
**Goal**: Make the visual verification tool more powerful for linguistic research.

### 6.1 Interactive Template Inspector
- **Status**: **DONE**.
- **Delivered**: In `webapp/src/App.tsx`:
    - **Click-to-source**: Clicking any YAML key or template name in the right pane highlights all matching lines in the raw wikitext pane (amber highlight with left border).
    - **Debugger Mode**: Toggle via the bug icon in the header. When active, shows a table below the main panes listing every decoder match for the selected entry — template name, raw wikitext, and which output fields it produced. Clicking a row highlights the corresponding template in the wikitext pane.
    - **Entry selector**: Dropdown to switch between entries when multiple are returned.
    - Highlight can be dismissed via an X button.

### 6.2 Comparison View
- **Status**: **DONE**.
- **Delivered**: In `webapp/src/App.tsx`:
    - **Toggle**: Columns icon in the header enables comparison mode.
    - **Language selector**: Additional dropdown appears to pick a comparison language (filtered to exclude the primary language).
    - **Third pane**: Layout shifts to 3-column grid; the third pane shows the normalized YAML output for the same term in the comparison language, with a distinct emerald-accented border.
    - Both the primary and comparison fetch run in parallel on search.

---

## 📜 Instructions for Developers

### Core Principles
- **No Scraped HTML**: If the data isn't in the Wikitext/API, it doesn't exist for this engine.
- **No Linguistic Inference**: We extract *what is there*, not what *should be there*.
- **Traceability**: Every field in the `NormalizedEntry` must lead back to a source line or template.

### For AI Agents
- **Decoder Registry**: Always check `registry.ts` before adding new mapping logic. Keep decoders atomic.
- **Strict Typing**: Update `types.ts` before implementing new features to ensure contract consistency.
