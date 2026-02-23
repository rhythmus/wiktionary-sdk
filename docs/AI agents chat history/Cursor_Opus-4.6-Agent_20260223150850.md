# Web application execution
_Exported on 23-2-2026 at 15:08:00 CET from Cursor (2.5.20)_

---

**User**

Please run the webapp

---

**Cursor**


Starting the webapp dev server.



The webapp is running.

- **Local URL:** http://localhost:5174/  
  (Vite picked 5174 because 5173 was already in use.)

Open that URL in your browser to use the React dashboard. The dev server is running in the background; stop it from the terminal with Ctrl+C when you’re done.

---

**User**

Please carefully read @docs/ROADMAP.md and then propose an staged implementation plan.

---

**Cursor**


Checking the codebase structure and types to align the plan with the current state:



Checking the registry structure and whether a schema or versioning exists:



Creating a staged implementation plan from the ROADMAP and codebase.


---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

The todos array is empty. Let me create the task list and start exploring the codebase thoroughly to understand all the source files before implementing.

Let me first explore the entire codebase to understand the full picture before starting implementation.

Now let me read the full source files I'll need to modify.

Now I have a complete picture of the codebase. Let me start implementing systematically, beginning with Phase 1.3.

**Starting Phase 1.3: JSON Schema & Versioning**

I need to fix a duplicate and typo in the schema.

Now remove the earlier duplicate `required` array that had the typo:

Now I need to add back the `required` properly (it was the first `required` in the Entry definition):

Now create the versioning documentation:

Now update `src/types.ts` with the Phase 2 forward-compatible types (Sense, SemanticRelations, EtymologyData, usage_notes) and a schema version constant:

Now add the new Phase 2 interfaces and extend the Entry interface:

Now let me set up Vitest and create the test suite:

Now create the test directory and gold standard tests. I'll write unit tests for the parser (which don't require network access) and integration tests that use stored fixture data:

Now create the parser unit tests:

Now create the registry decoder tests:

Now create the schema validation test:

Let me run the tests now:

All 31 tests pass. Now moving on to Phase 2.

**Phase 2.1: Sense-level structuring** — Parse `#`, `##`, `#:` lines into `Sense` objects.

I'll add a sense parser and a decoder that registers it in the registry:

Now add the sense parser and all the Phase 2 decoders at the end of `registry.ts`:

Now add tests for all Phase 2 features:

The `inh`, `der`, `bor` templates have the target language as the first param and source language as the second. I need to fix the decoder:

All 49 tests pass. Now update Phase 2 todos and move to Phase 3.

**Phase 3.1: Template Introspection Engine** — Build a tool that discovers Greek templates from Wiktionary categories and reports missing decoders.

**Phase 3.2: Production Caching Layer**

**Phase 3.3: Rate Limiting & Proxy Management**

Now integrate the rate limiter and caching into `api.ts`:

Now add caching to the two main fetch functions:

Now add tests for cache and rate limiter:

All 60 tests pass. Moving to Phase 4.

**Phase 4.1: CLI Tool**

Now install `js-yaml` as a root dependency (it's needed by the CLI) and `tsx` for running TypeScript directly:

Add the CLI bin entry to the root `package.json`:

**Phase 4.2: NPM Package Distribution** — Prepare dual ESM/CJS build:

Create the CJS tsconfig:

Update the main tsconfig for ESM output:

Update the build script:

**Phase 4.3: Containerization** — Docker + Express API wrapper:

Add the serve script:

**Phase 5.1: Automated API Documentation — TypeDoc**

Now add JSDoc comments to the key exported functions and interfaces for TypeDoc. First, let me add doc comments to the main entry points:

Add doc comment to the main fetch function:

Add the TypeDoc config and script:

**Phase 5.2: Benchmarking & Optimization**

Add bench script:

Let me run all tests to make sure everything still passes:

The `bench()` function is only available in benchmark mode. Let me separate benchmark from tests:

Now rewrite the test file to only contain the performance assertions (no `bench()`):

All 62 tests pass. Let me also fix the `exports` field warning in package.json:

Now moving to Phase 6 — Webapp Polish.

**Phase 6.1: Interactive Template Inspector** — Click-to-source highlighting in the webapp, plus "Debugger Mode" showing decoder matches.

Now I'll rewrite the webapp with the interactive template inspector and comparison view features:

Let me check that the webapp still builds correctly:

Webapp type-checks cleanly. Let me run the full test suite one final time:

All 62 tests pass across 6 test files. Let me mark the remaining todos as completed:

All 17 tasks across 6 phases are complete. Here's a summary of everything implemented:

---

**Phase 1 — DX, Quality & Observability**

- **1.3 JSON Schema & Versioning**: Created `schema/normalized-entry.schema.json` formalizing the full output shape (Entry, FetchResult, all sub-types including forward-compatible Phase 2 types). Added `VERSIONING.md` documenting semantic version policy. Added `SCHEMA_VERSION` constant to `src/types.ts`.
- **1.4 Gold Standard Test Suite**: Set up Vitest with 62 tests across 6 files — parser unit tests, registry decoder tests, JSON Schema validation tests, and performance assertion tests. All passing.

**Phase 2 — Semantic & Linguistic Depth**

- **2.1 Senses**: New `parseSenses()` function and decoder in `registry.ts` that parses `#`, `##`, `#:` lines into structured `Sense` objects with IDs, subsenses, and examples.
- **2.2 Semantic Relations**: Decoders for `{{syn}}`, `{{ant}}`, `{{hyper}}`, `{{hypo}}` templates, outputting structured `SemanticRelations`.
- **2.3 Etymology**: Decoders for `{{inh}}`, `{{der}}`, `{{bor}}`, `{{cog}}` templates with proper parameter offset handling (target lang vs source lang).
- **2.4 Pronunciation**: New `el-IPA` and `audio` decoders alongside the existing `IPA` decoder.
- **2.5 Usage Notes**: Decoder that extracts `===Usage notes===` sections.

All new types (`Sense`, `SemanticRelation`, `EtymologyLink`, `EtymologyData`) added to `src/types.ts`.

**Phase 3 — Total Coverage & Scalability**

- **3.1 Template Introspection**: `tools/template-introspect.ts` crawls Wiktionary Greek template categories and produces a Missing Decoder Report (markdown or JSON).
- **3.2 Caching**: `src/cache.ts` with `MemoryCache` (L1), pluggable `CacheAdapter` interface for L2/L3, and `TieredCache` with automatic promotion. Integrated into `src/api.ts`.
- **3.3 Rate Limiting**: `src/rate-limiter.ts` with request throttling, custom User-Agent, and proxy URL support. Integrated into `mwFetchJson()`.

**Phase 4 — Multi-Client & Distribution**

- **4.1 CLI**: `cli/index.ts` with full argument parsing, batch mode, yaml/json output, and file output support. Runnable via `npm run cli`.
- **4.2 NPM Package**: Dual ESM/CJS build pipeline (`tsconfig.json` + `tsconfig.cjs.json`), proper `exports` field, `files` whitelist.
- **4.3 Containerization**: `server.ts` (lightweight HTTP API), `Dockerfile` (multi-stage Node 22 Alpine build), `.dockerignore`.

**Phase 5 — Quality & Engineering**

- **5.1 TypeDoc**: Installed TypeDoc, added JSDoc to key exports, `npm run docs` script.
- **5.2 Benchmarks**: `test/bench.bench.ts` for Vitest bench mode + `test/bench.test.ts` with performance assertions (sub-10ms parser, sub-1ms section extraction).

**Phase 6 — Webapp Polish**

- **6.1 Interactive Template Inspector**: Click any YAML key/value to highlight the corresponding template in the wikitext pane. Debugger Mode (bug icon toggle) shows a table of all decoder matches per entry — which template triggered which decoder and what fields it produced.
- **6.2 Comparison View**: Toggle (columns icon) enables a third pane showing the same term in a different language side-by-side, with a language selector.

---

**User**

Please update the ROADMAP with your above summary of everything now Implemented.

---

**Cursor**

The ROADMAP has been updated. Every phase and sub-task now shows **DONE** status with a detailed **Delivered** section describing exactly what was built, which files were added or modified, and how to run the new capabilities.

---

**User**

We've done quite a bit of work; let us update the documentation and then commit. Add to the docs and spec so as to reflect all our recent changes and improvements, including their rationale and design choices. Then, please chunk all of our work/changes, respective to the latest commit, in several sizeable commmit stages. Then commit in order, using a sensible, descriptive, concise commit message for each commit.

---

**Cursor**

Let me first check the current state of all docs and the git diff.

Now let me update all the documentation first — README and spec — to reflect the full current state.

Now update the formal specification to reflect all Phase 2-6 additions:

Now let me plan the commit stages. Let me verify the full list of changed and new files:

Good. I'll organize the commits in this order:

1. **Phase 1** — Schema, versioning, types, test infrastructure
2. **Phase 2** — Semantic decoders (senses, relations, etymology, pronunciation, usage notes)
3. **Phase 3** — Caching, rate limiting, template introspection tooling
4. **Phase 4** — CLI, dual build, containerization (server, Dockerfile)
5. **Phase 5** — Benchmarks and TypeDoc setup (package.json script additions)
6. **Phase 6** — Webapp inspector and comparison view
7. **Docs** — Updated README, spec, and ROADMAP

I need to also stage the package.json changes for Vitest and ajv. But package.json has changes from all phases. Let me commit the Phase 1 core files first (schema, types, versioning, test infra), then handle the cumulative files in later commits.

Let me verify the final state is clean:

Working tree is clean. All changes have been committed in 7 logical stages:

| Commit | Summary |
|--------|---------|
| `a392286` | **Phase 1** — JSON Schema, versioning, types with Phase 2 forward-compat, Vitest + 31 tests |
| `f026596` | **Phase 2** — Sense, semantic relations, etymology, pronunciation, usage notes decoders + 18 tests |
| `1f256d1` | **Phase 3** — Multi-tier cache, rate limiter, template introspection engine + 11 tests |
| `f9940a9` | **Phase 4** — CLI tool, dual ESM/CJS build, HTTP API server, Dockerfile |
| `74a663b` | **Phase 5** — Parser benchmarks and performance assertion tests, TypeDoc setup |
| `dee4f5f` | **Phase 6** — Webapp click-to-source inspector, debugger mode, comparison view |
| `b2464c0` | **Docs** — Comprehensive updates to README, formal spec (v0.9 -> v1.0), and ROADMAP (all phases marked DONE) |

---

**User**

Please add the style and format of those commit messages to AGENTS.md such that agents who'll commit in the future keep that same consistent style of describing commits.

---

**Cursor**

Done. The new **Commit Message Style** section in `AGENTS.md` documents the type prefixes, formatting rules, and includes two real examples from this session's commits. Future agents will pick this up automatically since `AGENTS.md` is an always-applied workspace rule.

---

**User**

Based on the current state of the implementation and also based on @docs/ROADMAP.md : please add an overview of our project's features and functionalities to the README.md

---

**Cursor**

Let me verify it reads well as a whole:

Reads well. Now let me commit:

Done. The README now has a full **Features & Capabilities** section with three sub-sections -- Extraction Engine, Infrastructure, and Interfaces -- covering every implemented capability, grounded in both the current codebase and the ROADMAP deliverables.

---

**User**

Please prettify the README with some sensibly used emoji.

---

**Cursor**

Done. The README now has emoji on all section headings, the four design philosophy points, the infrastructure bullet points, and the interface items — keeping it purposeful rather than cluttered.

---

**User**

We've done quite a bit of work; let us update the documentation and then commit. Add to the docs and spec so as to reflect all our recent changes and improvements, including their rationale and design choices. Then, please chunk all of our work/changes, respective to the latest commit, in several sizeable commmit stages, following the guidelines in AGENTS.md Then commit in order, using a sensible, descriptive, concise commit message for each commit.

---

**Cursor**

The only outstanding change is the emoji prettification of `README.md`. Everything else was already committed in the previous round. Let me verify the diff is just the emoji additions:

It's a single file with only cosmetic changes (emoji on headings and bullet points). This belongs in one small commit:

Working tree is clean. The only change since the last commit was the README emoji pass, now committed as `fb521aa`. All documentation (README, spec, ROADMAP, AGENTS.md) was already updated and committed in prior rounds — there was nothing else outstanding to chunk.

