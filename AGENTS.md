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
- **Per-language form-of templates** (en.wiktionary): Treat `{{xx-verb form of|…}}`, `{{xx-noun form of|…}}`, `{{xx-adj form of|…}}` as first-class. The lemma is often **only** in `|1=`; the language is implied by the template name. They must participate in the same `form_of` / `guessLexemeTypeFromTemplates` path as `inflection of` so **lemma resolution** (second `wiktionary()` fetch) runs when the definition line is template-only. **`only used in`** is *not* a lemma pointer; it is decoded on sense lines as structured `only_used_in` (see `types.ts`).
- **Extended “Category:Form-of templates” family**: `isFormOfTemplateName()` in `registry.ts` recognises the core `FORM_OF_TEMPLATES` set, per-lang templates above, names ending in ` … of`, and a few extras (e.g. `rfform`, `IUPAC-*`). **`isVariantFormOfTemplateName()`** decides `FORM_OF` vs `INFLECTED_FORM` when `guessLexemeTypeFromTemplates` runs. Run `npm run report:form-of` to compare the live Wiktionary category against this logic.
- **Registration order**: Register decoders that depend on shared constants (`GENDER_MAP`, etc.) **after** those constants are defined in the file (no forward reference).
- **One registration per `id`**: Do not duplicate `registry.register({ id: "…" })` blocks (e.g. merge conflicts). Order of patches changes behaviour.
- **Corpus evidence**: New production decoders must appear in a fixture or test string, or be listed in `DECODER_EVIDENCE_ALLOWLIST` in `test/decoder-coverage.test.ts`, so the decoder coverage test stays green.

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

### 5. Environment-Agnostic Assets (Cross-Platform Parity)
- **Strict Rule**: Templates and static assets MUST be bundled as imported TypeScript strings (see `src/templates/templates.ts`) rather than loaded via Node-specific filesystem APIs (`fs`, `path`).
- **Reason**: To ensure the SDK remains fully functional in both Node.js (CLI/Server) and Browser (Webapp) environments without a runtime filesystem.
- **Authoring workflow**: Edit the source files `src/templates/entry.html.hbs`, `entry.md.hbs`, and `entry.css`. The webapp Vite dev server watches them and regenerates `templates.ts` on save; commit the regenerated `templates.ts` so CLI and package consumers stay in sync without running Vite.

### 6. Schema Synchronization (High-Fidelity Parity)
- **Strict Rule**: Any change to the structure of `Entry`, `Sense`, `WikidataEnrichment`, or other core interfaces in `src/types.ts` MUST be reflected in:
    - `schema/normalized-entry.schema.json`: Update the JSON Schema to match the new structure.
    - `docs/schemata/*.yaml`: Update the reference YAML models (e.g., `DictionaryEntry.yaml`) to ensure documentation parity.
- **Sense-only or presentation fields**: If you add structured sense data (e.g. decoded definition templates), also update **Handlebars + CSS** and regenerate **`src/templates/templates.ts`** so HTML output stays in sync with the package API.
- **Reason**: To maintain the SDK's promise of a deterministic, machine-readable output that external consumers can rely on for validation.

---

## ⚖️ Rigid Constraints & "No Heuristics" Policy

1.  **No Scraping**: Never attempt to scrape the rendered Wiktionary HTML. Always use the MediaWiki API provided in `api.ts`.
2.  **No linguistic "Guessing"**: If a stem or gender is missing from a headword template, do not attempt to calculate it. Leave the field undefined.
3.  **Traceability**: Every field added to a `NormalizedEntry` must be traceable to a source line or template parameter.
4.  **Verbatim Storage**: All template calls must be stored verbatim in `entry.templates` for forensic verification.
5.  **Terminology**: In docs and UI, say **wikitext** or **templates** when referring to source `{{…}}` markup. Reserve **Wikidata** for QID / `wikibase_item` enrichment from `api.ts`. Do not conflate the two.
6.  **User-facing definitions**: Do not show raw `{{…}}` wikitext as the primary definition gloss in HTML or formatted output. Decode into structured fields and a plain `gloss` string; keep verbatim text on `gloss_raw` or structured `raw` fields for traceability (see `only_used_in` and similar patterns).

---

## 🛠️ How to Modify rendering & Styles

The SDK uses **Handlebars** for high-fidelity rendering of dictionary entries. 

1.  **HTML Design**: Edit `src/templates/entry.html.hbs`.
2.  **Markdown Design**: Edit `src/templates/entry.md.hbs`.
3.  **Styling**: Edit `src/templates/entry.css`.
4.  **Helpers**: Custom Handlebars helpers (like `join`, `ifCond`, `addOne`, `langLabel`, `etymSymbol`) are defined in `src/formatter.ts`.
5.  **Bundle**: After editing the `.hbs` / `.css` sources, ensure `src/templates/templates.ts` is updated (run `npm run dev` in `webapp/` and save, or regenerate by the same logic the Vite plugin uses) and commit it.
6.  **Whitespace**: Handlebars `~` strips whitespace between tokens. When lemma and part-of-speech sit in adjacent inline spans (and there is no romanization buffer), add CSS so they do not visually merge (e.g. `.entry-line-head .lemma ~ .pos { margin-left: … }`).

**Etymology labels in templates:** use `{{langLabel this}}` inside `{{#each etymology.chain}}` / cognate loops. Decoders set `source_lang` on every link; `source_lang_name` is optional. The helper mirrors the `source_lang_name || source_lang` fallback used elsewhere so tags never render empty.

When modifying templates, ensure you maintain the "Gold Standard" typographic density and academic aesthetic.

## 🛠️ How to Add Support for a New Template

1.  **Identify**: Find the template on Wiktionary (e.g., `{{el-noun-m-ος-2}}`).
2.  **Define**: Update `types.ts` if a new PoS-specific interface is needed.
3.  **Implement**: Create a new `TemplateDecoder` in `registry.ts`.
4.  **Form-of family**: If the template is a language-prefixed inflection line (`xx-verb form of`, etc.), wire it into `FORM_OF_TEMPLATES` / `isPerLangFormOfTemplate` (or equivalent) and ensure `guessLexemeTypeFromTemplates` returns `INFLECTED_FORM` when appropriate so nested lemma UX works.
5.  **Verify**: Run the verification script: `npx tsx tools/verify_templates.ts`.

---

## 🔧 Practical edge cases (extractors & playground)

These behaviours come up often when extending decoders or the webapp.

### `{{hyphenation|…}}` syllables (`src/registry.ts`)
- **Do not** assume the first positional is always a language code (`slice(1)` blindly drops the first syllable for `{{hyphenation|γρά|φω}}`).
- **Order matters**: If the first positional is non-ASCII (e.g. Greek syllable), **all** positionals are syllables. If the first is ASCII-only and the second is non-ASCII, the first is usually a language tag (`el`, …). For all-ASCII runs, use an explicit allowlist of language codes and known compound tags (e.g. `grk-ita`), not a loose regex that mis-reads Latin syllables as codes.

### Stub language sections on en.wiktionary
- Some sections contain **only** a form-of line (e.g. `{{es-verb form of|lemma}}`) or a restriction template (e.g. `{{only used in|nl|…}}`) with **no** `===Etymology===`. **Empty etymology there is correct**—do not invent prose. **Do** decode templates so the card is not blank and lemma resolution can run where applicable.

### Webapp language filter
- When adding a first-class lookup language for the playground (e.g. Spanish `es`), add it to the **`LANGUAGES`** (or equivalent) list in `webapp/src/App.tsx` so the bar filter matches `langToLanguageName` / `extractLanguageSection`.

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
