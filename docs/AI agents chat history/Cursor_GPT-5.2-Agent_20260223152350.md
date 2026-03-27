# Project improvement analysis
_Exported on 23-2-2026 at 15:23:11 CET from Cursor (2.5.20)_

---

**User**

Please study this project. Then propose how it could be improved, which bits and pieces are underdeveloped, and which would be great new features.

---

**Cursor**

Got it. I’m going to quickly map the repo structure, read the spec/roadmap/README, then skim the core pipeline (API → parser → registry decoders → normalization → CLI/webapp). After that I’ll propose concrete improvements grouped by impact: correctness/traceability, decoder coverage, performance, DX, and new product features.

Nice: the project already has a clear “source-faithful” contract, a registry-based decoder architecture, caching/rate-limiting, and three clients (CLI/server/webapp). Next I’ll skim the actual parser/registry/types and the webapp, then I’ll give you a prioritized list of underdeveloped areas and high-leverage feature ideas.

Next I’ll focus on two things: correctness risks in the parser/decoders (places where “source-faithful” extraction can silently go wrong), and product/DX gaps (packaging, registry introspection, UI traceability). Then I’ll give you a prioritized, concrete “improve next” list with rationale.

## Highest-impact improvements (correctness + “source-faithful”)

- **Fix pipe-splitting inside nested templates** (`src/parser.ts`): `parseTemplateInner()` only preserves pipes inside `[[links]]`, not inside nested `{{...}}`. That will silently mis-parse real-world templates like translations, qualifiers, labels, and many headword templates that embed other templates.
- **Make wiki-markup stripping brace-aware** (`src/registry.ts`): `stripWikiMarkup()` uses regexes that break on nested templates and can delete too much/too little. Consider storing both **raw gloss** + **stripped gloss**, and make stripping use the same brace-aware machinery.
- **Stop defaulting unknown languages to Greek** (`src/parser.ts` `langToLanguageName()`): today `lang="it"` will search for `==Greek==`. Better: require a known mapping, or allow `fetchWiktionary({ languageHeaderName })` override.

## Underdeveloped / brittle areas

- **Decoder traceability is mostly UI-side guessing** (`webapp/src/App.tsx`): “decoder matches” are inferred from template names, not from the real decoder registry. A much stronger design is: `registry.decodeAll()` returns `{patch, debug: [{decoderId, matchedTemplates, fieldsProduced}]}` (optional flag), so the UI shows ground truth.
- **Template storage loses ordering and location** (`Entry.templates`): grouping by template name discards the original sequence and line/offset. Add optional `templates_all[]` with `{name, raw, params, line?, start?, end?}` to support click-to-source precisely.
- **Translations model is likely semantically off** (`src/registry.ts`): for `{{t|lang|term|...}}`, the code stores `pos[1]` as `gloss`, but it’s typically the *translation term*. Also misses common explicit params (`t=`, `tr=`, `g=`, `alt=`, etc.). This is fixable without heuristics, but may require a **schema bump** depending on how you rename/extend fields.
- **Packaging is not production-ready** (`package.json`, `tsconfig.json`):
  - `bin` points to `cli/index.ts`, but builds only compile `src/**/*`. Published installs won’t have a runnable JS CLI unless they also have `tsx` and the TS sources.
  - `server.ts` likewise isn’t built by `npm run build`.
  - If the intent is “library is built, CLI/server are dev-only”, then the `bin`/README should reflect that; otherwise compile them into `dist/` and point `bin` to built JS.
- **Cache keys don’t use normalized/redirected titles** (`src/api.ts`): caching under `wikt:${title}` means redirect-normalized titles may miss cache hits. You can store under both the requested and normalized title (still source-faithful).

## Great new features (still “no heuristics”)

- **Inflection-table extraction** (biggest value for Greek):
  - Decode explicit forms from Greek declension/conjugation table templates (whatever Wiktionary uses in practice) into a structured `forms[]` list with `{form, tags[], rawTemplate, source}`.
  - This is perfectly aligned with your policy: you’re not generating paradigms, just extracting explicit cells/params.
- **More section families (explicit lists)**:
  - Derived/related terms, descendants, coordinate terms, synonyms/antonyms sections outside templates, etc., by decoding list templates like `{{l}}`, `{{link}}`, etc.
- **Better “form-of” and lemma resolution**:
  - Track visited `(lang, lemma)` to avoid cycles.
  - Fetch lemmas in parallel (rate-limiter will serialize requests anyway) to speed up batch runs.
  - Return explicit linkage metadata: which form-of template instance triggered which lemma fetch.
- **Registry introspection that’s real, not probe-based** (`tools/template-introspect.ts`):
  - Give each decoder a declared `templateNames`/`families` field, so coverage reports are exact and don’t rely on dummy contexts.
  - Extend introspection beyond two categories: sample actual Greek entries and compute “templates encountered vs decoded”.

## Small but high-leverage DX/quality wins

- **Always include `schema_version` in results** (top-level): schema supports it, but `fetchWiktionary()` doesn’t emit it.
- **Align TypeScript types with schema** (`EntryType` currently allows `string`, schema enums don’t).
- **Add fixture-based integration tests**: store a few real wikitext blobs under `test/fixtures/` and assert decoded output. This catches parser regressions without hitting the network.

If you tell me your priority (library correctness, Greek morphology coverage, or packaging for npm/docker), I can turn the above into a concrete implementation plan (and start executing it).

---

**User**

Based on your FULL above analysis and list of suggestions, please draft a detailed, satged implementation plan, including all and everuthing you proposed **except** Inflection-table extraction.

---

**Cursor**

## Staged implementation plan (everything proposed, **except** inflection-table extraction)

### Stage 0 — Baseline + safety rails
- **Add fixture-based integration tests** (`test/fixtures/*.wikitext`, `test/integration.test.ts`)
  - **Goal**: lock in behavior and catch regressions without network calls.
  - **Acceptance**: tests cover nested templates, translations lines, senses with markup, hyphenation, etymology templates.

- **Emit `schema_version` in results** (`src/index.ts`)
  - **Add**: top-level `FetchResult.schema_version = SCHEMA_VERSION`.
  - **Acceptance**: schema validation test passes with the field present.

---

### Stage 1 — Parser correctness (highest leverage)
- **Fix pipe-splitting inside nested templates** (`src/parser.ts`)
  - **Problem**: `splitPipesPreservingLinks()` only protects `[[...]]`; it breaks on `{{...|...}}` nested inside templates.
  - **Work**:
    - Replace pipe-splitting with a single pass that tracks both `[[...]]` depth **and** `{{...}}` depth.
    - Ensure it doesn’t split on `|` when inside either structure.
    - Add fixtures: templates with nested templates and nested links.
  - **Acceptance**: `parseTemplates()` returns correct `TemplateCall.params` for nested cases.

- **Stop defaulting unknown `lang` to Greek** (`src/parser.ts`)
  - **Work**:
    - Change `langToLanguageName()` to return `null` (or throw) for unknown codes.
    - In `fetchWiktionary()`, return a note like “unsupported lang code mapping” instead of silently using Greek.
    - Optional: allow a new parameter `languageHeaderName?: string` for explicit override.
  - **Acceptance**: `lang=it` doesn’t search `==Greek==` unless explicitly overridden.

---

### Stage 2 — “Source-faithful” text handling
- **Make wiki-markup stripping brace-aware** (`src/registry.ts`)
  - **Problem**: `stripWikiMarkup()` uses regexes that can mis-handle nested templates and remove unintended content.
  - **Work**:
    - For senses, store both:
      - `gloss_raw`: the exact text after `#`/`##`
      - `gloss`: a *brace-aware* stripped version
    - Implement stripping by:
      - Removing template spans using the same brace-aware scanning used for templates (not regex).
      - Then stripping `[[link|text]]` → `text`, `''`/`'''` formatting, and leaving everything else intact.
  - **Schema impact**: **MINOR** bump (additive fields on `Sense`).
  - **Acceptance**: fixtures show `gloss_raw` preserved; `gloss` is stable and doesn’t eat adjacent text.

---

### Stage 3 — Real traceability + debugger truth
- **Make decoder traceability ground-truth (not UI guesses)** (`src/registry.ts`, `src/index.ts`, `webapp/src/App.tsx`)
  - **Problem**: the webapp infers “decoder matches” from template names; it can be wrong and can’t show “fields produced” reliably.
  - **Work**:
    - Extend registry API to optionally return debug info:
      - `decodeAll(ctx, { debug: true }) -> { patch, debug: DecoderDebugEvent[] }`
      - Each event includes `decoderId`, `matchedTemplates` (raw/name), and `fieldsProduced` (top-level keys written).
    - Thread an optional `debugDecoders?: boolean` option through `fetchWiktionary()`.
    - Update webapp to display returned debug events.
  - **Schema impact**: ideally **no schema change** (debug can be excluded by default, or placed under a new optional `debug` object gated by an option).
  - **Acceptance**: UI shows exact decoder IDs and exact matched template instances.

- **Preserve template ordering + location** (`src/parser.ts`, `src/index.ts`, `src/types.ts`)
  - **Problem**: `Entry.templates` groups by name and loses sequence + “where did this come from?”.
  - **Work**:
    - Extend `parseTemplates()` to optionally return `{start,end,line}` metadata (line can be derived from counting `\n` before `start`).
    - Add `Entry.templates_all?: StoredTemplateInstance[]` preserving order, each including raw, params, name, and location.
    - Keep existing `Entry.templates` for backward compatibility and quick lookup.
  - **Schema impact**: **MINOR** bump (add optional `templates_all`).
  - **Acceptance**: webapp click-to-source can highlight by exact line/offset, not substring heuristics.

---

### Stage 4 — Translations correctness (explicit-only, but structurally right)
- **Fix translation item semantics + extract explicit params** (`src/registry.ts`, `src/types.ts`, schema)
  - **Problem**: current code treats `pos[1]` as `gloss`, but in `{{t|lang|term|...}}` that’s typically the *translation term*. It also ignores explicit `t=`, `tr=`, `g=`, `alt=`, etc.
  - **Work (non-breaking first)**:
    - Keep current `translations[lang][]` shape, but add new fields:
      - `term` (translation term; from positional)
      - `gloss` (meaning/English gloss; from `t=` or context if explicitly present)
      - `transliteration` (from `tr=`)
      - `gender` (from `g=`)
      - `alt` (from `alt=`)
      - keep `raw`, `template`, `params`, `sense` as-is
    - Populate both `term` and legacy `gloss` initially if needed for compatibility, but document that `term` is authoritative going forward.
  - **Schema impact**: **MINOR** bump (add fields to `TranslationItem`).
  - **Acceptance**: fixtures show `term` populated correctly; no inference is introduced.

---

### Stage 5 — Lemma resolution robustness + performance
- **Cycle/dup protection and better linkage metadata** (`src/index.ts`)
  - **Work**:
    - Track visited lemmas per `(lang, lemma)` to prevent cycles/re-fetching.
    - Parallelize lemma fetch initiation (even if the rate limiter serializes requests, it reduces orchestration latency and simplifies code).
    - Record which form-of entry triggered which lemma resolution (explicit metadata only).
  - **Acceptance**: no infinite loops; batch queries resolve lemmas faster and deterministically.

---

### Stage 6 — Introspection engine becomes “real”
- **Make coverage reporting exact (no probe-based detection)** (`tools/template-introspect.ts`, `src/registry.ts`)
  - **Problem**: current report uses a hardcoded probe list + “did decode produce a patch?” which can under/overcount.
  - **Work**:
    - Add declared capabilities to each decoder, e.g. `handlesTemplates?: string[]`.
    - Export registry metadata (decoder list + handled template families).
    - Introspect categories by comparing discovered templates to declared handled templates.
    - Extend categories or add an optional mode: sample a set of real Greek entries and compute “encountered templates vs decoded”.
  - **Acceptance**: report coverage is stable, explainable, and doesn’t depend on dummy decode outcomes.

---

### Stage 7 — Broaden explicit extraction beyond current sections (no heuristics)
- **Add explicit section families** (new decoders in `src/registry.ts`)
  - **Work** (each as its own decoder + tests):
    - Parse common “list-template” patterns in sections like Derived/Related terms, Descendants, etc., extracting only explicitly templated links (`{{l}}`, `{{link}}`, etc. — whichever appear in fixtures).
    - Keep raw section text verbatim alongside structured extraction for traceability.
  - **Schema impact**: likely **MINOR** bump (new optional fields like `derived_terms`, `related_terms`, etc.).
  - **Acceptance**: output includes both raw and structured forms; nothing inferred.

---

### Stage 8 — Packaging & distribution hardening (npm/CLI/server)
- **Make CLI/server runnable from published package** (`package.json`, build config)
  - **Problem**: `bin` points to TypeScript (`cli/index.ts`) but the build only outputs `src/**/*`. Consumers won’t have compiled CLI/server JS.
  - **Work**:
    - Compile `cli/index.ts` and `server.ts` to `dist/` (either by extending `tsconfig.include` or adding dedicated build steps).
    - Point `bin.wiktionary-sdk` to built JS (e.g. `dist/esm/cli/index.js` or `dist/cjs/cli/index.js`).
    - Ensure published `files` include the built CLI/server.
  - **Acceptance**: `npm i -g wiktionary-sdk` provides a working `wiktionary-sdk` command without `tsx`.

- **Cache key normalization** (`src/api.ts`)
  - **Work**:
    - After fetch, store cache under both the requested title and the normalized/redirect-resolved title (same value).
  - **Acceptance**: redirect chains still hit cache.

- **Align TypeScript types with schema** (`src/types.ts`)
  - **Problem**: `EntryType` allows arbitrary `string` but schema enumerates.
  - **Work**:
    - Tighten `EntryType` to match schema (or bump schema if you truly want extensibility).
  - **Acceptance**: TS + schema agree; schema tests cover it.

---

## Recommended order (if you want the “least regret” path)
Stage 1 → Stage 4 → Stage 3 → Stage 8 → Stage 5 → Stage 6 → Stage 2 → Stage 7.

If you want, I can turn this into a checklist with concrete PR-sized slices (each slice: files touched, schema version bump decision, and tests to add).

---

**User**

Please put this entire implementation plan, in your recommended order, in @docs/ROADMAP.md 

---

**Cursor**

I’ll open the current `docs/ROADMAP.md`, then replace it with the full staged plan in the recommended order (keeping it as a proper roadmap with clear stages, deliverables, and acceptance criteria).

## Updated `docs/ROADMAP.md`

I replaced `docs/ROADMAP.md` with the **entire staged implementation plan** in the **recommended order** (and it **excludes inflection-table extraction**, as requested).

---

**User**

We've done quite a bit of work; let us update the documentation and then commit. Add to the docs and spec so as to reflect all our recent changes and improvements, including their rationale and design choices. Then, please chunk all of our work/changes, respective to the latest commit, in several sizeable commmit stages, following the guidelines in AGENTS.md Then commit in order, using a sensible, descriptive, concise commit message for each commit.

---

**Cursor**

I’ll first inspect what’s changed since the latest commit (status + diffs + recent log). Then I’ll update `README.md` and `docs/wiktionary-sdk-spec.md` to accurately reflect the current state and the new roadmap (with rationale/design choices). Finally I’ll split the work into a few cohesive doc-only commits and commit them in order following `AGENTS.md`.

I see only `docs/ROADMAP.md` has changed so far. Next I’ll update `README.md` and `docs/wiktionary-sdk-spec.md` so they accurately reflect the new **post‑v1.0** roadmap and the rationale/design principles behind it. After that, I’ll split the doc updates into a few cohesive commits and commit them in order.

I’m going to make the docs consistent and source-faithful: update `README.md` and `docs/wiktionary-sdk-spec.md` to (a) reference the new post‑v1.0 roadmap, (b) clarify the current parser’s guarantees vs planned fixes, and (c) document rationale/design choices as non‑normative guidance. Then I’ll split into 3 doc-only commits: ROADMAP, spec, README.

Great — the roadmap rewrite is now committed. Next I’ll commit the spec updates (non‑normative roadmap notes + clarified parser guarantees), then the README updates (accurate parser wording + roadmap pointer), keeping each commit cohesive and doc-only.

## Done: docs updated + commits created (in order)

### Documentation updates
- **`docs/ROADMAP.md`**: replaced with the full **post‑v1.0 staged implementation roadmap**, including principles, rationale, and acceptance criteria.
- **`docs/wiktionary-sdk-spec.md`**: added **non‑normative roadmap references**, clarified current template extraction guarantees, and pointed future hardening work to the roadmap.
- **`README.md`**: made the parser claim more precise, updated the docs tree description, and added a short **post‑v1.0 roadmap** section.

### Commits (cohesive, sizeable, doc-only)
1. **`9128483`** `docs: add post-v1.0 staged implementation roadmap`
2. **`4739866`** `docs: clarify parser guarantees and link post-v1.0 roadmap in spec`
3. **`b1a39b2`** `docs: update README to reflect post-v1.0 roadmap and parser scope`

Working tree is clean.

