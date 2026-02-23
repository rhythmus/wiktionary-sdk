# WiktionaryFetch: Implementation Roadmap (post-v1.0)

This roadmap proposes the next implementation stages for the
`wiktionary-fetch` ecosystem.

## Principles (non-negotiable)

- **Extraction, not inference**: only extract what is explicitly present in
  Wikitext/template parameters.
- **Traceability**: every structured field must be traceable to a source
  template, line, or section; store verbatim raw text alongside decoded data
  when practical.
- **Registry-first**: mapping/decoding logic lives in `src/registry.ts`, not in
  the parser or orchestration layer.

## Recommended execution order (this document order)

**Stage 0 → Stage 1 → Stage 4 → Stage 3 → Stage 8 → Stage 5 → Stage 6 → Stage 2 → Stage 7**

---

## Stage 0 — Baseline + safety rails

### 0.1 Fixture-based integration tests (no network)

- **Goal**: lock in behavior and catch regressions without API calls.
- **Work**:
  - Add `test/fixtures/*.wikitext` with representative real-world constructs:
    - nested templates inside templates
    - templates with `[[link|text]]` pipes
    - translations lines with multiple templates and qualifiers
    - senses containing markup/templates
    - hyphenation, etymology templates, form-of triggers
  - Add `test/integration.test.ts` that runs `extractLanguageSection`,
    `splitEtymologiesAndPOS`, `parseTemplates`, and registry decoding against
    fixtures.
- **Acceptance**:
  - All fixtures parse deterministically.
  - At least one test would fail under the current nested-template pipe-split
    behavior (to prove the test actually guards a bug).

### 0.2 Always emit `schema_version`

- **Files**: `src/index.ts`, `src/types.ts`, `schema/normalized-entry.schema.json`,
  `test/schema.test.ts`
- **Work**:
  - Add `schema_version: SCHEMA_VERSION` to the top-level `FetchResult`.
  - Update schema + tests accordingly.
- **Schema impact**: **MINOR** (additive; optional field) or keep it required
  (then it’s a **MAJOR** for existing consumers). Prefer **MINOR** by making
  it optional in schema first, then consider requiring it in a future major.
- **Acceptance**:
  - Schema validation tests pass with `schema_version` present.

---

## Stage 1 — Parser correctness (highest leverage)

### 1.1 Brace-aware pipe splitting in template parsing

- **Problem**: `src/parser.ts` only prevents splitting on `|` inside `[[...]]`,
  not inside nested `{{...}}`, causing silent mis-parses in real templates.
- **Files**: `src/parser.ts`, tests + fixtures
- **Work**:
  - Replace `splitPipesPreservingLinks()` with a single-pass splitter that
    tracks:
    - `depthLink` for `[[...]]`
    - `depthTpl` for `{{...}}`
  - Only split on `|` when `depthLink === 0 && depthTpl === 0`.
- **Acceptance**:
  - `parseTemplates()` returns correct `TemplateCall.params` for nested cases
    proven by fixtures.

### 1.2 Remove “unknown language defaults to Greek”

- **Problem**: `langToLanguageName()` returns `"Greek"` for unknown codes,
  causing incorrect extraction without telling the caller.
- **Files**: `src/parser.ts`, `src/index.ts`, tests
- **Work**:
  - Change `langToLanguageName(lang)` to return `null` for unknown codes.
  - In `fetchWiktionary()`, if language name is unknown:
    - return `{ rawLanguageBlock: "", entries: [], notes: [...] }`
  - Optional: allow `fetchWiktionary({ languageHeaderName?: string })` override
    for advanced use.
- **Acceptance**:
  - `lang=it` does not search `==Greek==` and yields a clear note.

---

## Stage 4 — Translations correctness (explicit-only, structurally right)

### 4.1 Correct translation item semantics and extract explicit params

- **Problem**:
  - For `{{t|lang|term|...}}`, `pos[1]` is typically the translation **term**,
    but current code stores it as `gloss`.
  - Common explicit parameters (`t=`, `tr=`, `g=`, `alt=`) are not extracted.
- **Files**: `src/registry.ts`, `src/types.ts`, `schema/normalized-entry.schema.json`,
  tests + fixtures
- **Work**:
  - Extend `TranslationItem` to include explicit fields:
    - `term` (from positional)
    - `gloss?` (from explicit `t=` / `gloss=` where present; do not infer)
    - `transliteration?` (from `tr=`)
    - `gender?` (from `g=`)
    - `alt?` (from `alt=`)
  - Keep legacy fields for compatibility where needed, but document that
    `term` is authoritative.
- **Schema impact**: **MINOR** (additive fields on `TranslationItem`).
- **Acceptance**:
  - Fixtures show `term` populated correctly and optional fields present only
    when explicitly provided.

---

## Stage 3 — Ground-truth traceability + debugger truth

### 3.1 Registry-driven decoder debug events (stop UI guessing)

- **Problem**: `webapp/src/App.tsx` infers “decoder matches” from template names
  and hardcoded heuristics, which can be wrong and can’t attribute output to
  specific decoders reliably.
- **Files**: `src/registry.ts`, `src/index.ts`, `src/types.ts`, `webapp/src/App.tsx`
- **Work**:
  - Extend registry decoding to support debug mode:
    - `decodeAll(ctx, { debug: true }) → { patch, debug: DecoderDebugEvent[] }`
  - Each event includes:
    - `decoderId`
    - `matchedTemplates` (instances, ideally with raw + location)
    - `fieldsProduced` (top-level field paths written by the decoder)
  - Thread `debugDecoders?: boolean` through `fetchWiktionary()`.
  - Update webapp to render returned debug events instead of inferring them.
- **Schema impact**: ideally none (keep debug out of normalized output by
  default, or attach under an optional `debug` field gated by an option).
- **Acceptance**:
  - UI shows exact decoder IDs and matched template instances for the selected
    entry.

### 3.2 Preserve template ordering + location metadata

- **Problem**: `Entry.templates` groups by name, losing:
  - template order
  - where the template occurred (line/offset), making click-to-source brittle.
- **Files**: `src/parser.ts`, `src/types.ts`, `src/index.ts`, schema, webapp
- **Work**:
  - Extend template parsing to optionally include:
    - `start`, `end` (character offsets in block)
    - `line` (1-based line number within `posBlockWikitext`)
  - Add `Entry.templates_all?: StoredTemplateInstance[]` preserving order, each
    with `{ name, raw, params, start?, end?, line? }`.
  - Keep `Entry.templates` for backwards compatibility and fast lookup.
- **Schema impact**: **MINOR** (add optional `templates_all`).
- **Acceptance**:
  - Webapp highlighting can target exact line/offset (no substring heuristics).

---

## Stage 8 — Packaging & distribution hardening (npm/CLI/server)

### 8.1 Make CLI/server runnable from published installs

- **Problem**:
  - `package.json` `bin` points to `cli/index.ts`, but `npm run build` only
    compiles `src/**/*`. A published package won’t ship runnable JS for the CLI
    unless the consumer also has `tsx` and TS sources.
  - `server.ts` is also not compiled into `dist/`.
- **Files**: `package.json`, `tsconfig.json`, build scripts, possibly file moves
- **Work**:
  - Compile `cli/index.ts` and `server.ts` into `dist/` as part of build.
  - Point `bin.wiktionary-fetch` to built JS (CJS or ESM, whichever is most
    reliable for Node CLI execution).
  - Ensure `files` includes the built CLI/server artifacts.
  - (Optional) add smoke tests that run the built CLI on a fixture.
- **Acceptance**:
  - `npm pack` contains runnable CLI/server JS.
  - Global install exposes a working `wiktionary-fetch` command without `tsx`.

### 8.2 Cache key normalization for redirects

- **Problem**: cache is keyed by the requested title only, missing hits when
  redirects normalize the title.
- **Files**: `src/api.ts`
- **Work**:
  - After fetch, store under both:
    - `wikt:${requestedTitle}`
    - `wikt:${normalizedTitle}`
  - Do not change the returned `title` behavior (keep it normalized).
- **Acceptance**:
  - Redirect lookups hit cache on subsequent requests regardless of the input
    spelling/casing.

### 8.3 Align TypeScript types with schema

- **Problem**: `EntryType` allows arbitrary `string`, while schema enumerates.
- **Files**: `src/types.ts`, schema, tests
- **Work**:
  - Tighten `EntryType` to match the schema enum (or explicitly decide to make
    schema extensible and document the policy).
- **Acceptance**:
  - TS types and schema are consistent; schema tests enforce the contract.

---

## Stage 5 — Lemma resolution robustness + performance

### 5.1 Cycle protection and explicit linkage metadata

- **Files**: `src/index.ts`, tests
- **Work**:
  - Track visited lemma requests per `(lang, lemma)` to prevent cycles and
    redundant work.
  - Parallelize lemma fetch initiation (rate limiting still enforces etiquette).
  - Record explicit metadata about which `Entry` / which form-of template
    triggered lemma resolution.
- **Acceptance**:
  - No infinite loops on pathological pages.
  - Batch runs complete faster and deterministically.
  - Linkage metadata is explicit and traceable.

---

## Stage 6 — Introspection engine becomes exact (no probe hacks)

### 6.1 Declare decoder coverage explicitly in the registry

- **Problem**: `tools/template-introspect.ts` uses a probe list + “did decoding
  produce a patch?” which can under/overcount coverage.
- **Files**: `src/registry.ts`, `tools/template-introspect.ts`
- **Work**:
  - Extend `TemplateDecoder` with optional declared metadata, e.g.:
    - `handlesTemplates?: string[]`
  - Export registry metadata for introspection tooling.
  - Compare discovered category templates to declared handled templates.
- **Acceptance**:
  - Coverage report is stable, explainable, and does not depend on dummy decode
    outcomes.

### 6.2 Expand coverage measurement beyond categories (optional)

- **Files**: `tools/template-introspect.ts`
- **Work**:
  - Add an optional mode that samples real Greek entries and reports:
    - templates encountered
    - templates decoded (by declared coverage)
    - “top missing templates by frequency”
- **Acceptance**:
  - Report can prioritize decoder work using observed frequency, not just
    category membership.

---

## Stage 2 — “Source-faithful” text handling improvements

### 2.1 Store both raw and stripped sense glosses; make stripping brace-aware

- **Problem**: `stripWikiMarkup()` is regex-based and can mis-handle nested
  templates/markup, removing unintended text.
- **Files**: `src/registry.ts`, `src/types.ts`, schema, tests
- **Work**:
  - Add `Sense.gloss_raw` containing the exact text after `#` / `##`.
  - Keep `Sense.gloss` as a derived, brace-aware stripped form.
  - Implement stripping with brace-aware scanning (not regex), then link/format
    stripping as a second pass.
- **Schema impact**: **MINOR** (add `gloss_raw`).
- **Acceptance**:
  - Fixtures demonstrate stable stripping without deleting adjacent content.
  - `gloss_raw` always matches the source line content (minus the list marker).

---

## Stage 7 — Broaden explicit extraction to additional section families

### 7.1 Add section decoders for explicit list templates (no heuristics)

- **Goal**: extract more structured data from explicit templates in sections
  like Derived terms / Related terms / Descendants (only what’s explicitly
  templated).
- **Files**: `src/registry.ts`, `src/types.ts`, schema, tests + fixtures
- **Work**:
  - Add decoders for the templates that appear in fixtures (e.g. `{{l}}`,
    `{{link}}`, etc.).
  - Store both:
    - structured extracted items
    - verbatim section raw text for forensic traceability
- **Schema impact**: likely **MINOR** (new optional fields).
- **Acceptance**:
  - New fields appear only when explicitly present in Wikitext.
  - Raw section text is retained alongside structured extraction.
