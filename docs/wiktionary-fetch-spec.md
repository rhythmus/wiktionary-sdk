# WiktionaryFetch — Formal Specification (v1.0)

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

**Roadmap note (non-normative):** this document specifies v1.0 behavior and
data contracts. For planned post‑v1.0 hardening (parser correctness, improved
traceability, packaging reliability, translation-shape refinements), see
`docs/ROADMAP.md`.

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
- **User-Agent**: custom header identifying the tool (`WiktionaryFetch/1.0`).
- **Caching**: multi-tier cache (`src/cache.ts`) prevents redundant requests. L1 in-memory with TTL, L2/L3 pluggable for persistent and shared storage.

## 3. Outputs

### 3.1 Raw output

- `rawLanguageBlock: string` (required): the full language section block, e.g. `==Greek==…`

### 3.2 Normalized output

Top-level (`FetchResult`):

```yaml
rawLanguageBlock: "==Greek==..."
entries: [...]
notes: [...]
```

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
| `translations` | `Record<lang, TranslationItem[]>` | From `{{t}}`, `{{t+}}`, etc. |
| `templates` | `Record<name, StoredTemplate[]>` | All template calls, stored verbatim |
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

### 3.6 Schema versioning

The output shape is formalized in `schema/normalized-entry.schema.json` (JSON Schema draft-07). The schema version (`1.0.0`) follows Semantic Versioning and is documented in `VERSIONING.md`. A `SCHEMA_VERSION` constant is exported from `src/types.ts`.

## 4. Parsing Pipeline

### 4.1 Language block extraction

- Locate exact language header `==Greek==` for `lang=el`, etc.
- Return only that block (up to the next level-2 header or end of page).

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

**Implementation note (non-normative):** parameter splitting is currently
link-aware (pipes inside `[[...]]` are preserved). Fully brace-aware parameter
splitting for nested templates is tracked as post‑v1.0 work in `docs/ROADMAP.md`.

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

## 6. Lemma Resolution (explicit only)

For `INFLECTED_FORM` entries:

- Detect form-of templates (e.g. `{{inflection of|...}}`)
- Extract lemma from template parameters (explicit)
- Fetch lemma page and include lemma LEXEME entry

Disambiguation:

- If lemma has multiple PoS entries, mark those matching `preferred_pos` as `preferred: true`.
- Do **not** guess if absent.

## 7. Translation Parsing (explicit only)

Within a PoS block, detect translation sections:

- `====Translations====`
- Extract only from explicit translation templates:
  - `{{t}}`, `{{t+}}`, `{{tt}}`, `{{tt+}}`, `{{t-simple}}`

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
| CLI | `cli/index.ts` | `wiktionary-fetch <term> --lang=el --format=yaml`, batch support |
| HTTP API | `server.ts` | Lightweight Node.js server, `GET /api/fetch?query=...` |
| Docker | `Dockerfile` | Multi-stage Alpine build for containerized deployment |

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

---

**Artifacts:**
- `src/index.ts`: Orchestration entry point.
- `src/types.ts`: Canonical type definitions (`SCHEMA_VERSION = "1.0.0"`).
- `schema/normalized-entry.schema.json`: Formal output schema.
- `webapp/src/App.tsx`: React frontend with inspector and comparison mode.
- `cli/index.ts`: CLI tool.
- `server.ts`: HTTP API wrapper.
- This specification document.

## 13. Post-v1.0 roadmap (non-normative)

This section is informational only; it does not change v1.0 requirements.
For the detailed staged plan and acceptance criteria, see `docs/ROADMAP.md`.

Priorities:

- **Parser correctness**: fully brace-aware template parameter splitting to
  avoid silent mis-parses with nested templates.
- **Translation shape correctness**: expose explicitly provided translation
  fields (e.g. `term`, `tr=`, `g=`, `alt=`) without inference.
- **Traceability and debugging**: make decoder matches ground-truth (registry
  debug events) and preserve ordered template instances with location metadata.
- **Distribution hardening**: ensure published npm installs ship runnable CLI
  and server entrypoints (not TypeScript-only bins).
