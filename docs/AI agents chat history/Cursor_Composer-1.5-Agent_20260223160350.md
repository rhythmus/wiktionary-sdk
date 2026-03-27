# Roadmap implementation
_Exported on 23-2-2026 at 16:02:36 CET from Cursor (2.5.20)_

---

**User**

Go ahead implementing the @docs/ROADMAP.md!

---

**Cursor**


Exploring the codebase to understand the current implementation.



Creating fixture files and the integration test.



Fixing fixture structure and test expectations.



Checking how etymology is structured in the parser:



Implementing Stage 1.1: brace-aware pipe splitting.



Implementing Stage 0.2 and Stage 1.2:



Implementing Stage 4.1 — correct translation item semantics:



Implementing Stage 8.1 (CLI/server packaging) and Stage 8.2 (cache key normalization):



Summary of what was implemented from the ROADMAP:

## Completed stages

### Stage 0 — Baseline + safety rails
- **0.1 Fixture-based integration tests**: Added `test/fixtures/*.wikitext` (basic-verb, nested-templates, nested-pipe-bug, form-of-inflected, translations-multi) and `test/integration.test.ts` that runs the parsing pipeline against fixtures without network calls.
- **0.2 Always emit `schema_version`**: Added `schema_version: SCHEMA_VERSION` to all `FetchResult` returns in `src/index.ts`; updated `FetchResult` in `src/types.ts` and schema tests.

### Stage 1 — Parser correctness
- **1.1 Brace-aware pipe splitting**: Updated `splitPipesPreservingLinks()` in `src/parser.ts` to track `depthTpl` for `{{...}}` in addition to `depthLink` for `[[...]]`, so pipes inside nested templates are not split.
- **1.2 Remove unknown language default**: Changed `langToLanguageName()` to return `null` for unknown codes; `fetchWiktionary()` returns early with a note when the language is unknown.

### Stage 4 — Translations correctness
- **4.1 Translation item semantics**: Extended `TranslationItem` with `term`, `gloss?`, `transliteration?`, `gender?`, `alt?`. Updated `parseTranslationsFromBlock()` to use `pos[1]` as translation language and `pos[2]` as term, and to extract `t=`, `tr=`, `g=`, `alt=` from named params.

### Stage 8 — Packaging & distribution
- **8.1 CLI/server packaging**: Included `cli/**/*` and `server.ts` in the build; `bin` points to `./dist/cjs/cli/index.js`; `serve` runs `node dist/cjs/server.js`; added `@types/node`.
- **8.2 Cache key normalization**: In `src/api.ts`, after fetching, the result is also stored under `wikt:${normalizedTitle}` when a redirect changes the title.
- **8.3 Align TypeScript types with schema**: Tightened `EntryType` to `"LEXEME" | "INFLECTED_FORM" | "FORM_OF"` to match the schema enum.

## Not yet implemented

- **Stage 3**: Registry-driven decoder debug events (3.1); template ordering + location metadata (3.2)
- **Stage 5**: Cycle protection and lemma resolution robustness (5.1)
- **Stage 6**: Declare decoder coverage in registry (6.1); expand coverage measurement (6.2)
- **Stage 2**: Raw/stripped sense glosses and brace-aware stripping (2.1)
- **Stage 7**: Section decoders for derived/related terms (7.1)

All 68 tests pass. The CLI runs from `node dist/cjs/cli/index.js`; `npm run serve` runs the built server.

---

**User**

We've done quite a bit of work; let us update the documentation and then commit. Add to the docs and spec so as to reflect all our recent changes and improvements, including their rationale and design choices. Then, please chunk all of our work/changes, respective to the latest commit, in several sizeable commmit stages, following the guidelines in AGENTS.md Then commit in order, using a sensible, descriptive, concise commit message for each commit.

---

**Cursor**


Summary of what was done:

## Documentation updates

**ROADMAP.md**
- Marked Stages 0.1, 0.2, 1.1, 1.2, 4.1, 8.1, 8.2, 8.3 as DONE
- Added “Delivered” sections for each with implementation notes

**wiktionary-sdk-spec.md**
- Documented `schema_version` in `FetchResult`
- Described brace-aware parameter splitting (pipes inside `[[...]]` and `{{...}}`)
- Documented unknown language behavior (`null` for unknown codes, early return)
- Documented translation item shape (`term`, `gloss?`, `transliteration?`, `gender?`, `alt?`)
- Updated distribution table (CLI/server paths, build)
- Added packaging section (cache key normalization)
- Updated post-v1.0 section: completed vs remaining work

**README.md**
- Updated brace-aware parsing description
- Updated translation item description
- Changed test count from 62 to 68
- Updated CLI and HTTP API descriptions
- Added build step before serve
- Updated roadmap section with completed vs remaining

## Commits (5 total)

1. **test: add fixture-based integration tests (Stage 0.1)** — `test/fixtures/*.wikitext`, `test/integration.test.ts`
2. **feat: add schema_version, brace-aware pipe splitting, fix unknown language (Stage 0.2, 1.1, 1.2)** — `src/parser.ts`, `src/index.ts`, `src/types.ts`, `test/parser.test.ts`, `test/schema.test.ts`
3. **feat: correct translation item semantics (Stage 4.1)** — `src/registry.ts`, `schema/normalized-entry.schema.json`, `test/integration.test.ts`
4. **feat: packaging and distribution hardening (Stage 8.1, 8.2, 8.3)** — `package.json`, `package-lock.json`, `tsconfig.json`, `src/api.ts`
5. **docs: update README, spec, and ROADMAP to reflect post-v1.0 changes** — `README.md`, `docs/ROADMAP.md`, `docs/wiktionary-sdk-spec.md`

All 68 tests pass and the build succeeds.

---

**User**

Please go on with the Implementation, continuing with Stages 3, 5, 6, 2 and 7.

---

**Cursor**


Implementing stages in order, starting with Stage 3.



Implementing Stage 7.1: adding types, a section parser, and the decoder.



Summary of what was implemented:

## Completed stages

### Stage 2.1 — Store gloss_raw (partial)
- Added `Sense.gloss_raw` to store the raw text after `#` / `##` before stripping
- Updated `parseSenses` to set `gloss_raw` for main senses and subsenses
- Added `gloss_raw` to the schema

### Stage 6.2 — Expand coverage measurement
- Added `--sample N` to `tools/template-introspect.ts` to sample N Greek entries from Category:Greek lemmas
- Implemented `generateSampleReport()` and `formatSampleReport()` to report:
  - Templates encountered vs decoded
  - Top 20 missing templates by frequency

### Stage 7.1 — Section decoders for l/link
- Added decoders for `{{l}}` and `{{link}}` in:
  - `====Derived terms====`
  - `====Related terms====`
  - `====Descendants====`
- Introduced types `SectionLinkItem` and `SectionWithLinks`
- Added Entry fields: `derived_terms`, `related_terms`, `descendants` with `raw_text` and `items`
- Updated schema and added a registry test

### Documentation
- ROADMAP: marked 2.1, 6.2, 7.1 as DONE with Delivered sections
- README: documented `--sample N` and updated test count
- Spec: documented `derived_terms`, `related_terms`, `descendants` in the output table

All 69 tests pass. Brace-aware stripping for `Sense.gloss` remains deferred because the previous implementation produced incorrect output (e.g. duplicate text).

---

**User**

We've done quite a bit of work; let us update the documentation and then commit. Add to the docs and spec so as to reflect all our recent changes and improvements, including their rationale and design choices. Then, please chunk all of our work/changes, respective to the latest commit, in several sizeable commmit stages, following the guidelines in AGENTS.md Then commit in order, using a sensible, descriptive, concise commit message for each commit.

---

**Cursor**


Summary of changes:

## Documentation updates

**Spec (`docs/wiktionary-sdk-spec.md`):**
- Documented `FetchResult.debug`, `Entry.templates_all`, `lemma_triggered_by_entry_id`, `Sense.gloss_raw`
- Added section 3.6 (Section link lists) for `derived_terms`, `related_terms`, `descendants`
- Added section 3.8 (Lemma resolution and cycle protection)
- Added design rationale 12.6–12.8 (registry-driven debug events, template location metadata, section links)
- Updated decoder families list with section-links and `handlesTemplates`
- Updated section 13 with all completed post-v1.0 items

**README:**
- Corrected test count (69)
- Added section links to decoder coverage table
- Expanded Roadmap completed list with all new features

**ROADMAP:**
- Added Delivered sections for stages 6.2 and 7.1 (already present for 2.1)

## Commits (3)

1. **`feat: add decoder debug mode, template location metadata, cycle protection, gloss_raw, section links, and declared coverage`**  
   - Stages 3.1, 3.2, 5.1, 2.1, 6.1, 7.1  
   - Files: `src/types.ts`, `src/registry.ts`, `src/parser.ts`, `src/index.ts`, `schema/normalized-entry.schema.json`, `webapp/src/App.tsx`, `test/registry.test.ts`

2. **`feat: add sample mode to template-introspect for frequency-based coverage`**  
   - Stage 6.2  
   - File: `tools/template-introspect.ts`

3. **`docs: update README, spec, and ROADMAP for implemented stages`**  
   - Files: `README.md`, `docs/wiktionary-sdk-spec.md`, `docs/ROADMAP.md`

All 69 tests pass.

---

**User**

Are there still issues yet to be implemented left on the @docs/ROADMAP.md ?

---

**Cursor**


There are a few remaining items:

## 1. Stage 2.1 — Brace-aware stripping (partial)

Stage 2.1 is marked **DONE (partial)**. What’s still missing:

- **Brace-aware stripping for `Sense.gloss`**  
  `Sense.gloss_raw` is implemented, but `Sense.gloss` still uses regex-based `stripWikiMarkup`, which can mis-handle nested markup and produce wrong output (e.g. `"to writewrite"` from `"to [[write]]"`, or `"make|producemake|produce"` from `"[[make|produce]]"`). A brace-aware implementation was tried and reverted because of incorrect output; the full fix is deferred.

## 2. ROADMAP not updated for implemented stages

These stages are implemented but not marked DONE in the ROADMAP:

- **3.1** — Registry-driven decoder debug events  
- **3.2** — Preserve template ordering + location metadata  
- **5.1** — Cycle protection and explicit linkage metadata  
- **6.1** — Declare decoder coverage explicitly in the registry  

They should be marked DONE and given Delivered sections.

---

**Summary:** The only real remaining implementation work is brace-aware stripping for `Sense.gloss`. The other four stages are done but not reflected in the ROADMAP.

---

**User**

Please implement that last remaining issue.

---

**Cursor**


Implementation summary:

## Brace-aware `stripWikiMarkup`

**Implementation** (`src/registry.ts`):
- Replaced regex-based stripping with a brace-aware scanner
- Added `findMatching()` for depth-based matching of `[[...]]` and `{{...}}`
- `[[link|display]]` → `display`; `[[link]]` → `link`
- Nested `{{...}}` removed without leaving stray braces
- `'''bold'''` and `''italic''` handled (checking `'''` before `''`)
- Recursive stripping for markup inside link display text

**Tests** (`test/phase2.test.ts`):
- `"to [[write]]"` → `"to write"` (no duplication)
- `"[[make|produce]]"` → `"produce"` (correct link handling)
- `"word {{t|el|fr|écrire|g={{g|m}}}}"` → `"word"` (nested templates removed)

**Docs**:
- ROADMAP: Stage 2.1 marked DONE (no longer partial)
- Spec: brace-aware stripping documented
- README: test count updated to 72

All 72 tests pass.

---

**User**

We've done quite a bit of work; let us update the documentation and then commit. Add to the docs and spec so as to reflect all our recent changes and improvements, including their rationale and design choices. Then, please chunk all of our work/changes, respective to the latest commit, in several sizeable commmit stages, following the guidelines in AGENTS.md Then commit in order, using a sensible, descriptive, concise commit message for each commit.

---

**Cursor**


Summary of changes:

## Documentation updates

**Spec (`docs/wiktionary-sdk-spec.md`):**
- Added design rationale **12.9 Brace-Aware Gloss Stripping**: rationale for depth-based scanning vs regex, handling of nested structures, and processing order (`'''` before `''`).

**ROADMAP (`docs/ROADMAP.md`):**
- Stage 2.1 marked **DONE** (no longer partial).
- Delivered section updated with brace-aware `stripWikiMarkup` details.

**README:**
- Test count updated to 72.

## Commits (2)

1. **`feat: replace regex-based stripWikiMarkup with brace-aware scanning (Stage 2.1)`**  
   - Files: `src/registry.ts`, `test/phase2.test.ts`  
   - Implements brace-aware stripping and adds tests.

2. **`docs: update README, spec, and ROADMAP for Stage 2.1 completion`**  
   - Files: `README.md`, `docs/wiktionary-sdk-spec.md`, `docs/ROADMAP.md`  
   - Updates documentation and rationale.

---

**User**

Please clean out the @docs/ROADMAP.md : remove everything that's done.

---

**Cursor**


Checking whether stages 3, 5, and 6.1 are implemented:



Removing stages 3, 5, and 6.1 — they're implemented but not marked DONE.



Removed all completed stages from the ROADMAP. It now only contains:

- The principles section
- A note that all planned stages (0–8) are complete
- A note that the document is kept for reference and future work can be added

---

**User**

commit

---

**Cursor**


Commit created as `4e619fb`: `docs: remove completed stages from ROADMAP`

---

**User**

Under the root of the project create a CHANGELOG document. Then go through the entire git commit history, and based on that, populate the changelog as concise but still enlightening, readable and useful as possible.

---

**Cursor**


`CHANGELOG.md` is in place at the project root. It uses the [Keep a Changelog](https://keepachangelog.com/) format and summarizes the git history as:

- **1.0.0** – Main release with sections for Added, Changed, Fixed, and Documentation
- **Development history** – Short overview of pre-1.0 phases (init, Phases 1–6, post-v1.0 hardening)

Content is grouped by feature area (core engine, infrastructure, interfaces, schema) instead of listing each commit, so it stays readable while still reflecting the full history.

---

**User**

In README I have added to the pre-amble an example, illustrating to visitors to the project, what it is all about. Please correct and complete.

---

**Cursor**


Updated the preamble example with these changes:

1. **IN section**
   - Corrected the library call to `fetchWiktionary({ query: "γράφω", lang: "el" })` (no `format`; that’s for the CLI).
   - Added the CLI usage: `wiktionary-sdk γράφω --lang el --format yaml`.

2. **OUT section**
   - Replaced the placeholder with a real YAML example for γράφω, including:
     - `schema_version`, `entries`
     - Entry fields: `id`, `language`, `query`, `type`, `form`, `part_of_speech`
     - `senses` with subsenses
     - `semantic_relations` (synonyms, antonyms)
     - `etymology.links` with the inherited term

3. **Labels**
   - Renamed "IN" / "OUT" to "In" / "Out" and clarified that the output is normalized entries.

---

**User**

commit

---

**Cursor**


Created commit `330cd8a`: `docs: add CHANGELOG and complete README preamble example`

