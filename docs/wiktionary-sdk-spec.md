# Wiktionary SDK — Formal Specification (v1.1)

**Scope:** deterministic, source-faithful extraction of lexicographic data from **Wiktionary** (primary), optionally enriched with **Wikidata** and **Wikimedia Commons**.  
**Non-scope:** any linguistic inference, paradigm completion, stem guessing, accent rules, generation of missing forms.

## 1. Goals

Given:

- `query_term: string` (required)
- `lang: string` (required; BCP-47-ish codes, e.g. `el`, `grc`)
- optional disambiguators:
  - `preferred_pos?: string`
  - `enrich_wikidata?: boolean` (lemma-only)

Return:

1) **verbatim** Wikitext extracted from Wiktionary via MediaWiki API  
2) a **normalized JSON/YAML representation** derived *only* from explicit Wikitext/template data  
3) optional Wikidata enrichment for lemma entries (QID, sitelinks, P18 image)

The output conforms to a formal JSON Schema (`schema/normalized-entry.schema.json`), versioned per `VERSIONING.md`.

**Roadmap note (non-normative):** this document specifies v1.1 behavior and
data contracts. For planned post‑v1.1 hardening and further template coverage, 
see `docs/ROADMAP.md`.

## 2. Data Sources

### 2.1 Wiktionary (primary)

- API endpoint: `https://en.wiktionary.org/w/api.php`
- Fetch method:
  - `action=query`
  - `prop=revisions|pageprops`
  - `rvprop=content`
  - `rvslots=main`
  - `redirects=1`

**Rationale:** the English Wiktionary is used as the canonical parsing surface even for Greek entries.

### 2.2 Wikidata (optional enrichment)

- API endpoint: `https://www.wikidata.org/w/api.php`
- Fetch method:
  - `action=wbgetentities`
  - `props=labels|descriptions|claims|sitelinks`

Used only if `pageprops.wikibase_item` is present.

### 2.3 Wikimedia Commons (media)

- If Wikidata `P18` exists, derive thumbnail URL using the standard upload path algorithm (MD5 of filename).

### 2.4 API Etiquette

All API requests are subject to:

- **Rate limiting**: configurable throttle, default 100ms minimum interval (10 req/s) per Wikimedia guidelines. Managed by `src/rate-limiter.ts`.
- **User-Agent**: custom header identifying the tool (`Wiktionary SDK/1.0`).
- **Caching**: multi-tier cache (`src/cache.ts`) prevents redundant requests. L1 in-memory with TTL, L2/L3 pluggable for persistent and shared storage.
- **Unicode Normalization**: All Wikitext, page titles, and query strings are normalized to **NFC (Unicode Composed Form)** via `src/api.ts` and `src/index.ts`. This ensures consistent matching of Greek accented characters (e.g., `έ`) across different operating systems (MacOS NFD vs. Linux/Web NFC).

## 3. Outputs

### 3.1 Raw output

- `rawLanguageBlock: string` (required): the full language section block, e.g. `==Greek==…`

### 3.2 Normalized output

Top-level (`FetchResult`):

```yaml
schema_version: "1.0.0"
rawLanguageBlock: "==Greek==..."
entries: [...]
notes: [...]
debug: [...]   # optional; present when debugDecoders=true
```

- `schema_version` (required): Semantic version of the output schema, from
  `SCHEMA_VERSION` in `src/types.ts`. Enables consumers to detect format
  evolution.
- `debug` (optional): When `fetchWiktionary({ debugDecoders: true })` is used,
  `debug[i]` is an array of `DecoderDebugEvent` for `entries[i]`, listing which
  decoder matched which templates and what fields it produced. **Rationale:**
  enables developers to verify extraction correctness and diagnose missing
  decoders without inspecting raw wikitext manually.

Each `Entry` contains:

| Field | Type | Source |
|-------|------|--------|
| `id` | string | Generated from lang, title, etymology index, POS heading, entry type |
| `language` | WikiLang | Input parameter |
| `query` | string | Input parameter |
| `type` | `LEXEME \| INFLECTED_FORM` | Determined by presence of form-of templates |
| `form` | string | Page title |
| `etymology_index` | integer | Parsed from `===Etymology N===` headings |
| `part_of_speech_heading` | string | Verbatim POS section heading |
| `part_of_speech` | string? | From headword templates (`el-verb`, etc.) or heading mapping |
| `pronunciation` | `{IPA?, audio?}` | From `{{IPA}}`, `{{el-IPA}}`, `{{audio}}` |
| `hyphenation` | `{syllables?, raw}` | From `{{hyphenation}}` |
| `senses` | `Sense[]` | From `#` / `##` / `#:` definition lines |
| `semantic_relations` | `SemanticRelations` | From `{{syn}}`, `{{ant}}`, `{{hyper}}`, `{{hypo}}` |
| `etymology` | `EtymologyData` | From `{{inh}}`, `{{der}}`, `{{bor}}`, `{{cog}}` |
| `usage_notes` | `string[]` | From `===Usage notes===` section text |
| `form_of` | `FormOf` | From form-of templates (inflected forms only) |
| `translations` | `Record<lang, TranslationItem[]>` | From `{{t}}`, `{{t+}}`, etc. Each item has `term` (required), `gloss?`, `transliteration?`, `gender?`, `alt?` from explicit params. |
| `derived_terms` | `SectionWithLinks` | From `{{l}}`/`{{link}}` in `====Derived terms====` section |
| `related_terms` | `SectionWithLinks` | From `{{l}}`/`{{link}}` in `====Related terms====` section |
| `descendants` | `SectionWithLinks` | From `{{l}}`/`{{link}}` in `====Descendants====` section |
| `templates` | `Record<name, StoredTemplate[]>` | All template calls, stored verbatim |
| `templates_all` | `StoredTemplateInstance[]` | Templates in document order with optional `start`, `end`, `line`. **Rationale:** preserves ordering and location for forensic traceability and click-to-source. |
| `lemma_triggered_by_entry_id` | string? | When this lemma was resolved for an inflected form, the entry id that triggered it. **Rationale:** explicit linkage metadata for cycle-free lemma resolution. |
| `wikidata` | `WikidataEnrichment` | Optional QID, labels, descriptions, sitelinks, media |
| `source` | `{wiktionary: WiktionarySource}` | Full traceability metadata |

**Mandatory traceability:**

```yaml
source:
  wiktionary:
    site: en.wiktionary.org
    title: γράφω
    language_section: Greek
    etymology_index: 1
    pos_heading: Verb
```

### 3.3 Sense structure

Definition lines are parsed into `Sense` objects:

```yaml
senses:
  - id: S1
    gloss: "to write"
    examples:
      - "He writes every day."
    subsenses:
      - id: S1.1
        gloss: "to write by hand"
```

- `#` lines produce top-level senses with sequential IDs (`S1`, `S2`, ...).
- `##` lines produce subsenses nested under the preceding sense (`S1.1`, `S1.2`, ...).
- `#:` lines produce examples attached to the preceding sense.
- Wiki markup (`[[links]]`, `'''bold'''`, `''italic''`, templates) is stripped from glosses.
- `gloss_raw` (optional): the exact text after `#` / `##` before stripping. **Rationale:** enables consumers to apply custom stripping or retain verbatim source; supports forensic verification.
- Stripping is **brace-aware**: `[[link|display]]` → display, `[[link]]` → link; nested `{{...}}` removed correctly; no regex-induced duplication.

### 3.4 Semantic relations

```yaml
semantic_relations:
  synonyms:
    - term: σημειώνω
      qualifier: formal
  antonyms:
    - term: σβήνω
```

Extracted from `{{syn|el|...}}`, `{{ant|el|...}}`, `{{hyper|el|...}}`, `{{hypo|el|...}}`. The optional `q=` named parameter maps to `qualifier`.

### 3.5 Etymology data

```yaml
etymology:
  links:
    - template: inh
      source_lang: grc
      term: γράφω
      gloss: "to write"
      raw: "{{inh|el|grc|γράφω|t=to write}}"
```

Extracted from `{{inh}}`, `{{der}}`, `{{bor}}`, `{{cog}}` and their long-form aliases. The `cog` template uses `pos[0]` as source language; the others use `pos[1]` (pos[0] being the target language).

### 3.6 Section link lists (Derived / Related / Descendants)

Sections `====Derived terms====`, `====Related terms====`, `====Descendants====` may contain `{{l}}` or `{{link}}` templates. Each such section is stored as `SectionWithLinks`:

```yaml
derived_terms:
  raw_text: "* {{l|el|αντιγράφω|gloss=to copy}}\n* {{link|el|γραφή}}"
  items:
    - term: αντιγράφω
      lang: el
      gloss: "to copy"
      template: l
      raw: "{{l|el|αντιγράφω|gloss=to copy}}"
```

- `raw_text`: verbatim section content for forensic traceability.
- `items`: structured extraction from `{{l}}`/`{{link}}` only; no heuristics.
- **Design choice:** we extract only explicitly templated links. Plain text or `[[wikilinks]]` in these sections are not parsed into items.

### 3.7 Schema versioning

The output shape is formalized in `schema/normalized-entry.schema.json` (JSON Schema draft-07). The schema version (`1.0.0`) follows Semantic Versioning and is documented in `VERSIONING.md`. A `SCHEMA_VERSION` constant is exported from `src/types.ts`.

### 3.9 Convenience API & High-Level Wrappers

The SDK provides a high-level functional layer above the raw `FetchResult` to simplify common lexicographical queries.

| Wrapper | Type | Rationale |
|---------|------|-----------|
| `lemma(q, l)` | string | Resolves inflections to canonical lemmas. |
| `ipa(q, l)` | string | Returns primary IPA transcription. |
| `pronounce(q, l)` | string | Returns absolute audio URI (Commons). |
| `synonyms(q, l)` | string[] | List of synonyms. |
| `etymology(q, l)` | object | Structured lineage tree. |
| `translate(q, l, t)` | string[] | Gloss-mode translation. |
| `stem(q, l)` | WordStems | Logical stems extracted from templates. |
| `conjugate(q, c, l)` | string[] or Record | Targeted cell (criteria given) or full paradigm table (empty criteria). |
| `decline(q, c, l)` | string[] or Record | Targeted cell (criteria given) or full declension table (empty criteria). |
| `morphology(q, l)` | GrammarTraits | Inferred grammar from POS and forms; seeds smart defaults. |
| `inflect(q, c, l)` | string[] | (Internal) High-level coordinate extraction. |

### 3.11 Morphological Extraction Methodology (The "Scribunto" Exception)

To fulfill the primary goal of providing accurate conjugation and declension paradigms, the SDK implements a specialized **"Morphology through Execution"** strategy. 

#### 3.11.1 The Scribunto/Lua Runtime
Many Wiktionary languages (e.g., Finnish, Modern Greek, German) utilize the **Scribunto** MediaWiki extension to run **Lua** scripts server-side. These scripts compute thousands of morphological permutations on-the-fly, which are not stored as static text.

#### 3.11.2 Extraction Pipeline: `action=parse`
1. **Template Capture**: The SDK isolates the declarative morphology template (e.g., `{{el-conjug-1st}}`).
2. **Expansion**: The raw template is sent to the MediaWiki `action=parse` API endpoint.
3. **DOM Dissection**: The SDK receives the rendered HTML and uses `node-html-parser` to structurally traverse the generated `.inflection-table`.
4. **Coordinate Mapping**: Grammatical keys (e.g., `person: "3", number: "singular"`) are mapped to the intersecting table cells to retrieve the literal form.

**Rationale**: This ensures absolute parity with the human-facing website without the SDK needing to maintain its own linguistic rule engine. This constitutes the project's single documented exception to the _"No HTML Scraping"_ rule.

### 3.10 Morphology Engine and Smart Defaults

The `conjugate()` and `decline()` functions implement a **Smart Override** strategy:
1.  **Inference**: `morphology(query)` is called to determine the inherent grammar of the input word (e.g., "έγραψες" → 2nd person singular past).
2.  **Merging**: User-provided criteria (e.g., `{ number: "plural" }`) are merged over the inherent grammar.
3.  **Execution**: The engine resolves the final coordinate (e.g., 2nd person *plural* past) via DOM parsing.

**Rationale**: This allows for shorthand usage like `conjugate("έγραψες", { number: "plural" })` resulting in "γράψατε", which matches human intuition for language manipulation.

## 4. Parsing Pipeline

### 4.1 Language block extraction

- Locate exact language header `==Greek==` for `lang=el`, etc.
- Return only that block (up to the next level-2 header or end of page).
- **Unknown language codes:** If `lang` is not in the known mapping (el, grc,
  en, nl, de, fr), `langToLanguageName()` returns `null` and `fetchWiktionary()`
  returns early with `empty entries` and a note. No silent fallback to Greek.

### 4.2 Etymology and PoS segmentation

- Split on `===Etymology===` / `===Etymology N===`
- Split on PoS headings (level 3 within language block)

### 4.3 Template extraction

A brace-aware parser (`src/parser.ts`) extracts `{{...}}` blocks and captures
their verbatim `raw` wikitext, including nested templates.

- Returns `TemplateCall`:
  - `name`
  - `params.positional[]`
  - `params.named{}`
  - `raw` (verbatim)

**Implementation note:** Parameter splitting is fully brace-aware. Pipes inside
`[[...]]` are preserved (link depth). Pipes inside `{{...}}` are also preserved
(template depth). Only split on `|` when both depths are zero. This avoids
silent mis-parses when `{{t|el|fr|écrire|g={{g|m}}}}` appears.

### 4.4 Definition line parsing

Within each PoS block, definition lines are parsed into `Sense` objects (see section 3.3).

### 4.5 Section extraction

Named sections (`===Usage notes===`, `====Translations====`) are identified by heading regex and their content is extracted up to the next same-level or higher heading.

## 5. Decoder Registry Architecture

The system is a registry of pure decoders (`src/registry.ts`):

```ts
interface TemplateDecoder {
  id: string
  matches(ctx: DecodeContext): boolean
  decode(ctx: DecodeContext): Partial<NormalizedEntry>
}
```

**Rules:**

- Decoders may only read explicit template parameters or explicit Wikitext lines/sections.
- Decoders must not infer stems/endings/classes if not present.
- All template calls are stored verbatim under `entry.templates`.

**Current decoder families:**

1. **Raw storage** (`store-raw-templates`): runs on every context; stores all templates verbatim.
2. **Pronunciation**: `ipa`, `el-ipa`, `audio`, `hyphenation`.
3. **Headword / POS**: `el-verb-head`, `el-noun-head`, `el-adj-head`, `el-adv-head`, `el-pron-head`, `el-numeral-head`, `el-participle-head`, `el-art-head`.
4. **Form-of**: detects `inflection of`, `infl of`, `form of`, `alternative form of`, and 7 other form-of templates.
5. **Translations**: parses `====Translations====` sections for `t`, `t+`, `tt`, `tt+`, `t-simple`.
6. **Senses**: parses `#` / `##` / `#:` lines.
7. **Semantic relations**: `syn`, `ant`, `hyper`, `hypo`.
8. **Etymology**: `inh`, `der`, `bor`, `cog` (+ long-form aliases).
9. **Usage notes**: extracts `===Usage notes===` section text.
10. **Section links**: parses `====Derived terms====`, `====Related terms====`, `====Descendants====` for `{{l}}` and `{{link}}` templates; stores both `raw_text` and structured `items`.

Each decoder may declare `handlesTemplates: string[]` for introspection; `registry.getHandledTemplates()` returns the union for coverage reporting.

## 6. Lemma Resolution (explicit only)

For `INFLECTED_FORM` entries:

- Detect form-of templates (e.g. `{{inflection of|...}}`)
- Extract lemma from template parameters (explicit)
- **Prioritization**: When resolving a lemma, the engine prioritizes entries explicitly marked as `INFLECTED_FORM` over metadata-only blocks (like Pronunciation sections) to ensure the correct entry is chosen for the query.
- Fetch lemma page and include lemma LEXEME entry

Disambiguation:

- If lemma has multiple PoS entries, mark those matching `preferred_pos` as `preferred: true`.
- Do **not** guess if absent.

## 7. Translation Parsing (explicit only)

Within a PoS block, detect translation sections:

- `====Translations====`
- Extract only from explicit translation templates:
  - `{{t}}`, `{{t+}}`, `{{tt}}`, `{{tt+}}`, `{{t-simple}}`

**Translation item shape:** For `{{t|target_lang|source_lang|term|...}}`, the
decoder uses `pos[1]` as translation language and `pos[2]` as term. Explicit
named params: `t=` or `gloss=` → gloss; `tr=` → transliteration; `g=` → gender;
`alt=` → alternative form. `term` is authoritative; `gloss` only when explicitly
provided.

## 8. Wikidata Enrichment (lemma-only)

If enabled and if `pageprops.wikibase_item` exists:

- Fetch entity
- Attach labels, descriptions, sitelinks, and `P18` image with thumbnail URL

## 9. Template Coverage Strategy

"100% coverage" is defined as:

> The library can **extract and store verbatim** and **structurally decode** *all template families used in Greek entries*, without needing any heuristics.

A **Template Introspection Engine** (`tools/template-introspect.ts`) crawls Greek template categories on en.wiktionary.org and produces a Missing Decoder Report listing templates without registered decoders.

## 10. Non-Goals and Safety

- No scraping of rendered HTML is required when Wikitext is available via API.
- No generation of linguistic data not present in sources.
- All results are traceable back to raw template parameters.

## 11. Distribution

The engine is available through multiple interfaces:

| Interface | Location | Description |
|-----------|----------|-------------|
| TypeScript library | `src/` | Core engine, importable as ESM or CJS (`dist/esm/`, `dist/cjs/`) |
| React webapp | `webapp/` | Interactive inspector with debugger mode and comparison view |
| CLI | `dist/cjs/cli/index.js` | Built from `cli/index.ts`. Supports standard AST dumps and explicit wrapper execution via `--extract`. |
| HTTP API | `dist/cjs/server.js` | Built from `server.ts`. `npm run serve` runs built server. |
| Docker | `Dockerfile` | Multi-stage Alpine build for containerized deployment |

**Packaging:** Published npm installs ship runnable CLI and server. No `tsx` or
TypeScript sources required for consumers. Cache keys normalize redirects:
`wikt:${requestedTitle}` and `wikt:${normalizedTitle}` both store the result.
**Browser Support:** All API calls use `origin: "*"` to support native browser
execution within the Webapp's API Playground.

## 12. Design Rationale

### 12.1 Modular Engine vs. Integrated App
The project is deliberately split into a core engine (`/src`) and presentation layers (`/webapp`, `/cli`, `server.ts`). This separation ensures that the core extraction logic remains **platform-agnostic**.

### 12.2 Registry-Based Decoder Architecture
Instead of a monolithic parser, the system uses a **Registry of Template Decoders**.
- **Extensibility:** New templates can be supported by simply registering a new decoder.
- **Traceability:** Each field in the normalized output can be traced back to the specific decoder and source parameters that produced it.
- **Safety:** Decoders are pure functions that operate on isolated `DecodeContext`, preventing side-effects and ensuring deterministic results.

### 12.3 Source-Faithful Extraction ("No Heuristics")
The library follows a strict **"Extraction, not Inference"** policy.
- **Why?** Linguistic data on Wiktionary is often incomplete or inconsistent. By only extracting explicit parameters, we avoid the risk of generating incorrect paradigms or stem guesses.
- **Handover:** This specialized focus makes the library a perfect "Layer 1" for higher-level linguistic engines that *do* perform morphology generation.

### 12.4 Multi-Tier Caching
API responses are cached in a `TieredCache` to avoid redundant network requests:
- **L1 (Memory):** Fast, transient, always active.
- **L2 (Persistent):** Pluggable adapter for IndexedDB (browser) or SQLite (Node).
- **L3 (Shared):** Pluggable adapter for Redis or similar, for service deployments.

This design keeps the engine agnostic — consumers inject adapters at init time.

### 12.5 Graphical Client as a Verification Tool
The `/webapp` is not just a demo; it is a **Developer Inspector**.
- **Click-to-source:** Clicking any YAML output element highlights the corresponding template in the raw wikitext pane.
- **Debugger Mode:** Shows exactly which decoder matched which template and what fields it produced.
- **Comparison View:** Side-by-side view of the same term in different languages or etymology blocks.

### 12.6 Registry-Driven Debug Events
When `debugDecoders: true` is passed to `fetchWiktionary`, each entry receives a `DecoderDebugEvent[]` listing decoder id, matched templates, and fields produced. **Rationale:** coverage reporting and introspection tools no longer rely on probe-based heuristics ("did decoding produce a patch?"); they use declared `handlesTemplates` and actual decode outcomes. The webapp uses this for the Decoder column in debug mode.

### 12.7 Template Ordering and Location Metadata
`templates_all` stores templates in document order with optional `start`, `end`, `line`. **Rationale:** preserves source order for forensic verification; enables accurate click-to-source mapping when raw wikitext and decoded output are displayed side-by-side.

### 12.8 Section Links: Explicit-Only Extraction
Derived/Related/Descendants sections are stored with both `raw_text` (verbatim) and `items` (from `{{l}}`/`{{link}}` only). **Design choice:** we do not parse plain wikilinks or free text into structured items; only explicitly templated links are extracted. This keeps the output source-faithful and avoids heuristics.

### 12.9 Brace-Aware Gloss Stripping
`stripWikiMarkup()` uses depth-based scanning rather than regex for `[[links]]` and `{{templates}}`. **Rationale:** regex-based replacement can mis-handle nested structures (e.g. `[[link]]` producing duplicated text, or `{{t|g={{g|m}}}}` leaving stray braces). The brace-aware implementation: (1) finds matching `]]`/`}}` by depth counting; (2) extracts `[[link|display]]` → display, `[[link]]` → link; (3) recursively strips markup inside link display text; (4) removes templates entirely. **Design choice:** process `'''` before `''` to avoid partial italic matches.

### 12.10 Formatter Architecture
`src/formatter.ts` provides a polymorphic `format(data, options)` function that dispatches to a registered `FormatterStyle`. The type of `data` is detected at runtime (RichEntry, InflectionTable, EtymologyStep[], Sense[], WordStems, GrammarTraits) and routed to the appropriate style method. Built-in styles:
- **text**: plain strings, suitable for logging and tests.
- **markdown**: bolded keys, inline code for forms, `←` etymology arrows.
- **html**: `<span>` and `<div>` markup, suitable for static site output.
- **ansi**: ANSI escape sequences (`\x1b[32m` green, `\x1b[36m` cyan, etc.) for colourised terminal output.
- **terminal-html**: inline `style="color: ..."` HTML for browser pseudo-terminals (used by the webapp playground).

**Design choice:** `styleRegistry` is a plain object; `registerStyle()` allows consumers to add custom styles (e.g. LaTeX, CSV) without modifying the core library. The dispatcher runs before style dispatch, keeping each style method purely presentational.

### 12.11 Playground as Authentic CLI Mirror
The webapp's API Playground is designed to mirror the real CLI as closely as possible. The pseudo-terminal displays the exact command the user could run in a shell (`wiktionary-sdk γράφω --lang el --extract stem`) alongside the colour-coded output. This reinforces the playground's role as a teaching and exploration tool, not just a debugging panel, and makes the CLI feel immediately approachable. The macOS window chrome (traffic-light dots, centred window title) reinforces the terminal analogy.

---

**Artifacts:**
- `src/index.ts`: Orchestration entry point.
- `src/types.ts`: Canonical type definitions (`SCHEMA_VERSION = "1.0.0"`).
- `src/formatter.ts`: Multi-format output engine (`format()`, `FormatterStyle`, `registerStyle()`).
- `schema/normalized-entry.schema.json`: Formal output schema.
- `webapp/src/App.tsx`: React frontend with inspector, comparison mode, and CLI playground.
- `webapp/src/index.css`: Dual-theme stylesheet (light dictionary + dark inspector).
- `cli/index.ts`: CLI tool with `--extract`, `--props`, `--format ansi`.
- `server.ts`: HTTP API wrapper.
- This specification document.

## 13. Post-v1.0 roadmap (non-normative)

This section is informational only; it does not change v1.0 requirements.
For the detailed staged plan and acceptance criteria, see `docs/ROADMAP.md`.

**Completed (post-v1.0):**

- **Parser correctness**: fully brace-aware template parameter splitting
  (split on `|` only when both `[[...]]` and `{{...}}` depths are zero).
- **Translation shape correctness**: `term` (required), `gloss?`, `transliteration?`,
  `gender?`, `alt?` from explicit params. No inference.
- **Unknown language behavior**: `langToLanguageName()` returns `null` for
  unknown codes; `fetchWiktionary()` returns early with a note.
- **Schema versioning**: `FetchResult` always includes `schema_version`.
- **Distribution hardening**: CLI and server compiled to `dist/`; `bin` and
  `serve` point to built JS. Cache key normalization for redirects.
- **Type alignment**: `EntryType` matches schema enum.
- **Registry-driven debug events**: `fetchWiktionary({ debugDecoders: true })` returns
  `FetchResult.debug` with per-entry decoder match info.
- **Template ordering and location**: `Entry.templates_all` stores templates in document
  order with optional `start`, `end`, `line`. Parser supports `parseTemplates(..., withLocation)`.
- **Cycle protection and lemma linkage**: `fetchWiktionaryRecursive` with visited set;
  `lemma_triggered_by_entry_id` on resolved lemma entries.
- **Declared decoder coverage**: `handlesTemplates` on decoders; `getHandledTemplates()` for
  introspection. Template-introspect uses declared coverage instead of probe-based logic.
- **Sense gloss_raw**: `Sense.gloss_raw` stores exact text before stripping.
- **Section links**: `derived_terms`, `related_terms`, `descendants` with `raw_text` and `items`
  from `{{l}}`/`{{link}}` in `====Derived terms====`, etc.
- **Sample mode**: `--sample N` flag on template-introspect samples real Greek entries and
  reports top missing templates by frequency.

**Completed (v1.1 SDK Evolution):**

- **Morphology Engine**: Implement `conjugate()`, `decline()`, `stem()`, and `morphology()`
  wrappers.
- **High-Level Strategy**: Smart defaults for paradigm generation (inherent grammar discovery).
- **Convenience API**: 17 explicit wrappers for semantic, phonetic, and ontological data.
- **CLI Router**: Dynamic command extraction via `--extract` and parameter passing via `--props`.
- **API Playground**: Interactive visualizer in Webapp for direct SDK exploration.
- **CORS Support**: Added `origin: "*"` to all MediaWiki API calls for browser feasibility.

**Completed (v1.2 Formatter, Morphology Improvements & Playground Polish):**

- **Multi-format output system** (`src/formatter.ts`): Polymorphic `format()` function with a
  registered-style architecture. Five built-in styles: `text` (plain), `markdown`, `html`,
  `ansi` (ANSI colour codes for terminals), and `terminal-html` (inline-style HTML for browser
  pseudo-terminals). The `FormatterStyle` interface allows third-party styles to be registered
  via `registerStyle()`. **Rationale:** decouples rendering from extraction; one result object
  can be rendered in any target environment without changing the core engine.

- **CLI ANSI output**: `wiktionary-sdk --extract stem γράφω` now automatically selects `ansi`
  format when stdout is a TTY (smart default). Explicit override available via `--format ansi`.
  **Design choice:** behaviour mirrors well-established Unix CLI conventions (colours only when
  interactive).

- **`conjugate()` / `decline()` full-table mode**: When called with an empty criteria object
  `{}`, these functions now return the _entire_ paradigm table as a structured
  `Record<string, any>` (active/passive × indicative × present/past, with person-number keys
  `1sg`, `2sg`, … for verbs; singular/plural × case for nouns). When criteria are provided,
  the targeted single-cell extraction is used as before.
  **Rationale:** allows exploratory use and use-cases where the full paradigm is needed.

- **`morphology()` smart detection improvements**: The function now filters out non-linguistic
  entries (Pronunciation, References, Further reading, Etymology headers) before attempting
  exact form matching. Case-insensitive comparison added. LEXEME detection now seeds default
  grammatical traits by part of speech (verbs → indicative/present/active/1sg; nouns/adj →
  nominative/singular).

- **Row-header matching fix in `conjugate()`**: Header cells such as `"1st sg"` and `"1 sg"`
  are now matched via a permissive regex (`/^1(?:st|nd|rd)?\s*sg/i`) instead of simple
  `startsWith`, eliminating silent misses for headers with ordinal suffixes.

- **Webapp: dual-theme UI with salve-style header**: The playground now uses a strict
  dual-theme system — a light-mode dictionary interface (serif Alegreya, `#F7F7F5` background,
  Google-inspired search bar) and a dark `.dark-island` technical inspector (monospace
  JetBrains Mono, `#111622` background). The page header follows the aesthetic of
  [rhythmus.github.io/salve](https://rhythmus.github.io/salve/): left-aligned, Inter
  sans-serif, bold app name followed by inline descriptor, small muted tagline below.

- **Webapp: authentic CLI terminal experience**: The pseudo-terminal in the API Playground now
  renders the exact CLI command that corresponds to the current widget state (e.g.
  `~ wiktionary-sdk γράφω --lang el --extract stem`) before showing the colour-coded output.
  The macOS window chrome (traffic-light dots + centred `wiktionary-sdk` title) completes the
  terminal aesthetic. Output is formatted via `TerminalHtmlStyle` and injected via
  `dangerouslySetInnerHTML`.

- **Webapp: GitHub corner**: Canonical tholman-style GitHub corner with octocat wag animation
  on hover, linking to `https://github.com/rhythmus/wiktionary-sdk`. Replaces the previous
  inline link.

- **Webapp: Wikidata checkbox removed**: The `enrich` boolean toggle was removed from the UI.
  Wikidata enrichment is unconditionally enabled (`enrich: true`) in the Playground — the flag
  remains fully available in the TypeScript API and CLI (`--no-enrich`).
  **Rationale:** the checkbox was misleading (implied a search-scope filter) and redundant for
  a demo context where Wikidata augmentation should always be active.

**Completed (v1.3 Compliance, Normalization & Robustness):**

- **README Compliance Suite**: Integrated `test/readme_examples.test.ts` to ensure 100% parity
  between documentation and implementation.
- **Unicode Normalization (NFC)**: Forced all inputs (queries) and outputs (wikitext, titles) to
  NFC normalization in `src/api.ts` and `src/index.ts`, resolving cross-platform comparison
  failures.
- **Lemma Resolution Prioritization**: Updated `src/library.ts` to favor `INFLECTED_FORM` entries
  when searching for a lemma, preventing metadata blocks from intercepting resolution.
- **Robust IPA Decoding**: Updated `src/registry.ts` to find IPA even if slashes (`/`) or 
  brackets (`[]`) are missing in the wikitext template.
- **Hyphenation Support**: Confirmed `hyphenate()` returns arrays by default and supports 
  the `{ format: 'string' }` option for full flexibility.
- **API Aliases**: Added `phonetic()` and `derivations()` as semantic aliases for high-level 
  wrappers.
