# AI Agent Onboarding & Technical Constraints

This document provides specialized context for AI coding assistants working on the `wiktionary-sdk` project.

---

## Project stage: alpha — no backward-compatibility mandate

**Directive (strong):** The SDK is **alpha**. There are **no external production users** who must be shielded from churn in **file paths**, **internal module layout**, **non-documented imports**, or **incidental APIs**.

- **Do not** refuse or defer a structural refactor solely for “backward compatibility” of repo layout or deep import paths. Prefer **clarity, modularity, and maintainability** when they conflict with leaving old paths in place.
- **Do** preserve intentional **public contracts**: the **`wiktionary-sdk` package entry** (today `src/index.ts` → built `dist`), **documented** shapes (`Lexeme`, `FetchResult`, …), **`SCHEMA_VERSION`**, **JSON Schema** parity (`schema/src/` → `build:schema`), and **test + CI green** after each change.
- **Do** keep **CLI / webapp / library parity** (§4) when adding or moving **user-facing** convenience entrypoints.

When in doubt: ship the refactor behind **green `npm run test:ci`**, updated **types/schema/docs**, and a **clear commit** — not behind compatibility shims unless a shim is explicitly requested for a release tag.

---

## 🎯 Core Mission
**Source-faithful extraction over linguistic inference.**
We extract what is *explicitly* in the Wikitext. We do not guess stems, complete paradigms, or infer data not found in template parameters.

### ⚠️ Source of truth: domain data model (read before changing output shape)

Collaborators must know **where the contract lives** and **what to edit**:

| What | Authoritative location | Rule |
|------|------------------------|------|
| **TypeScript runtime types** | `src/model/` (`src/model/index.ts` barrel) | Canonical interfaces (`Lexeme`, `FetchResult`, `SCHEMA_VERSION`, …). Edit the appropriate `src/model/*.ts` slice; keep `model/index.ts` and `src/index.ts` public re-exports aligned. |
| **JSON Schema (authoring)** | `schema/src/root.yaml` and `schema/src/defs/*.yaml` | **Only** these YAML files are edited to change the normalized-output schema. |
| **JSON Schema (published)** | `schema/normalized-entry.schema.json` | **Generated — do not hand-edit.** After any YAML change run **`npm run build:schema`**, then commit the updated JSON alongside the YAML. |
| **Which def lives in which file** | `tools/schema-def-modules.ts` | Each `$defs` name is listed in exactly one module; add new defs there when splitting or adding files. |

**CI:** `npm run test:ci` runs **`check:schema-artifact`**, which rebuilds from YAML and fails if the committed JSON drifts.

**Detail:** [`schema/README.md`](schema/README.md).

---

## 🏗️ Architectural Anchors

### 1. Registry-Based Decoders (`src/decode/registry.ts` + `src/decode/registry/register-*.ts`)
The engine is a decentralized registry of pure functions (`TemplateDecoder`). **`registerAllDecoders(reg)`** (`register-all-decoders.ts`) orchestrates family **`register*(reg)`** modules under **`src/decode/registry/`**; the package entry **`decode/registry.ts`** builds the singleton, re-exports **`registerAllDecoders`**, predicates, and **`stripWikiMarkup`**.
- **Pattern**: If a template exists in the wild, create a decoder for it.
- **Strict Rule**: Do not add mapping logic to the parser or orchestrator. Keep it in the registry layer (family **`register-*.ts`** modules and `src/decode/registry/*.ts` helpers).
- **Per-language form-of templates** (en.wiktionary): Treat `{{xx-verb form of|…}}`, `{{xx-noun form of|…}}`, `{{xx-adj form of|…}}` as first-class. The lemma is often **only** in `|1=`; the language is implied by the template name. They must participate in the same `form_of` / `guessLexemeTypeFromTemplates` path as `inflection of` so **lemma resolution** (second `wiktionary()` fetch) runs when the definition line is template-only. **`only used in`** is *not* a lemma pointer; it is decoded on sense lines as structured `only_used_in` (see `src/model/sense.ts`).
- **Extended “Category:Form-of templates” family**: `isFormOfTemplateName()` (re-exported from `decode/registry.ts`, defined in `form-of-predicates.ts`) recognises the core `FORM_OF_TEMPLATES` set, per-lang templates above, names ending in ` … of`, and a few extras (e.g. `rfform`, `IUPAC-*`). **`isVariantFormOfTemplateName()`** decides `FORM_OF` vs `INFLECTED_FORM` when `guessLexemeTypeFromTemplates` runs. Run `npm run report:form-of` to compare the live Wiktionary category against this logic.
- **Registration order**: Register decoders that depend on shared constants (`GENDER_MAP`, etc.) **after** those constants are defined in the registering module (no forward reference). **`src/decode/registry/decoder-ids.ts`** (`EXPECTED_DECODER_IDS`) and **`test/registry-decoder-order.test.ts`** lock the canonical `id` sequence; update them when appending a decoder.
- **One registration per `id`**: Do not duplicate `reg.register({ id: "…" })` blocks (e.g. merge conflicts). Order of patches changes behaviour.
- **Corpus evidence**: New production decoders must appear in a fixture or test string, or be listed in `DECODER_EVIDENCE_ALLOWLIST` in `test/decoder-coverage.test.ts`, so the decoder coverage test stays green.

### 2. Brace-Aware Parser (`src/parse/parser.ts`)
A custom parser handles nested `{{...}}` structures. 
- **Context**: Standard regex is insufficient for Wikitext. Always use the provided parser to extract `TemplateCall` objects.

### 3. Entry Types (`src/model/`)
- `LEXEME`: A lemma (e.g., γράφω).
- `INFLECTED_FORM`: A specific form (e.g., έγραψε) that maps to a lemma.

### 4. Interface Synchronization (Public API Parity)
- **Strict Rule**: Any new convenience function added under `src/convenience/` (barrel `src/convenience/index.ts`) MUST be immediately implemented in both:
    - `webapp/src/App.tsx`: Added to `API_METHODS` and `handleApiExecute`.
    - `cli/index.ts`: Added to the `extract` router in `main()`.
- **Reason**: To ensure that the Web API Playground and the terminal CLI are always on par with the underlying NPM package.

### 4b. Lexeme classification (PoS vs lexicographic section)
- **`part_of_speech`**: strict grammatical part of speech only (`PartOfSpeech` in `src/model/part-of-speech.ts`). Headword templates and recognized PoS headings may set it; morpheme/symbol/phraseology sections leave it `null`.
- **`lexicographic_section` / `lexicographic_family`**: always set from the section heading via `src/parse/lexicographic-headings.ts` (expanded taxonomy, comparable to [wiktionary-scraper](https://github.com/LearnRomanian/wiktionary-scraper) headings).
- **`Lexeme.type`** (`LEXEME` / `INFLECTED_FORM` / `FORM_OF`): still determined only by **form-of templates** in wikitext, not by whether the heading says “Abbreviation” or “Noun”.

### 4c. Sense-level semantic relations (`src/pipeline/sense-relation-linker.ts`)
- **Hybrid model**: `lexeme.semantic_relations` (flat, backward-compatible) + `lexeme.semantic_relations_by_sense` (sense-keyed projection, additive). Both are always consistent: the by-sense view is a strict subset of the flat view.
- **Evidence capture** is split between **decode time** (the `semantic-relations` decoder stamps `source_evidence: "template_id"` / `"section_scope"` on items with explicit anchors) and **link time** (the post-decode linker in `src/pipeline/sense-relation-linker.ts` scores all items against all senses and assigns `matched_sense_id` + `confidence`).
- **Three confidence tiers**: `high` (template `id=` anchor, score 100), `medium` (qualifier/gloss overlap >= 5), `low` (heuristic token overlap >= 2). Items scoring below 2 are left unlinked — they remain in the flat structure but do not appear in `semantic_relations_by_sense`.
- **All 11 relation families** participate: synonyms, antonyms, hypernyms, hyponyms, coordinate_terms, holonyms, meronyms, troponyms, comeronyms, parasynonyms, collocations.
- **Convenience layer**: `synonymsBySense()`, `antonymsBySense()`, `relationsBySense(family, …)` return sense-grouped results; `richEntry()` exposes `relations_by_sense`. Flat wrappers (`synonyms()`, etc.) unchanged.
- **Schema**: `SemanticRelation` extended with `source_evidence`, `confidence`, `matched_sense_id`; new `$defs` `RelationSourceEvidence`, `RelationConfidence`, `SemanticRelationsBySense`.
- **Detail**: [`docs/sense-level-semantic-relations.md`](docs/sense-level-semantic-relations.md).

### 5. Environment-Agnostic Assets (Cross-Platform Parity)
- **Strict Rule**: Templates and static assets MUST be bundled as imported TypeScript strings (see `src/present/templates/templates.ts`) rather than loaded via Node-specific filesystem APIs (`fs`, `path`).
- **Reason**: To ensure the SDK remains fully functional in both Node.js (CLI/Server) and Browser (Webapp) environments without a runtime filesystem.
- **Authoring workflow**: Edit the source files `src/present/templates/entry.html.hbs`, `lexeme-homonym-group.html.hbs`, `entry.md.hbs`, and `entry.css`. The webapp Vite dev server watches them and regenerates `templates.ts` on save; commit the regenerated `templates.ts` so CLI and package consumers stay in sync without running Vite.

### 6. Schema Synchronization (High-Fidelity Parity)
- **Reminder:** The **source-of-truth table** for types vs YAML vs generated JSON is in **§ Source of truth: domain data model** above; read it first.
- **Strict Rule**: Any change to the structure of `Entry`, `Sense`, `WikidataEnrichment`, or other core interfaces in `src/model/` MUST be reflected in:
    - **JSON Schema (author-time YAML):** Edit `schema/src/root.yaml` and/or `schema/src/defs/*.yaml` (see `tools/schema-def-modules.ts`), then run **`npm run build:schema`** and commit the generated **`schema/normalized-entry.schema.json`** (do not hand-edit the JSON). See `schema/README.md`.
    - `docs/schemata/*.yaml`: Update the reference YAML models (e.g., `DictionaryEntry.yaml`) to ensure documentation parity.
- **Sense-only or presentation fields**: If you add structured sense data (e.g. decoded definition templates), also update **Handlebars + CSS** and regenerate **`src/present/templates/templates.ts`** so HTML output stays in sync with the package API.
- **Reason**: To maintain the SDK's promise of a deterministic, machine-readable output that external consumers can rely on for validation.

---

## ⚖️ Rigid Constraints & "No Heuristics" Policy

1.  **No article HTML scraping**: Do not fetch or parse arbitrary **article** HTML from `/wiki/…` outside the API. Always use the MediaWiki API in `src/ingress/api.ts`. **Allowed (documented exceptions):** `action=parse` on **wikitext you already hold** to obtain structured expansion output — same class of call as Greek conjugation/declension expansion in `src/convenience/morphology.ts`, per-lang form-of nested inflection lines in `src/pipeline/form-of-parse-enrich.ts` (see **`docs/form-of-display-and-mediawiki-parse.md`** for rationales, Spanish Lua case, and explicit non-goals), and **ISO 639 template enrichment** in `src/pipeline/iso639-enrich.ts` (expanding `{{ISO 639|N}}` to resolve the language name for Translingual Symbol entries).
2.  **No linguistic "Guessing"**: If a stem or gender is missing from a headword template, do not attempt to calculate it. Leave the field undefined.
3.  **Traceability**: Every field added to a `NormalizedEntry` must be traceable to a source line or template parameter.
4.  **Verbatim Storage**: All template calls must be stored verbatim in `entry.templates` for forensic verification.
5.  **Terminology**: In docs and UI, say **wikitext** or **templates** when referring to source `{{…}}` markup. Reserve **Wikidata** for QID / `wikibase_item` enrichment from `src/ingress/api.ts`. Do not conflate the two.
6.  **User-facing definitions**: Do not show raw `{{…}}` wikitext as the primary definition gloss in HTML or formatted output. Decode into structured fields and a plain `gloss` string; keep verbatim text on `gloss_raw` or structured `raw` fields for traceability (see `only_used_in` and similar patterns).
7.  **Support transparency (all extractors, not only `stem`)**: For **every** **public** API that **extracts** structured dictionary data from wikitext / normalized lexemes for downstream or user-facing use—including **all** functions under `src/convenience/*` re-exported from the package, plus any other exported extractor that would return **empty, null, or false** when the **source could still plausibly hold** that kind of data but the SDK **does not yet implement** the relevant decoders, template families, or enrichment path—**do not treat silence as correct**. The caller must be able to distinguish:
    - **Genuinely absent** in the source (no section, no templates, editor never added the data), vs  
    - **Present or likely present in wikitext**, but **not extracted** because of **SDK coverage** (undecoded `{{…}}` families, unimplemented parameters, language-specific headword tables we do not parse, optional Wikidata not fetched, etc.).
    **How to surface it:** Prefer an explicit machine-readable field (e.g. `support_warning`, `extraction_note`, or optional `LexemeResult.support_warning` alongside `value`) plus user-visible text in **`format()`** / CLI / playground where applicable. Page-level issues may continue to use `FetchResult.notes`. **Pure utilities** that do not represent “we tried to extract slot X” (e.g. `stripCombiningMarksForPageTitle`, heading taxonomy mappers, scalar `lemma()` resolution) are out of scope unless they explicitly claim extraction of a named slot.

    **Living audit — do we honor this today?** **`LexemeResult.support_warning`** (optional, alongside `value`) is wired through **`mapLexemes`** via **`withExtractionSupport`** / **`src/convenience/extraction-support.ts`**. **`format()`** branch **3b** appends **`Support:`** for grouped wrapper arrays. **`stem`** lifts **`WordStems.support_warning`** onto the row so JSON does not duplicate it inside `value`. Remaining gaps: wrappers with no template-based signal yet (e.g. **`comeronyms` / `parasynonyms` / `collocations`**), **`partOfSpeech` / `lexicographicClass`**, **`audioGallery`**, many link/list helpers, **`wikidataQid` / `image`** when enrichment is off, **`etymologyText`**, and **`richEntry`**.

    | Area | Public entrypoints (representative) | Transparency status |
    |------|-------------------------------------|------------------------|
    | Paradigms / stems | `stem`, `stemByLexeme` | **Implemented** (row `support_warning`; `WordStems` still carries it for direct `format(extractStemsFromLexeme(…))`) |
    | Paradigms / tables | `conjugate`, `decline`, `principalParts`, `inflectionTableRef` | **Implemented** (row warnings where helpers apply) |
    | Morphology traits | `morphology` | **Implemented** |
    | Headword slots | `gender`, `transitivity` | **Implemented**; `partOfSpeech`, `lexicographicClass` — **Gap** |
    | Semantic relations | `synonyms`, `antonyms`, `hypernyms`, `hyponyms` | **Implemented** (raw `{{syn}}` / `{{ant}}` / `{{hyper}}` / `{{hypo}}` vs empty list; **sense-level linking** with `source_evidence` / `confidence` / `matched_sense_id` + `semantic_relations_by_sense`); `comeronyms`, `parasynonyms`, `collocations` — **Gap** (support warnings) |
    | Pronunciation | `ipa`, `pronounce`, `hyphenate`, `syllableCount`, `rhymes`, `homophones` | **Implemented**; `audioGallery` — **Gap** |
    | Senses / translations | `translate` (gloss + en senses + native-senses row), `exampleDetails`, `citations` | **Implemented**; `richEntry` — **Gap** |
    | Etymology | `etymology`, `etymologyChain`, `etymologyCognates` | **Implemented**; `etymologyText` — **Gap** |
    | Wikidata / media / links | `wikidataQid`, `image`, … | **Gap** (noisy / enrichment-dependent) |
    | Section lists | `derivedTerms`, … | **Gap** (mostly section-driven; add warnings when a stable template signal exists) |
    | Core fetch | `wiktionary`, `wiktionaryRecursive` | **Partial** — `notes` covers some page-level cases |

    **Engineering direction:** When extending a wrapper, add detection analogous to `stem`: if the lexeme is **in scope** for that extraction and **templates / sections suggest** data the decoder does not consume, set a warning string. For wrappers whose `value` is a bare `string[]` or scalar, prefer evolving to a small envelope type or an optional **`support_warning`** on **`LexemeResult`** (additive, backward-compatible) so JSON/CLI consumers see the same story as formatted output.

---

## 🛠️ How to Modify rendering & Styles

The SDK uses **Handlebars** for high-fidelity rendering of dictionary entries. 

1.  **HTML Design**: Edit `src/present/templates/entry.html.hbs` (per-lexeme) and `src/present/templates/lexeme-homonym-group.html.hbs` (homonym merge via `formatFetchResult`).
2.  **Markdown Design**: Edit `src/present/templates/entry.md.hbs`.
3.  **Styling**: Edit `src/present/templates/entry.css`.
4.  **Helpers**: Custom Handlebars helpers (like `join`, `ifCond`, `addOne`, `langLabel`, `etymSymbol`, `subLetter`, `filterInstanceOf`) are registered in `src/present/handlebars-setup.ts` (loaded via `src/present/formatter.ts`).
5.  **Bundle**: After editing the `.hbs` / `.css` sources, ensure `src/present/templates/templates.ts` is updated (run `npm run dev` in `webapp/` and save, or regenerate by the same logic the Vite plugin uses) and commit it.
6.  **Whitespace**: Handlebars `~` strips whitespace between tokens. When lemma and part-of-speech sit in adjacent inline spans (and there is no romanization buffer), add CSS so they do not visually merge (e.g. `.entry-line-head .lemma ~ .pos { margin-left: … }`).

**Etymology labels in templates:** use `{{langLabel this}}` inside `{{#each etymology.chain}}` / cognate loops. Decoders set `source_lang` on every link; `source_lang_name` is optional. The helper mirrors the `source_lang_name || source_lang` fallback used elsewhere so tags never render empty.

When modifying templates, ensure you maintain the "Gold Standard" typographic density and academic aesthetic.

## 🛠️ How to Add Support for a New Template

1.  **Identify**: Find the template on Wiktionary (e.g., `{{el-noun-m-ος-2}}`).
2.  **Define**: Update the relevant `src/model/*.ts` file if a new PoS-specific interface is needed.
3.  **Implement**: Add a new `reg.register({ … })` block in the appropriate **`src/decode/registry/register-*.ts`** family module (preserve order; extend **`decoder-ids.ts`** and `registry-decoder-order.test.ts`).
4.  **Form-of family**: If the template is a language-prefixed inflection line (`xx-verb form of`, etc.), wire it into `FORM_OF_TEMPLATES` / `isPerLangFormOfTemplate` (or equivalent) and ensure `guessLexemeTypeFromTemplates` returns `INFLECTED_FORM` when appropriate so nested lemma UX works.
5.  **Verify**: Run the verification script: `npx tsx tools/verify_templates.ts`.

---

## 🔧 Practical edge cases (extractors & playground)

These behaviours come up often when extending decoders or the webapp.

### `{{hyphenation|…}}` syllables (`register-core-pronunciation.ts`)
- **Do not** assume the first positional is always a language code (`slice(1)` blindly drops the first syllable for `{{hyphenation|γρά|φω}}`).
- **Order matters**: If the first positional is non-ASCII (e.g. Greek syllable), **all** positionals are syllables. If the first is ASCII-only and the second is non-ASCII, the first is usually a language tag (`el`, …). For all-ASCII runs, use an explicit allowlist of language codes and known compound tags (e.g. `grk-ita`), not a loose regex that mis-reads Latin syllables as codes.

### Stub language sections on en.wiktionary
- Some sections contain **only** a form-of line (e.g. `{{es-verb form of|lemma}}`) or a restriction template (e.g. `{{only used in|nl|…}}`) with **no** `===Etymology===`. **Empty etymology there is correct**—do not invent prose. **Do** decode templates so the card is not blank and lemma resolution can run where applicable.
- **Lua vs wikitext for morph lines:** A single `# {{xx-verb form of|lemma}}` line has **no** `##` subsenses; detailed inflection glosses may exist **only** after Lua runs. With `enrich` on, the SDK may fill `form_of.display_morph_lines` from `action=parse` (see **`docs/form-of-display-and-mediawiki-parse.md`**). This is not a substitute for `##` lines when editors add them — subsenses still win.

### Form-of headline display (`src/present/format-core.ts` / `handlebars-setup.ts`, templates)
- **Abbrev positionals** (`voc`, `m`, `s`, …): inline phrase + gender beside PoS, not three bullets.
- **Multiple morph lines** (from `##`, `display_morph_lines`, or expanded tags): bullet list + `of:` + lemma row.
- **Single** morph gloss: inline with headword; **label-only** (e.g. plural): compact `headword` + lowercased label + `of:`.

### Webapp language filter
- When adding a first-class lookup language for the playground (e.g. Spanish `es`), add it to the **`LANGUAGES`** (or equivalent) list in `webapp/src/App.tsx` so the bar filter matches `langToLanguageName` / `extractLanguageSection`.

### Fuzzy case matching and deterministic ordering
- **`buildFuzzyQueryVariants()`** (`src/pipeline/wiktionary-core.ts`) generates NFC, lowercased, **capitalize-first**, and combining-mark-stripped variants (plus cross-products). All six candidates are deduplicated via `Set` and then **sorted alphabetically** (Unicode codepoint order) before iteration.
- **Consequence:** `"god"` and `"God"` produce **identical** variant sets `["God", "god"]` in the same order — merge is **symmetric and deterministic** with respect to input casing.
- **en.wiktionary case sensitivity:** Unlike Wikipedia, en.wiktionary.org has **case-sensitive** first characters. `"God"` and `"god"` are genuinely **different pages** with distinct editorial content (proper noun vs common noun). Fuzzy mode discovers both but does **not** merge them — they are separate lexemes with separate IDs. The webapp annotates provenance (`page: God` / `page: god` tags) when lexemes from different pages share a pill group.

### Wikidata QID and Translingual entries
- **Wikipedia-fallback exclusion:** When the Wikidata QID is resolved via the Wikipedia-title fallback (step 3 of the `§8` resolution chain), **Translingual** lexemes (`lex.language === "Translingual"`) are **skipped** and receive no `wikidata` block. Wikipedia articles describe language-specific concepts (e.g. Q190 = "god" the deity), which are semantically wrong for Translingual entries (ISO 639 codes, taxonomic symbols).
- **ISO 639 enrichment** (`src/pipeline/iso639-enrich.ts`): Translingual Symbol entries with `{{ISO 639|N}}` definition lines receive dedicated enrichment when `enrich: true`. The template is expanded via `action=parse` to resolve the language name (e.g. "Godié"), and the Wikidata QID is looked up via the language's Wikipedia article (e.g. "Godié language" → Q3914412). This is an allowed `action=parse` usage per constraint §1 (expanding wikitext the SDK already holds).

### Wikidata disambiguation resolution pipeline
- **Winner application (`src/pipeline/wiktionary-core.ts`):** After `buildSenseMatchesForDisambiguation` scores each lexeme sense against Wikipedia disambiguation candidates, matches with **score >= 4** are applied: the matching sense gets `sense.wikidata_qid`, the best overall candidate replaces `lex.wikidata.qid`, and `Q4167410` is stripped from `instance_of`. The original disambiguation QID is kept in `disambiguation.source_qid` for traceability. When no sense passes the threshold, `disambiguation.unresolved = true` is set.
- **Threshold design:** Score >= 4 means at least two title-token overlaps (2 × 2), one title-token + two aux-token hits (2 + 1 + 1), or a title-phrase match (>= 4). This avoids false positives from single-token coincidences while catching legitimate matches for polysemous words like "pan" (25+ candidates).
- **Rendering suppression (`filterInstanceOf` helper):** `Q4167410` is structurally a Wikimedia page-type marker, not a semantic classification. The `filterInstanceOf` Handlebars helper in `handlebars-setup.ts` removes it from `instance_of` arrays before rendering in both `entry.html.hbs` and `lexeme-homonym-group.html.hbs`. Unresolved disambiguation QIDs render in muted italic style.
- **Per-sense QID pills:** When `sense.wikidata_qid` is set, a small inline pill renders after the sense gloss in both single-entry and homonym-group templates. CSS class `.metadata-pill-sense`.
- **Webapp deduplication:** When all visible lexemes share the same unresolved disambiguation QID, the webapp hoists it to a single global annotation below the dictionary card (`.dict-wikidata-global-note` in `webapp/src/index.css`), avoiding repetitive per-lexeme display.
- **Schema additions:** `Sense.wikidata_qid` (`05-senses.yaml`), `WikidataDisambiguation.source_qid` and `.unresolved` (`02-provenance-and-media.yaml`).
- **Test expectations:** `test/fallback-enrichment-matrix.test.ts` asserts the new behavior: promoted QID (`Q37260` instead of `Q1215628`), `source_qid` traceability, per-sense `wikidata_qid`, and `Q4167410` absent from `instance_of`.

### Webapp form-of chain resolution
- **`pickLemmaLexemeFromSecondFetch`** (`webapp/src/pick-lemma-lexeme.ts`) returns a discriminated union `PickLemmaResult` with three cases: `found` (LEXEME match), `chain` (target is itself a form-of pointing elsewhere), `not-found` (with descriptive reason).
- **`FormOfLexemeBlock`** uses a `switch` on the result kind instead of mining `FetchResult.notes` for error messages. For chain cases (e.g. `{{ellipsis of|en|oh God}}` → "oh God" is `{{alt form|en|oh my God}}`), the webapp shows `"oh God" is itself a reference to → "oh my God"` with inherited serif typography (not the former red sans-serif error style).

### Form-of template short aliases
- **`VARIANT_TEMPLATES`** (`src/decode/registry/form-of-predicates.ts`) now includes common Wiktionary short aliases: `altcase`, `alt case`, `altsp`, `altform`, `alternative case form of`, `alternative spelling of`. These were previously unrecognized — entries using them (e.g. `{{altcase|en|God}}`) rendered with empty glosses.
- **`form-of-display-label.ts`** maps aliases to readable labels (e.g. `altcase` → "Alternative case form").

### `{{lb}}` label connector tokens
- `parseLbTemplate` (`src/decode/registry/register-senses.ts`) treats `_`, `also`, `and`, `or`, `;`, `,` as connector tokens. `_` joins adjacent labels without a comma; other connectors merge into the preceding label as natural-language phrasing. Previously, `_` became a blank label producing double commas (e.g. "Trinitarian, , Christianity").

### Usage note preprocessing
- `formatUsageNoteLine` (`src/decode/registry/format-usage-note-line.ts`) strips leading wikitext bullet markers (`*`, `#`, `:`, `;`) before wiki markup processing. The leading `*` was previously conflated with Markdown `*…*` emphasis markers, causing `applyInlineEmphasis` to italicize wrong text spans.

### SDK infrastructure configuration (`src/ingress/configure.ts`)
- **Pattern:** "configure-once, use-everywhere." Rate limiters, caches, and retry policies are global singletons set at application startup via **`configureSdk()`**, **`configureRateLimiter()`**, or **`configureCache()`** — not per-call options on `wiktionary()`.
- **Package exports:** `configureSdk`, `configureRateLimiter`, `configureCache`, `SdkConfig`, `RateLimiterConfig`, `CacheAdapter` are all re-exported from the barrel (`src/index.ts`) via `src/ingress/configure.ts`.
- **`maxRetries429`** (`RateLimiterConfig`): Controls how many times `mwFetchJson` retries on HTTP 429. Default 3; set 0 to disable. The value lives on the `RateLimiter` instance (read as `limiter.maxRetries429`), not as a module-level constant.
- **Default rate limit interval:** `DEFAULT_RATE_LIMIT_MIN_INTERVAL_MS = 200` (5 req/s). More conservative than Wikimedia's 200 req/s bot guideline because browser contexts cannot set a proper `User-Agent` and face stricter server-side limits.
- **429 retry in `mwFetchJson`:** Honors `Retry-After` header (integer seconds, capped at 10s) or exponential backoff (1s, 2s, 4s, capped at 10s). After all retries are exhausted, the original HTTP error propagates.
- **Webapp form-of resolution:** `FormOfLexemeBlock.tsx` calls `wiktionary({ enrich: false })` for secondary lemma resolution to reduce API call volume. Do not re-enable enrichment on nested fetches without addressing the resulting request storm.
- **When adding new configurable knobs:** Place infrastructure-level config on `RateLimiterConfig` (for network behavior) or the cache options object (for storage behavior), then wire through `SdkConfig` in `configure.ts`. Do not add config to `wiktionary()` call options unless it is genuinely per-request (like `enrich`, `sort`, `matchMode`).

### `{{taxon}}` and inline display templates in `stripWikiMarkup`
- **`{{taxon}}`** is handled both in `glossFromAuxDefinitionTemplate` (definition-line decoder producing "A taxonomic {rank} within the {parent_rank} {parent_name} – {description}") and in `stripWikiMarkup` (inline context extraction). All positional params are recursively stripped of nested wiki markup.
- **Extended allowlist** in `stripWikiMarkup`: `{{w}}` (Wikipedia link), `{{vern}}` (vernacular name), `{{taxlink}}` / `{{taxfmt}}` (taxonomic links), `{{gloss}}` / `{{gl}}`, `{{non-gloss definition}}` / `{{ngd}}` / `{{n-g}}`. These templates carry visible text that was previously silently dropped, causing empty glosses for Translingual taxonomic entries and any definition line relying on these templates.
- **When adding new inline templates:** Add to the `if/else if` chain in `strip-wiki-markup.ts` with the appropriate positional parameter index. Recursively call `stripWikiMarkup(param, options)` on extracted text so nested markup is also resolved.

### Etymology chain rendering (`etym-inline`, `etym-paren-lead`)
- **Non-breaking spaces** (`&nbsp;`) prevent orphaned symbols: after the `<` in `etym-paren-lead`, and after each inter-step `etymSymbol` connector. Handlebars `~` whitespace control eliminates phantom trailing spaces in singleton chains.
- **`lang-tag` spacing:** `.lang-tag:not(:empty) { margin-right: 0.2em }` — provides spacing between language name and term only when the lang-tag has content. Empty lang-tags (no source language on the chain item) produce zero visual width, relying on the `&nbsp;` in `etym-paren-lead` alone.
- **Font size:** `.etym-inline` uses `font-size: 0.8em; line-height: 1.35` — matching `.entry-line-note` for typographic consistency.
- **CSS escape in `templates.ts`:** The Vite dev server copies CSS source into a TypeScript template literal. CSS hex escapes like `\00a0` conflict with TypeScript's octal escape parser; prefer `margin-right` or actual Unicode characters over `content: '\00a0'` in CSS embedded in template literals.

### HTTP error messages (`mwFetchJson`)
- Error messages are now descriptive: `"HTTP 429 — Too Many Requests — please wait a moment and try again"` instead of the bare `"HTTP 429"`. The error format is always `"HTTP {status} — {reason}"`. When `res.statusText` is available, it is used; otherwise, 429 gets a specific message and all others get `"request failed"`.

### Normalized PoS and form-of sort order (webapp grouping)
- **PoS sort order** (`POS_SORT_RANK` in `webapp/src/lexeme-pill-groups.ts`): Within each headword group, parts of speech are sorted by a canonical tier ranking grounded in European lexicographic convention (OED, Duden, Van Dale), Wiktionary's WT:ELE editorial convention, and capitalization visibility. The tiers (lower = earlier): **0** proper noun/name → **1** noun → **2** verb (all subtypes including Japanese) → **3** adjective → **4** adverb → **5** pronoun → **6** numeral → **7** determiner/article → **8** preposition/postposition → **9** conjunction → **10** interjection → **11** particle → **12** participle → **13** phrase/expression/proverb → **14** affix types → **15** abbreviation → **16** character/symbol → **17** Japanese specialty → **99** fallback. Within the same tier, alphabetical by PoS slug.
- **Form-of sort order** (`FORM_OF_SORT_RANK`): Within each PoS group, form-of referrals are sorted by morphological proximity to the lemma: **0** plural of → **1** inflection of (core paradigm) → **2** specific morph categories (verb/noun/adj form of, participle, tense forms) → **3** alternative form → **4** alternative case → **5** alternative spelling → **6** diminutive/augmentative → **7** abbreviation/short for/clipping → **8** misspelling → **9** ellipsis of → **99** catch-all. Language-prefixed form-of templates (`xx-verb form of`, etc.) sort at tier 1.
- **Sort key chain in `buildHeadwordGroups`:** form (alphabetical) → LEXEME before form-of → PoS rank → etymology_index → form-of rank → original index. Post-build, `posGroups` are explicitly sorted by PoS rank (not Map insertion order).
- **`groupByPosWithinLanguage`** uses the same PoS rank for consistency.

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
4. **Group logically**: one commit per cohesive unit of work (e.g. one roadmap phase in `docs/ROADMAP.md`, one feature area). Do not mix unrelated changes; do not split a single feature across many tiny commits.
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
docs: update README, spec, CHANGELOG, and ROADMAP after a roadmap phase

Rewrite README.md with updated architecture diagram, full project
structure, all npm scripts, Docker usage, decoder coverage table, and
schema versioning reference.

Update wiktionary-fetch-spec.md from v0.9 draft to v1.0.

When roadmap items ship, update **`CHANGELOG.md`** (versioned notes + roadmap history appendix) and trim or check off items in **`docs/ROADMAP.md`**; keep “what shipped” narrative primarily in the spec §13 and changelog.
```

---

## 📚 Essential Reading
- [Test suite guide](test/README.md) (mocking, tiers, goldens, coverage)
- [Wiktionary SDK spec](docs/wiktionary-sdk-spec.md) (ground truth)
- [Form-of display & MediaWiki parse enrichment](docs/form-of-display-and-mediawiki-parse.md) (Lua vs wikitext, Spanish case, parse API rationale, what not to do)
- [**Sense-level semantic relations**](docs/sense-level-semantic-relations.md) (hybrid model, evidence tiers, linking algorithm, schema, convenience API)
- [Query result dimensional matrix](docs/query-result-dimensional-matrix.md) (combinatorics: languages, PoS, etymologies, lexeme types, morph richness, fuzzy merge)
- [Roadmap / staged product backlog](docs/ROADMAP.md) (remaining engineering + product work; delivered stages in `CHANGELOG.md`)
- [**Modular `src/` layout refactor (phased)**](docs/src-layout-refactor-plan.md) (ingress → parse → decode → pipeline → present → convenience → model split; alpha-era, no path-compat obligation)
- [**Layer dependency rules**](docs/architecture-layers.md) (allowed import edges + diagram; pairs with the refactor plan)
