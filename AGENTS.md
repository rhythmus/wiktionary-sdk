# AI Agent Onboarding & Technical Constraints

This document provides specialized context for AI coding assistants working on the `wiktionary-fetch` project.

---

## 🎯 Core Mission
**Source-faithful extraction over linguistic inference.**
We extract what is *explicitly* in the Wikitext. We do not guess stems, complete paradigms, or infer data not found in template parameters.

---

## 🏗️ Architectural Anchors

### 1. Registry-Based Decoders (`src/registry.ts`)
The engine is a decentralized registry of pure functions (`TemplateDecoder`). 
- **Pattern**: If a template exists in the wild, create a decoder for it.
- **Strict Rule**: Do not add mapping logic to the parser or orchestrator. Keep it in `registry.ts`.

### 2. Brace-Aware Parser (`src/parser.ts`)
A custom parser handles nested `{{...}}` structures. 
- **Context**: Standard regex is insufficient for Wikitext. Always use the provided parser to extract `TemplateCall` objects.

### 3. Entry Types (`src/types.ts`)
- `LEXEME`: A lemma (e.g., γράφω).
- `INFLECTED_FORM`: A specific form (e.g., έγραψε) that maps to a lemma.

### 4. Interface Synchronization (Public API Parity)
- **Strict Rule**: Any new convenience function added to `src/library.ts` MUST be immediately implemented in both:
    - `webapp/src/App.tsx`: Added to `API_METHODS` and `handleApiExecute`.
    - `cli/index.ts`: Added to the `extract` router in `main()`.
- **Reason**: To ensure that the Web API Playground and the terminal CLI are always on par with the underlying NPM package.

### 5. Schema Synchronization (High-Fidelity Parity)
- **Strict Rule**: Any change to the structure of `Entry`, `Sense`, `WikidataEnrichment`, or other core interfaces in `src/types.ts` MUST be reflected in:
    - `schema/normalized-entry.schema.json`: Update the JSON Schema to match the new structure.
    - `docs/schemata/*.yaml`: Update the reference YAML models (e.g., `DictionaryEntry.yaml`) to ensure documentation parity.
- **Reason**: To maintain the SDK's promise of a deterministic, machine-readable output that external consumers can rely on for validation.

---

## ⚖️ Rigid Constraints & "No Heuristics" Policy

1.  **No Scraping**: Never attempt to scrape the rendered Wiktionary HTML. Always use the MediaWiki API provided in `api.ts`.
2.  **No linguistic "Guessing"**: If a stem or gender is missing from a headword template, do not attempt to calculate it. Leave the field undefined.
3.  **Traceability**: Every field added to a `NormalizedEntry` must be traceable to a source line or template parameter.
4.  **Verbatim Storage**: All template calls must be stored verbatim in `entry.templates` for forensic verification.

---

## 🛠️ How to Add Support for a New Template

1.  **Identify**: Find the template on Wiktionary (e.g., `{{el-noun-m-ος-2}}`).
2.  **Define**: Update `types.ts` if a new PoS-specific interface is needed.
3.  **Implement**: Create a new `TemplateDecoder` in `registry.ts`.
4.  **Verify**: Run a search for a word using that template in the `/webapp` and inspect the YAML output.

---

## 🧪 Testing

See **[test/README.md](test/README.md)** for mocking rules, npm scripts (`test`, `test:perf`,
`test:all`, `test:network`), golden snapshots, and decoder coverage expectations.

---

## 📝 Commit Message Style

Follow this format consistently for all commits.

### Structure

```
<type>: <concise summary in lowercase imperative mood>

<body: what was done and why, wrapped at ~72 chars per line>
```

### Type Prefixes

| Prefix | Use when |
|--------|----------|
| `feat` | Adding or extending functionality (new decoders, new modules, new CLI flags, new UI features) |
| `fix` | Correcting a bug or incorrect behaviour |
| `refactor` | Restructuring code without changing behaviour (renames, moves, extractions) |
| `docs` | Documentation-only changes (README, spec, ROADMAP, AGENTS.md, comments) |
| `test` | Adding or updating tests without changing production code |
| `chore` | Tooling, CI, dependency bumps, config changes with no user-facing impact |

### Rules

1. **Subject line**: lowercase after the prefix colon, imperative mood ("add", not "added" or "adds"), no trailing period, ideally under 72 characters.
2. **Body**: separated from subject by a blank line. Describe *what* was delivered and *why*. Use plain sentences or a concise bulleted list. Name files, interfaces, and design choices where relevant. Wrap at ~72 characters.
3. **Scope tags** (e.g. `feat(parser):`) are not used in this project — keep it simple.
4. **Group logically**: one commit per cohesive unit of work (e.g. one ROADMAP phase, one feature area). Do not mix unrelated changes; do not split a single feature across many tiny commits.
5. **No noise**: do not commit generated files (`dist/`, `docs/api/`), secrets, or empty commits.

### Examples

```
feat: add multi-tier cache, rate limiter, and template introspection engine (Phase 3)

Add src/cache.ts: MemoryCache (L1) with TTL expiration, pluggable
CacheAdapter interface for L2/L3 backends, TieredCache orchestrator
with automatic promotion. Integrate caching into api.ts for both
Wiktionary and Wikidata fetch functions.

Add src/rate-limiter.ts: request throttling (default 100ms / 10 req/s
per Wikimedia guidelines), custom User-Agent header, optional proxy URL
for batch processing. Integrate into mwFetchJson().

Add tools/template-introspect.ts: crawls Greek template categories on
en.wiktionary.org, cross-references against registered decoders, and
produces a Missing Decoder Report in markdown or JSON format.

Includes 11 tests for cache and rate limiter.
```

```
docs: update README, spec, and ROADMAP to reflect all implemented phases

Rewrite README.md with updated architecture diagram, full project
structure, all npm scripts, Docker usage, decoder coverage table, and
schema versioning reference.

Update wiktionary-fetch-spec.md from v0.9 draft to v1.0.

Update ROADMAP.md: mark all 17 sub-tasks across 6 phases as DONE with
detailed Delivered sections.
```

---

## 📚 Essential Reading
- [Test suite guide](test/README.md) (mocking, tiers, goldens, coverage)
- [Wiktionary SDK spec](docs/wiktionary-sdk-spec.md) (ground truth)
- [Roadmap](docs/ROADMAP.md) (context for later phases)
