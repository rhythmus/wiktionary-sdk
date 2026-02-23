# WiktionaryFetch — Formal Specification (v0.9 draft)

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

## 2. Data Sources

### 2.1 Wiktionary (primary)

- API endpoint: `https://en.wiktionary.org/w/api.php` citeturn1view0  
- Fetch method:
  - `action=query`
  - `prop=revisions|pageprops`
  - `rvprop=content`
  - `rvslots=main`
  - `redirects=1`

**Rationale:** the English Wiktionary is used as the canonical parsing surface even for Greek entries (your “always go with English dictionary” strategy).

### 2.2 Wikidata (optional enrichment)

- API endpoint: `https://www.wikidata.org/w/api.php`
- Fetch method:
  - `action=wbgetentities`
  - `props=labels|descriptions|claims|sitelinks`

Used only if `pageprops.wikibase_item` is present.

### 2.3 Wikimedia Commons (media)

- If Wikidata `P18` exists, derive thumbnail URL using the standard upload path algorithm (MD5 of filename).

## 3. Outputs

### 3.1 Raw output

- `raw.wikitext_full` (optional if requested)
- `raw.wikitext_language_block` (required for this project): language section block, e.g. `==Greek==…`

### 3.2 Normalized output

Top-level:

```yaml
query: γράφω
lang: el
entries: [...]
notes: [...]
```

Each `entry` is:

- `type: LEXEME | INFLECTED_FORM`
- `form: string` (the page title)
- `part_of_speech` (only if explicitly indicated by headword templates or PoS headings)
- `translations` (only if explicitly present)
- `templates` (verbatim template calls grouped by template name)

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

## 4. Parsing Pipeline

### 4.1 Language block extraction

- Locate exact language header `==Greek==` for `lang=el`, etc.
- Return only that block.

### 4.2 Etymology and PoS segmentation

- Split on `===Etymology===` / `===Etymology N===`
- Split on PoS headings (level 3 within language block)

### 4.3 Template extraction

A minimal brace-safe parser extracts top-level `{...}` blocks:

- Returns `TemplateCall`:
  - `name`
  - `params.positional[]`
  - `params.named{}`
  - `raw` (verbatim)

## 5. Decoder Registry Architecture

The system is a registry of pure decoders:

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

## 6. Lemma Resolution (explicit only)

For `INFLECTED_FORM` entries:

- Detect form-of templates (e.g. `{infl of|...}`)
- Extract lemma from template parameters (explicit)
- Fetch lemma page and include lemma LEXEME entry

Disambiguation:

- If lemma has multiple PoS entries, mark those matching `preferred_pos` as `preferred: true`.
- Do **not** guess if absent.

## 7. Translation Parsing (explicit only)

Within a PoS block, detect translation sections:

- `====Translations====`
- Extract only from explicit translation templates:
  - `{t}`, `{t+}`, `{tt}`, `{tt+}`, `{t-simple}`

Output:

```yaml
translations:
  en:
    - gloss: to write
      sense: (optional)
      template: t+
      raw: "{t+|en|to write}"
      params: ...
```

## 8. Wikidata Enrichment (lemma-only)

If enabled and if `pageprops.wikibase_item` exists:

- Fetch entity
- Attach:
  - labels/descriptions (all languages returned)
  - sitelinks
  - `P18` image if present, including a thumbnail URL

## 9. Greek Template Coverage Strategy

“100% coverage” is defined as:

> The library can **extract and store verbatim** and **structurally decode** *all template families used in Greek entries*, without needing any heuristics.

Instead of hardcoding template lists, the system can discover template families by querying category members via API:

- Headword-line templates: Category:Greek headword-line templates citeturn1view1
- Inflection-table templates (adjective/noun/numeral/pronoun/verb): citeturn1view2turn2view0turn3view1turn3view2turn3view3
- Definition/form-of template categories: Category:Greek definition templates citeturn0search9

For adjectives, the category lists the declension template ecosystem (63 templates) citeturn2view0.

## 10. Non-Goals and Safety

- No scraping of rendered HTML is required when Wikitext is available via API.
- No generation of linguistic data not present in sources.
- All results are traceable back to raw template parameters.

## 11. Implementation Reference

The project provides a production-grade modular implementation:

- **Core Engine:** Located in `/src/`. A TypeScript library exported via `index.ts`.
- **Registry:** Decoders are centrally managed in `registry.ts`.
- **Graphical Client:** A React (Vite) application in `/webapp/` serves as the primary visual verification tool, featuring real-time YAML preview and Wikidata media integration.

---

**Artifacts current as of v1.0 Alpha:**
- `src/index.ts`: Orchestration entry point.
- `webapp/src/App.tsx`: React frontend implementation.
- This specification document.


