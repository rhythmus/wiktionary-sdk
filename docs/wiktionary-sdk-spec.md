# Wiktionary SDK — Formal Specification (v3.4)

**Scope:** deterministic, source-faithful extraction of lexicographic data from **Wiktionary** (primary), optionally enriched with **Wikidata** and **Wikimedia Commons**.  
**Non-scope:** any linguistic inference, paradigm completion, stem guessing, accent rules, generation of missing forms.

This revision (v3.4) extends v3.3 with **operational hardening** (debug/cache), **testable REST wiring** (`buildApiFetchResponse`), **Vitest + jsdom coverage** for extracted webapp helpers, and pointers to **`audit.md`** (repository critique) and **`docs/ROADMAP.md`** (remaining work — phased engineering + product backlog; delivered history in **`CHANGELOG.md`**). Normative extraction behaviour is unchanged unless noted inline.

## Related: query result combinatorics

For an axis-by-axis matrix of how **page title**, **match mode**, **language**, **etymology**, **PoS**, **lexeme type**, **morph richness** (including the Spanish multi-line case), **lemma resolution**, and **enrichment** combine, see **`docs/query-result-dimensional-matrix.md`**.

## 1. Goals

Given:

- `query_term: string` (required)
- `lang: string` (optional; defaults to `"Auto"`)
- `pos: string` (optional; defaults to `"Auto"`)
- optional disambiguators:
  - `enrich_wikidata?: boolean` (lemma-only)
  - `sort?: "source" | "priority" | { strategy: "source" | "priority", priorities?: Record<string, number> }` (defaults to `"source"`)
    - `"source"`: preserve the order in which language sections and PoS blocks
      appear in the Wiktionary source markup. This is the default, honoring
      the principle of source-faithful extraction.
    - `"priority"`: apply language-priority ordering (default map:
      `el` > `grc` > `en`; caller map can override), then apply
      secondary keys within language (`etymology_index` asc, then PoS heading).
  - `matchMode?: "strict" | "fuzzy"` (defaults to `"strict"`)
    - `"strict"`: single fetch for the query string (existing behaviour).
    - `"fuzzy"`: try normalised query variants — NFC, lowercased, capitalize-first, combining-mark-stripped (and their cross-products) — merge deduplicated lexemes, and append human-readable notes when a variant produced results. Variants are **sorted alphabetically** before iteration so that merge ordering is **deterministic** regardless of input casing (e.g. querying `"god"` and `"God"` produce identical variant sets `["God", "god"]` and therefore identical result ordering). The capitalize-first variant ensures that lowercase queries also discover capitalized Wiktionary pages (e.g. proper nouns), making fuzzy matching **symmetric** with respect to case.

Return:

1) **verbatim** Wikitext extracted from Wiktionary via MediaWiki API  
2) a **normalized JSON/YAML representation** derived *only* from explicit Wikitext/template data  
3) optional Wikidata enrichment for lemma entries (QID, sitelinks, P18 image)  
4) **page-level metadata** (categories, interwiki links, revision ID, last-modified timestamp) extracted from the MediaWiki API

The output conforms to a formal JSON Schema published as `schema/normalized-entry.schema.json` (generated from modular author-time YAML under `schema/src/` via `npm run build:schema`; see `schema/README.md`). The runtime emits `schema_version` from `SCHEMA_VERSION` in `src/model/schema-version.ts` (re-exported via `src/index.ts`; currently `"3.3.0"`). The separate `VERSIONING.md` file describes JSON Schema bump semantics; keep it in sync when `SCHEMA_VERSION` or required fields change.

**Roadmap note (non-normative):** For **outstanding** phased work, see `docs/ROADMAP.md`. For **delivered** roadmap stages (14–22) and the testing baseline, see `CHANGELOG.md` (*Roadmap history — delivered engineering stages*). Narrative “what shipped” remains in §13 below.

### 1.1 Primary API entry point: `wiktionary()`

The **canonical** async function for full extraction is **`wiktionary()`**, exported from `src/index.ts` (re-exported via the package entry `src/index.ts` → built `dist/esm/index.js` / `dist/cjs/index.js`). Older prose may refer to a legacy name (`fetchWiktionary`); in code, use **`wiktionary`**.

**Options (as implemented):**

| Option | Type | Default | Role |
|--------|------|---------|------|
| `query` | `string` | (required) | Page title on **en.wiktionary.org** (after redirects). Normalized to **NFC** before fetch. |
| `lang` | `WikiLang` \| `"Auto"` | `"Auto"` | Language section filter, or scan all mapped `==Language==` sections. |
| `pos` | `string` \| `"Auto"` | `"Auto"` | Restrict to lexeme-class blocks whose strict PoS, `lexicographic_section` slug, or verbatim heading matches (`lexemeMatchesPosQuery()` in `src/lexicographic-headings.ts`). |
| `preferredPos` | `string?` | — | When resolving lemma pages with multiple `LEXEME` rows, prefer rows matching the same query (strict `part_of_speech` or section slug); sets `preferred: true` on matches. |
| `enrich` | `boolean` | `true` | If `true`: Wikidata enrichment for lemma lexemes **and** optional **form-of** `display_morph_lines` via `action=parse` (see §3.5d, `src/form-of-parse-enrich.ts`). If `false`, both paths are skipped. |
| `debugDecoders` | `boolean` | `false` | Populate `FetchResult.debug` with per-lexeme `DecoderDebugEvent[]` from the registry. |
| `sort` | `"source"` \| `"priority"` \| `{ strategy, priorities? }` | `"source"` | Lexeme ordering after merge (see §12.28). |
| `matchMode` | `"strict"` \| `"fuzzy"` | `"strict"` | Strict: single page fetch for `query`. Fuzzy: union of deduplicated lexemes across NFC, lowercased, capitalize-first, and combining-mark-stripped variants (sorted alphabetically for deterministic ordering), with `notes` explaining variants. |

**Internal recursion:** `wiktionaryRecursive()` performs the actual work: page fetch, section walk, decode, optional form-of parse batch, lemma fetches for `INFLECTED_FORM`, Wikidata attachment, then merge of primary + resolved lemma lexemes. A visited set keyed by `` `${lang}:${title}` `` prevents infinite lemma cycles.

**Page title retry:** If the requested title has no page but **stripping Unicode combining marks** yields a different string, the engine attempts one fetch for that variant (without adding a duplicate visit for the original key) and records a note when `debugDecoders` is true.

## 2. Data Sources

### 2.1 Wiktionary (primary)

- API endpoint: `https://en.wiktionary.org/w/api.php`
- Fetch method (as in `fetchWikitextEnWiktionary()` in `src/api.ts`):
  - `action=query`
  - `format=json`, `formatversion=2`, `origin=*` (CORS-friendly for browser consumers)
  - `prop=revisions|pageprops|categories|images|langlinks|info|links|extlinks`
  - `rvprop=content`, `rvslots=main`
  - `cllimit=100`, `imlimit=50`, `lllimit=50`, `pllimit=100` (page links), `ellimit=100` (external links)
  - `redirects=1`

In addition to the Wikitext revision content, every API call now retrieves:

- **`categories`**: structured list of page categories ("Category:" prefix stripped).
- **`langlinks`**: links to parallel Wiktionary editions in other languages.
- **`info`**: page-level metadata — `touched` (last edit timestamp), `length` (wikitext byte count), `pageid`, `lastrevid` (revision ID).
- **`links`**: in-page wikilinks (normalized to `page_links` on each lexeme).
- **`extlinks`**: external URLs (normalized to `external_links` on each lexeme).

**Rationale:** the English Wiktionary is used as the canonical parsing surface even for Greek entries. Structured categories and metadata are extracted from the API directly — this is far more reliable than trying to parse them from wikitext headings or prose.

**Cache keys:** Successful responses are stored under `wikt:${title}` (requested and canonical title after redirects) via `TieredCache` in `src/cache.ts` (L1 memory always; L2/L3 optional adapters).

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

- **Rate limiting**: configurable throttle, default 100ms minimum interval (10 req/s) per Wikimedia guidelines. Managed by `src/rate-limiter.ts` (`RateLimiter.throttle()` before each `mwFetchJson` call).
- **User-Agent**: default string in `src/rate-limiter.ts` (`Wiktionary SDK/1.0` plus repository URL placeholder). Call **`configureRateLimiter({ userAgent, minIntervalMs, proxyUrl })`** before network use to replace the global limiter instance.
- **Caching**: multi-tier cache (`src/cache.ts`) prevents redundant requests. L1 in-memory with TTL, L2/L3 pluggable for persistent and shared storage. **`configureCache({ l2, l3, defaultTtl })`** replaces the global `TieredCache` before fetches run.
- **Unicode Normalization**: All Wikitext, page titles, and query strings are normalized to **NFC (Unicode Composed Form)** via `src/api.ts` and `src/index.ts`. This ensures consistent matching of Greek accented characters (e.g., `έ`) across different operating systems (MacOS NFD vs. Linux/Web NFC).

## 3. Outputs

### 3.1 Raw output

- `rawLanguageBlock: string` (required): the full language section block, e.g. `==Greek==…`

### 3.2 Normalized output

Top-level (`FetchResult`):

```yaml
schema_version: "3.3.0"
rawLanguageBlock: "==Greek==..."
lexemes: [...]
notes: [...]
debug: [...]      # optional; present when debugDecoders=true
metadata:          # page-level data from the API
  categories: [...]
  langlinks: [...]
  info: { last_modified, length, pageid, lastrevid }
```

- `schema_version` (required): Semantic version of the output schema, from
  `SCHEMA_VERSION` in `src/model/schema-version.ts` (re-exported via `src/index.ts`). Current value is `"3.3.0"`.
- `debug` (optional): When `wiktionary({ debugDecoders: true })` is used,
  `debug[i]` is an array of `DecoderDebugEvent` for `lexemes[i]`, listing which
  decoder matched which templates and what fields it produced.
- `metadata` (optional): Page-level data fetched alongside the wikitext
  (categories, langlinks, page info). Separate from per-lexeme `categories` and
  `langlinks` which are filtered by language section.

**Terminology note (v3.0):** The array was renamed from `entries` to `lexemes`
and the interface from `Entry` to `Lexeme` to align with the correct
lexicographic semantics (see §12.25). A _lexeme_ is the data for a single
concept with a specific language, part-of-speech, and etymology. An _entry_
is the page-level aggregate of all lexemes sharing a headword.

Each `Lexeme` contains:

| Field | Type | Source |
|-------|------|--------|
| `id` | string | Generated from lang, title, etymology index, POS heading, entry type |
| `language` | WikiLang | Input parameter |
| `query` | string | Input parameter |
| `type` | `LEXEME \| INFLECTED_FORM \| FORM_OF` | Determined by presence of form-of templates |
| `form` | string | Page title |
| `etymology_index` | integer | Parsed from `===Etymology N===` headings |
| `part_of_speech_heading` | string | Verbatim section heading that opened the lexeme block |
| `lexicographic_section` | string | Stable slug (e.g. `verb`, `suffix`, `han_character`); from `src/lexicographic-headings.ts` |
| `lexicographic_family` | `LexicographicFamily` | Taxonomic bucket: `pos`, `morpheme`, `symbol`, `character`, `phraseology`, `numeral_kind`, `other`, `disallowed_attested` |
| `part_of_speech` | `PartOfSpeech \| null` (optional) | Strict grammatical PoS only, from heading (`mapHeadingToPos`) or headword templates; `null` for morphemes, symbols, phraseology, etc. |
| `pronunciation` | `Pronunciation` | From `{{IPA}}`, `{{el-IPA}}`, `{{audio}}`, `{{rhymes}}`, `{{homophones}}` |
| `hyphenation` | `{syllables?, raw}` | From `{{hyphenation}}` |
| `senses` | `Sense[]` | From `#` / `##` / `#:` lines; includes `qualifier`, `labels`, `topics`, optional structured `only_used_in` |
| `semantic_relations` | `SemanticRelations` | From `{{syn}}`, `{{ant}}`, `{{hyper}}`, `{{hypo}}`, and section headings (Synonyms, Antonyms, Coordinate terms, Holonyms, Meronyms, Troponyms, Comeronyms, Parasynonyms, Collocations, …) matched with the same brace-tolerant heading regex as other section decoders; see [section-inventory.md](section-inventory.md) |
| `etymology` | `EtymologyData` | `chain[]` from `{{inh}}`, `{{der}}`, `{{bor}}`; `cognates[]` from `{{cog}}`; `raw_text` from preamble |
| `usage_notes` | `string[]` | From `===Usage notes===` section text |
| `references` | `string[]` | From `====References====` section text |
| `form_of` | `FormOf` | From form-of templates; includes human-readable `label` field |
| `translations` | `Record<lang, TranslationItem[]>` | From `{{t}}`, `{{t+}}`, etc. |
| `headword_morphology` | `HeadwordMorphology` | Transitivity, aspect, voice, gender, principal parts from headword templates |
| `alternative_forms` | `Array<{term, qualifier?, raw}>` | From `====Alternative forms====` section |
| `see_also` | `string[]` | From `====See also====` section |
| `anagrams` | `string[]` | From `====Anagrams====` section |
| `inflection_table_ref` | `{template_name, raw}` | Name of the conjugation/declension template used |
| `derived_terms` | `SectionWithLinks` | From `{{l}}`/`{{link}}` in `====Derived terms====` |
| `related_terms` | `SectionWithLinks` | From `{{l}}`/`{{link}}` in `====Related terms====` |
| `descendants` | `SectionWithLinks` | From `{{l}}`/`{{link}}` in `====Descendants====` |
| `templates` | `Record<name, StoredTemplate[]>` | All template calls, stored verbatim |
| `templates_all` | `StoredTemplateInstance[]` | Templates in document order with optional `start`, `end`, `line` |
| `lemma_triggered_by_lexeme_id` | string? | Lexeme id that triggered lemma resolution |
| `categories` | `string[]` | API categories filtered by language section |
| `langlinks` | `Array<{lang, title}>` | Interwiki links to other Wiktionary editions |
| `page_links` | `string[]` | Internal wikilinks from `prop=links` (`normalizeWiktionaryQueryPage`) |
| `external_links` | `string[]` | External URLs from `prop=extlinks` |
| `images` | `string[]` | File titles from `prop=images` (Commons/Wiki titles) |
| `metadata` | `{last_modified?, length?, pageid?, lastrevid?}` | Per-lexeme copy of page `info` (same values for all lexemes from one fetch) |
| `wikidata` | `WikidataEnrichment` | Optional QID, labels, descriptions, sitelinks, media; includes **`instance_of`** (P31) and **`subclass_of`** (P279) QID arrays when claims exist |
| `source` | `{wiktionary: WiktionarySource}` | Full traceability metadata |

**Implementation note (lexicographic taxonomy):** Full heading coverage for **lexeme-opening** PoS and morpheme headings lives in `src/parse/lexicographic-headings.ts`. For a **MoS-style checklist** of common *content* sections (synonyms, derived terms, collocations, etc.) and how they map to `Lexeme` fields, see [section-inventory.md](section-inventory.md) (aligned with [wiktionary-scraper’s `english.ts`](https://github.com/LearnRomanian/wiktionary-scraper/blob/main/src/constants/sections/english.ts)). `PartOfSpeech` values (en.wiktionary strict headings plus [ODict-aligned](https://www.odict.org/docs/reference/pos) tags for interchange, including Japanese classes) are listed in `PART_OF_SPEECH_VALUES` in `src/model/part-of-speech.ts` and in `schema/normalized-entry.schema.json` `$defs.PartOfSpeech`; `test/schema-pos-parity.test.ts` asserts parity. `Lexeme.type` (`LEXEME` / `INFLECTED_FORM` / `FORM_OF`) remains **template-driven** from form-of templates, not from section headings.

**Mandatory traceability** (`WiktionarySource`):

```yaml
source:
  wiktionary:
    site: en.wiktionary.org
    title: γράφω
    language_section: Greek
    etymology_index: 1
    pos_heading: Verb
    revision_id: 82341567
    last_modified: "2026-03-15T10:22:00Z"
    pageid: 2731423
```


`revision_id`, `last_modified`, and `pageid` are populated from the API `info`
block, enabling exact reproducibility (e.g. cache-busting by revision ID) and
audit trails.

**Implementation note (lemma resolution metadata):** Resolved lemma lexemes (merged into `FetchResult.lexemes` after an inflected-form fetch) carry `resolved_for_query` (original query) and **`lemma_triggered_by_lexeme_id`** (the `Lexeme.id` of the `INFLECTED_FORM` row that triggered the lemma fetch). `src/model/lexeme.ts`, JSON Schema, and runtime output all use this single field name.

### 3.3 Sense structure

Definition lines are parsed into `Sense` objects:

```yaml
senses:
  - id: S1
    gloss: "to write"
    gloss_raw: "to write (a letter)"
    qualifier: "a letter"          # parenthetical after gloss
    labels: ["colloquial"]         # from {{lb|el|colloquial}}
    topics: ["linguistics"]        # topic domains from {{lb}}
    examples:
      - text: "He writes every day."
        translation: "Γράφει κάθε μέρα."
        transcription: "Gráfei káthe méra."
    subsenses:
      - id: S1.1
        gloss: "to write by hand"
```

- `#` lines produce top-level senses with sequential IDs (`S1`, `S2`, ...).
- `##` lines produce subsenses nested under the preceding sense (`S1.1`, `S1.2`, ...).
- `#:` lines produce examples attached to the preceding sense. **Note:** From v2.1, examples are structured objects with optional `translation` and `transcription` extracted from `{{ux}}`, `{{quote}}`, and `{{eg}}` templates.
- Wiki markup (`[[links]]`, `'''bold'''`, `''italic''`, templates) is stripped from glosses.
- `gloss_raw` (optional): the exact text after `#` / `##` before stripping.
- `qualifier` (optional): parenthetical text extracted from after the main gloss (e.g. "for traffic violations").
- `labels` (optional): register/style labels from `{{lb|...}}` templates (e.g. `["colloquial", "figurative"]`).
- `topics` (optional): topic domains from `{{lb|...}}` (e.g. `["law", "art"]`). Wiktionary uses a shared label-tag system; the decoder separates stylistic labels from topic labels heuristically. **Connector handling:** `{{lb}}` tokens `_`, `also`, `and`, `or`, `;`, `,` are Wiktionary connector words; `_` joins adjacent labels without a comma (e.g. `Trinitarian_Christianity` → one label), while `also`/`and`/`or` merge into the preceding label as natural-language phrasing.
- `only_used_in` (optional): structured decode of `{{only used in|lang|term(s)}}` when that template is the effective definition (restriction to a fixed expression, not a lemma link). Plain `gloss` remains a readable phrase; HTML may render a dedicated line.
- **Template-only glosses**: When stripping wikitext yields an empty gloss, the sense decoder expands common definition-only templates to a plain English gloss (same parameter rules as the `form-of` decoder for form-of family templates, plus `construed with`, etc.) so user-facing output is not raw `{{…}}`.
- Stripping is **brace-aware**: `[[link|display]]` → display, `[[link]]` → link; nested `{{...}}` removed correctly; no regex-induced duplication.

### 3.4 Semantic relations

#### 3.4.1 Flat lexeme-level relations (`semantic_relations`)

```yaml
semantic_relations:
  synonyms:
    - term: σημειώνω
      qualifier: formal
  antonyms:
    - term: σβήνω
  coordinate_terms:
    - term: αναγιγνώσκω
  holonyms:
    - term: γλώσσα
  meronyms:
    - term: γράμμα
  troponyms:
    - term: χαράζω
  comeronyms:
    - term: διαβάζω
  parasynonyms:
    - term: σημειώνω
  collocations:
    - term: "γράφω επιστολή"
```

| Field | Inline template | Section heading | Notes |
|-------|-----------------|-----------------|-------|
| `synonyms` | `{{syn}}` | `====Synonyms====` | |
| `antonyms` | `{{ant}}` | `====Antonyms====` | |
| `hypernyms` | `{{hyper}}` | `====Hypernyms====` | |
| `hyponyms` | `{{hypo}}` | `====Hyponyms====` | |
| `coordinate_terms` | *(not yet)* | `====Coordinate terms====` | Peers at the same level (e.g. days of the week). |
| `holonyms` | *(not yet)* | `====Holonyms====` | Wholes that contain this term as a part. |
| `meronyms` | *(not yet)* | `====Meronyms====` | Parts that make up this term. |
| `troponyms` | *(not yet)* | `====Troponyms====` | Manner-of-action subtypes (e.g. "sprint" for "run"). |
| `comeronyms` | *(not yet)* | `====Comeronyms====` | Same semantic field (complementary / contrastive). |
| `parasynonyms` | *(not yet)* | `====Parasynonyms====` | Near-synonyms with distinct nuance. |
| `collocations` | *(not yet)* | `====Collocations====` | Typical combinations; list lines use the same `{{l}}` / `{{link}}` extraction as other relation sections. |

For `{{syn}}` / `{{ant}}` / `{{hyper}}` / `{{hypo}}`, list items share the same shape: `term` (required), `qualifier?` from `q=` named param, `sense_id?` from `id=` / `sense=` when present. Section-sourced rows use `term` and optional `qualifier` from template gloss parameters or parenthetical text on the bullet line (e.g. `* (formal) {{l|en|…}}`).

Each `SemanticRelation` item may also carry **sense-linking metadata** (additive, all optional):

| Field | Type | Meaning |
|-------|------|---------|
| `source_evidence` | `"template_id" \| "section_scope" \| "qualifier_match" \| "heuristic"` | How this item was linked to a sense. |
| `confidence` | `"high" \| "medium" \| "low"` | Confidence of the sense link. |
| `matched_sense_id` | `string` | Sense ID this item was resolved to. |

#### 3.4.2 Sense-grouped relations (`semantic_relations_by_sense`)

An optional field on each `Lexeme`, keyed by **sense ID** (`"S1"`, `"S2"`, `"S1.1"`, …). Each value is a `SemanticRelations` object containing only the items linked to that sense. Absent when no items could be linked.

```yaml
semantic_relations_by_sense:
  S1:
    synonyms:
      - term: sprint
        source_evidence: template_id
        confidence: high
        matched_sense_id: S1
  S2:
    synonyms:
      - term: execute
        source_evidence: template_id
        confidence: high
        matched_sense_id: S2
```

#### 3.4.3 Evidence tiers

The post-decode sense-relation linker (`src/pipeline/sense-relation-linker.ts`) assigns evidence and confidence in strict priority order:

1. **`template_id` / high:** Template carried an explicit `id=` sense anchor matching a known `Sense.id`.
2. **`section_scope` / medium:** Section bullet line had a parenthetical qualifier that scores >= 5 against a sense's text bag (gloss, labels, topics, qualifier).
3. **`heuristic` / low:** Best-effort token overlap between the relation's qualifier/term and any sense's text bag, scoring >= 2 but < 5.
4. **Unresolved:** Score < 2 against all senses — item remains in flat `semantic_relations` without linking metadata.

Detailed algorithm and scoring rules: see [`docs/sense-level-semantic-relations.md`](sense-level-semantic-relations.md).

### 3.5 Etymology data

```yaml
etymology:
  raw_text: "From Ancient Greek γράφω, from Proto-Greek *grápʰō."
  chain:
    - template: inh
      relation: inherited
      source_lang: grc
      source_lang_name: Ancient Greek
      term: γράφω
      gloss: "to write"
      raw: "{{inh|el|grc|γράφω|t=to write}}"
    - template: inh
      relation: inherited
      source_lang: grk-pro
      source_lang_name: Proto-Greek
      term: "*grápʰō"
      raw: "{{inh|el|grk-pro|*grápʰō}}"
  cognates:
    - template: cog
      relation: cognate
      source_lang: la
      term: scribo
      raw: "{{cog|la|scribo}}"
```

- `chain`: ancestors extracted from `{{inh}}` (inherited), `{{der}}` (derived), `{{bor}}` (borrowed), in template order. Each item has a `relation` field (`"inherited"` | `"borrowed"` | `"derived"`).
- `cognates`: terms from `{{cog}}` templates, separated from the ancestor chain to avoid conflating direct ancestry with lateral kinship. `relation` is always `"cognate"`.
- `raw_text`: the full etymology section prose (preamble text above the template chain), preserved verbatim for human readability and forensic traceability. **Rationale:** the `chain` gives the structured data; `raw_text` preserves editorial context and qualitative commentary.

**Migration note:** the previous `links` field (a flat array mixing ancestors and cognates) is deprecated. `chain + cognates` is the canonical v2 structure. The `etymology()` library function reads both `chain` and legacy `links` for backwards compatibility.

### 3.5b Pronunciation (extended)

```yaml
pronunciation:
  IPA: "/ˈɣrafo/"
  audio: "El-γράφω.ogg"
  audio_url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/El-γράφω.ogg"
  audio_details:
    - filename: "El-γράφω.ogg"
      url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/El-γράφω.ogg"
      label: "Audio (Greek)"
  romanization: "gráfo"
  rhymes: ["-afo"]
  homophones: []
```

- `audio_url`: resolved Wikimedia Commons download URL for the primary audio file.
- `audio_details`: structured list of all audio files found, including their resolved URLs and any labels (e.g. dialect, speaker metadata) extracted from template parameters.
- `romanization`: transliteration of the headword (from `|tr=` parameter on headword templates).
- `rhymes`: from `{{rhymes|...}}` templates in the Pronunciation section.
- `homophones`: from `{{homophones|...}}` templates.

### 3.5c Headword Morphology

```yaml
headword_morphology:
  transitivity: both           # "transitive" | "intransitive" | "both"
  aspect: imperfective         # "perfective" | "imperfective"
  voice: active                # "active" | "passive" | "mediopassive"
  gender: masculine            # for nouns/adjectives
  principal_parts:
    simple_past: έγραψα
    future_active: θα γράψω
    present_passive: γράφομαι
```

Extracted **directly from headword template parameters** — never guessed or inferred:

- For verbs (`{{el-verb}}`): `tr=yes|intr=yes` → transitivity; `|past=`, `|fut=`, `|pres_pass=`, etc. → principal_parts.
- For nouns (`{{el-noun}}`): `|g=m/f/n` → gender.
- **Design choice:** if a parameter is absent from the template, the corresponding field is `undefined` (not guessed). This preserves the "no heuristics" contract.

### 3.5d Form-of labels and Subclasses

For inflected entries or variants, `form_of` provides both a human-readable description and a granular classification:

```yaml
form_of:
  template: inflection of
  lemma: γράφω
  lang: el
  tags: ["1", "s", "perf", "past", "actv", "indc"]
  subclass: "infl"                 # misspelling | abbreviation | plural | clipping | infl
  label: "1st pers. singular perfective past"
```

The `label` is composed from a `TAG_LABEL_MAP` dictionary. The `subclass` is extracted directly from the template name (e.g., `misspelling of` → `misspelling`).

**Lua-expanded inflection glosses (per-lang form-of):** Some definition lines contain only `{{xx-verb form of|lemma}}` (or `xx-noun` / `xx-adj` form of) with **no** `##` subsenses and **no** extra template positionals. The fine-grained lines readers see on Wiktionary are then produced by **Lua** at parse time, not as separate wikitext bullets. When `enrich` is enabled, the engine may call MediaWiki `action=parse` on the sense’s `gloss_raw` with the **page title** as context, extract nested list item text (`ol ol > li`), and store:

```yaml
form_of:
  template: es-verb form of
  lemma: sensar
  lang: es
  tags: []
  label: Verb form
  named: {}
  display_morph_lines:
    - first-person singular present subjunctive
    - third-person singular present subjunctive
    - third-person singular imperative
  display_morph_lines_source: mediawiki_parse
```

`display_morph_lines_source` is always `mediawiki_parse` when present. This is **API expansion of known wikitext**, not scraping of public article HTML. Full rationale, anti-patterns, formatter rules, and code map: **`docs/form-of-display-and-mediawiki-parse.md`**.

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

The output shape is formalized in `schema/normalized-entry.schema.json` (JSON Schema draft-07). The current schema version is **`3.0.0`** (v3.0 renamed `Entry` to `Lexeme`, `entries` to `lexemes`, and fixed PoS segmentation to produce correct lexeme boundaries).

Human-readable schema examples are in `docs/schemata/`:
- `exhaustive_schema_v2.5.0.yaml`: the canonical "Gold Standard" specimen.
- `verb-lemma.yaml`: annotated example for a verb lemma entry.
- `verb-non-lemma.yaml`: annotated example for an inflected verb form.
- `DictionaryEntry — proposed v2 schema.yaml`: comprehensive annotated field inventory (v2.4).

### 3.9 Convenience API & High-Level Wrappers

The SDK provides a high-level functional layer above the raw `FetchResult` to simplify common lexicographical queries. High-level structures like **`RichEntry`** and **`InflectionTable`** provide an aggregate view of a term.

#### 3.9.1 `RichEntry` (The Aggregate Profile)
A `RichEntry` is a comprehensive, flattened representation of a linguistic term, combining lemma-level metadata with its full inflectional and semantic profile. It is the primary return type for `richEntry()`.

#### 3.9.2 `InflectionTable` (The Structured Paradigm)
An `InflectionTable` is a hierarchical representation of a grammatical paradigm (e.g., all forms of a verb across mood, tense, and voice). It is returned by `conjugate()` and `decline()` when called in "full-table" mode (empty criteria).

From v3.1, all lexeme-scoped wrappers return `GroupedLexemeResults<T>` — a
grouped result envelope with:
- `order: string[]`
- `lexemes: Record<lexeme_id, { language, pos, etymology_index, value, support_warning? }>`

Optional **`support_warning`** (on each **`LexemeResult<T>`**) explains when an
empty or partial **`value`** is likely due to **SDK extraction coverage** (undecoded
template families, unsupported parameters, parse failures on expanded tables)
rather than a guarantee that Wiktionary lacks the data. It is produced via
**`mapLexemes`** and **`withExtractionSupport`** in **`src/convenience/extraction-support.ts`**.
The generic **`format()`** path for grouped arrays (branch **3b**) appends a
human-readable **Support:** line alongside the formatted **`value`**. **`stem()`**
additionally keeps **`WordStems.support_warning`** on the pure extractor
**`extractStemsFromLexeme()`** for direct formatting of a **`WordStems`** object;
the async **`stem()`** wrapper **lifts** that string onto the row so JSON does not
duplicate it inside **`value`**.

Use `asLexemeRows()` when row-oriented iteration (`map/find/filter`) is
preferred. Scalar exceptions are marked below.

| Wrapper | Return type | Notes |
|---------|-------------|-------|
| `lemma(q, l)` | `string` | **Scalar.** Resolves inflections to canonical lemma. |
| `pageMetadata(q, l)` | `object` | **Scalar.** Raw page info (`last_modified`, `length`, `pageid`). |
| `getMainLexeme(result)` | `Lexeme\|null` | **Scalar.** First-match heuristic utility. |
| `ipa(q, l)` | `GroupedLexemeResults<string\|null>` | Primary IPA transcription per lexeme. |
| `pronounce(q, l)` | `GroupedLexemeResults<string\|null>` | Audio URL per lexeme. |
| `hyphenate(q, l, opts)` | `GroupedLexemeResults<any>` | Syllable list or joined string per lexeme. |
| `syllableCount(q, l)` | `GroupedLexemeResults<number>` | Number of syllables per lexeme. |
| `synonyms(q, l)` | `GroupedLexemeResults<string[]>` | Synonyms per lexeme (flat). |
| `antonyms(q, l)` | `GroupedLexemeResults<string[]>` | Antonyms per lexeme (flat). |
| `hypernyms(q, l)` | `GroupedLexemeResults<string[]>` | Hypernyms per lexeme (flat). |
| `hyponyms(q, l)` | `GroupedLexemeResults<string[]>` | Hyponyms per lexeme (flat). |
| `synonymsBySense(q, l)` | `GroupedLexemeResults<Record<string, SemanticRelation[]>>` | Synonyms grouped by sense ID. |
| `antonymsBySense(q, l)` | `GroupedLexemeResults<Record<string, SemanticRelation[]>>` | Antonyms grouped by sense ID. |
| `relationsBySense(family, q, l)` | `GroupedLexemeResults<Record<string, SemanticRelation[]>>` | Any relation family grouped by sense ID. |
| `translate(q, l, t)` | `GroupedLexemeResults<string[]>` | Translations per lexeme. |
| `etymology(q, l)` | `GroupedLexemeResults<EtymologyStep[]\|null>` | Structured lineage per lexeme. |
| `partOfSpeech(q, l)` | `GroupedLexemeResults<PartOfSpeech\|null>` | Strict grammatical PoS per lexeme; null when the section is non-PoS. |
| `lexicographicClass(q, l)` | `GroupedLexemeResults<LexicographicClass>` | `lexicographic_section`, `lexicographic_family`, and strict `part_of_speech` per lexeme. |
| `conjugate(q, l, c)` | `GroupedLexemeResults<string[]\|Record\|null>` | Paradigm per lexeme. |
| `decline(q, l, c)` | `GroupedLexemeResults<string[]\|Record\|null>` | Declension per lexeme. |
| `morphology(q, l)` | `GroupedLexemeResults<GrammarTraits>` | Grammar traits per lexeme. |
| `richEntry(q, l)` | `GroupedLexemeResults<RichEntry\|null>` | Aggregate profile per lexeme. |
| `stem(q, l)` | `GroupedLexemeResults<WordStems>` | Structured stems per lexeme (`aliases` plus optional `verb`/`nominals` / Ancient Greek slots); row **`support_warning`** when aliases are empty for coverage reasons (also on **`WordStems`** from **`extractStemsFromLexeme`**). |
| `stemByLexeme(q, l)` | `GroupedLexemeResults<WordStems>` | Alias of `stem()`. |
| `principalParts(q, l)` | `GroupedLexemeResults<Record\|null>` | Verb paradigm slots per lexeme. |
| `gender(q, l)` | `GroupedLexemeResults<string\|null>` | Grammatical gender per lexeme. |
| `transitivity(q, l)` | `GroupedLexemeResults<string\|null>` | Verb transitivity per lexeme. |
| `alternativeForms(q, l)` | `GroupedLexemeResults<Array<{term, qualifier?}>>` | Alternative forms per lexeme. |
| `seeAlso(q, l)` | `GroupedLexemeResults<string[]>` | See-also terms per lexeme. |
| `anagrams(q, l)` | `GroupedLexemeResults<string[]>` | Anagrams per lexeme. |
| `usageNotes(q, l)` | `GroupedLexemeResults<string[]>` | Usage notes per lexeme. |
| `derivedTerms(q, l)` | `GroupedLexemeResults<any[]>` | Derived terms per lexeme. |
| `relatedTerms(q, l)` | `GroupedLexemeResults<any[]>` | Related terms per lexeme. |
| `descendants(q, l)` | `GroupedLexemeResults<any[]>` | Descendants per lexeme. |
| `referencesSection(q, l)` | `GroupedLexemeResults<string[]>` | References per lexeme. |
| `etymologyChain(q, l)` | `GroupedLexemeResults<any[]>` | Ancestor chain per lexeme. |
| `etymologyCognates(q, l)` | `GroupedLexemeResults<any[]>` | Cognates per lexeme. |
| `etymologyText(q, l)` | `GroupedLexemeResults<string\|null>` | Raw etymology text per lexeme. |
| `categories(q, l)` | `GroupedLexemeResults<string[]>` | Categories per lexeme. |
| `langlinks(q, l)` | `LexemeResult<any[]>[]` | Interwiki links per lexeme (`interwiki` is alias). |
| `isCategory(q, cat, l)` | `LexemeResult<boolean>[]` | Category membership per lexeme. |
| `inflectionTableRef(q, l)` | `LexemeResult<{template_name, raw}\|null>[]` | Inflection template per lexeme. |
| `audioGallery(q, l)` | `LexemeResult<AudioDetail[]>[]` | Audio files per lexeme. |
| `exampleDetails(q, l)` | `LexemeResult<any[]>[]` | Usage examples per lexeme. |
| `citations(q, l)` | `LexemeResult<any[]>[]` | Literary citations per lexeme. |
| `isInstance(q, qid, l)` | `LexemeResult<boolean>[]` | Wikidata P31 membership per lexeme. |
| `isSubclass(q, qid, l)` | `LexemeResult<boolean>[]` | Wikidata P279 membership per lexeme. |
| `wikipediaLink(q, l)` | `LexemeResult<string\|null>[]` | Wikipedia link per lexeme. |
| `internalLinks(q, l)` | `LexemeResult<string[]>[]` | Internal wikilinks per lexeme. |
| `externalLinks(q, l)` | `LexemeResult<string[]>[]` | External links per lexeme. |
| `wikidataQid(q, l)` | `LexemeResult<string\|null>[]` | Wikidata QID per lexeme. |
| `image(q, l)` | `LexemeResult<string\|null>[]` | Primary image URL per lexeme. |
| `allImages(q, l)` | `LexemeResult<string[]>[]` | All images per lexeme. |
| `rhymes(q, l)` | `LexemeResult<string[]>[]` | Rhyming words per lexeme. |
| `homophones(q, l)` | `LexemeResult<string[]>[]` | Homophones per lexeme. |

#### 3.9.3 `translate()` modes (`src/convenience/lemma-translate.ts`)

- **`mode: "gloss"` (default):** After **`lemma()`** resolution, reads **`lexeme.translations[targetLang]`** from the **English** Wiktionary entry (translation table templates only; no extra inference).
- **`mode: "senses"` + `targetLang === "en"`:** Reuses the same lemma fetch on en.wiktionary and maps **`Sense.gloss`** strings per lexeme.
- **`mode: "senses"` + other `targetLang`:** Calls **`mwFetchJson`** on `https://${targetLang}.wiktionary.org/w/api.php` for the lemma title, then scans wikitext for **language-specific `== … ==` headers** (`getNativeSenses()`). This path is inherently heuristic (header list per language) and is best-effort; failures log to `console.error` and yield empty arrays.

### 3.11 Morphological Extraction Methodology (The "Source-Faithful" Pivot)

To fulfill the primary goal of providing accurate conjugation and declension paradigms, the SDK implements a two-tier strategy:

#### 3.11.1 Level 1: Template-Driven Decoding (Preferred)
From v2.5, the SDK prioritizes extracting logical **Stems** and **Principal Parts** directly from Wikitext template parameters (e.g., `{{el-conjug-1st}}`, `{{el-nN-ο-α-2a}}`). 
- **Rationale**: This is faster, more robust, and works in environments with restricted MediaWiki API access. It preserves the "No Scraping" mandate by treating template parameters as the source of truth.

#### 3.11.2 Level 2: The "Scribunto" Exception (Fallback)
If stems cannot be extracted, the SDK falls back to the legacy execution-based strategy:
1. **Template Capture**: The SDK isolates the declarative morphology template.
2. **Expansion**: The raw template is sent to the MediaWiki `action=parse` API endpoint.
3. **DOM Dissection**: The SDK receives the rendered HTML and structurally traverses the generated `.inflection-table`.
4. **Coordinate Mapping**: Grammatical keys (e.g., `person: "3", number: "singular"`) are mapped to the intersecting table cells to retrieve the literal form.

**Rationale**: This ensures absolute parity with the human-facing website without the SDK needing to maintain its own linguistic rule engine. This constitutes the project's single documented exception to the _"No HTML Scraping"_ rule when consuming **arbitrary article HTML**. A **second, narrower** `action=parse` use exists for **form-of morph lines** (`src/form-of-parse-enrich.ts`): the SDK submits the **definition-line wikitext** with the **known page title** as context and parses only the returned fragment (nested `<ol>` items). That is the same class of API call as morphology expansion, not `/wiki/…` HTML scraping.

### 3.10 Morphology Engine and Smart Defaults

The `conjugate()` and `decline()` functions implement a **Smart Override** strategy:
1.  **Inference**: `morphology(query)` is called to determine the inherent grammar of the input word (e.g., "έγραψες" → 2nd person singular past).
2.  **Merging**: User-provided criteria (e.g., `{ number: "plural" }`) are merged over the inherent grammar.
3.  **Execution**: The engine resolves the final coordinate (e.g., 2nd person *plural* past) via DOM parsing.

**Rationale**: This allows for shorthand usage like `conjugate("έγραψες", { number: "plural" })` resulting in "γράψατε", which matches human intuition for language manipulation.

## 4. Parsing Pipeline

### 4.1 Language block extraction

- Locate exact language header `==Greek==` for `lang=el`, etc.
- **Auto-discovery (`lang="Auto"`)**: When no language is specified, the engine scans the entire page for level-2 headings (`==...==`) and extracts all sections matching the internal language map.
- **Lexeme Ordering**: By default (`sort: "source"`), discovered lexemes
  preserve the order in which language sections appear in the Wiktionary
  source markup. When `sort: "priority"` is requested, lexemes are sorted
  by a default language rank map (`el`, `grc`, `en`) that callers can
  override via `sort: { strategy: "priority", priorities }`. Secondary keys
  are deterministic within each language tier: `etymology_index` ascending,
  then `part_of_speech_heading` alphabetical.
- **Unknown language codes:** If `lang` is specified but not found in the mapping (`langToLanguageName()` returns `null`), `wiktionary()` returns early with an empty `lexemes` array and an explanatory `notes` entry.

### 4.2 Etymology and PoS segmentation — the Wikitext hierarchy problem

#### 4.2.1 The problem: flat headings, implicit hierarchy

Wikitext uses `=` delimiters for heading levels (`==` for H2, `===` for H3,
`====` for H4, etc.), but Wiktionary's conventions use these levels
inconsistently across the semantic hierarchy of a dictionary entry. Consider
the actual heading structure for the Greek word **γράφω**:

```
==Ancient Greek==           ← H2: language section
===Etymology===             ← H3: metadata
===Pronunciation===         ← H3: metadata
===Verb===                  ← H3: actual part-of-speech (lexeme)
====Conjugation====         ← H4: subsection of Verb
====Derived terms====       ← H4: subsection of Verb
====Descendants====         ← H4: subsection of Verb
===References===            ← H3: metadata
===Further reading===       ← H3: metadata
==Greek==                   ← H2: new language section
===Etymology===             ← H3: metadata
===Pronunciation===         ← H3: metadata
===Verb===                  ← H3: actual part-of-speech (lexeme)
====Conjugation====         ← H4: subsection of Verb
====Antonyms====            ← H4: subsection of Verb
====Related terms====       ← H4: subsection of Verb
===References===            ← H3: metadata
==Italiot Greek==           ← H2: new language section
===Etymology===             ← H3: metadata
===Pronunciation===         ← H3: metadata
===Verb===                  ← H3: actual part-of-speech (lexeme)
```

The critical structural ambiguity is that **all H3 headings are at the same
level**, yet they serve fundamentally different roles:

- **`===Verb===`** introduces a _part-of-speech block_ that defines a
  lexeme — a concept with definitions, templates, and semantic relations.
- **`===Etymology===`**, **`===Pronunciation===`**, **`===References===`**
  are _metadata sections_ that provide auxiliary data _about_ a lexeme but
  do not constitute independent lexemes themselves.
- **`====Conjugation====`**, **`====Antonyms====`**, etc. are _subsections_
  nested within a PoS block that extend the data of their parent lexeme.

Wikitext has no way to express that "Pronunciation" is _metadata belonging to
the Verb lexeme that follows it_, or that "Conjugation" is _a subsection of
the Verb above_. The hierarchy is purely implicit, relying on editorial
convention and reading order.

#### 4.2.2 The category error: headings are not entries

A naïve parser that treats every H3–H5 heading as a separate lexeme/entry
produces catastrophic conflation. For γράφω, a flat-heading parser produces
**15 "entries"** — one for "Pronunciation", one for "Antonyms", one for
"Conjugation", etc. — each promoted to the same level as an actual "Verb"
entry. This is a **category error**: metadata sections (Etymology,
Pronunciation, References, Further Reading) and relational subsections
(Antonyms, Derived Terms, Conjugation) are misidentified as independent
lexemes, resulting in:

1. **Semantic pollution**: UI elements (pills, tabs, exports) display
   "Entry: Antonyms" or "Entry: Pronunciation" as if they were distinct
   vocabulary entries.
2. **Data loss by dilution**: The actual lexeme's antonyms, pronunciation,
   and conjugation data get scattered across isolated pseudo-entries instead
   of being collected on the real lexeme object.
3. **Ambiguous identity**: Consumers of the API cannot distinguish between
   a result that represents a real lexeme and one that is an artifact of
   misparse.

#### 4.2.3 Correct interpretation: PoS headings define lexeme boundaries

The SDK's parsing rule, implemented in `splitEtymologiesAndPOS()` in
`src/parser.ts`, is:

> **Only headings that `isLexemeSectionHeading()` recognizes (see
> `src/lexicographic-headings.ts`) create lexeme boundaries.** That set
> includes core PoS, morphemes, symbols, CJK character sections, phraseology,
> and commonly attested “disallowed” headings. Other headings (Etymology,
> Pronunciation, Conjugation, References, Antonyms, etc.) stay content
> _within_ the nearest lexeme block.

**Algorithm:**

1. Walk the lines of the language block sequentially.
2. When an H3–H5 heading is encountered:
   - If `isLexemeSectionHeading(heading)` → start a new `posBlock` (lexeme boundary).
   - Otherwise → include the heading and its content as part of the current
     `posBlock`, preserving the heading marker so downstream decoders can
     still locate subsections by name.
3. Content that appears _before_ the first PoS heading (e.g., Etymology
   and Pronunciation at the top of the language block) is buffered and
   prepended to the first PoS block.

This means for the γράφω example above, the parser correctly produces
**3 lexemes** (one per language × PoS combination), not 15:

| Lexeme | Language | PoS | Embedded subsections |
|--------|----------|-----|----------------------|
| 1 | Ancient Greek (`grc`) | Verb | Etymology, Pronunciation, Conjugation, Derived terms, Descendants, References, Further reading |
| 2 | Greek (`el`) | Verb | Etymology, Pronunciation, Conjugation, Antonyms, Related terms, References |
| 3 | Italiot Greek | Verb | Etymology, Pronunciation |

#### 4.2.4 Multi-PoS entries within a single language

Some words have multiple parts-of-speech within a single language section.
For example, English "bank" has:

```
==English==
===Etymology 1===
====Noun====
# A financial institution.
====Verb====
# To deposit money.
===Etymology 2===
====Noun====
# The edge of a river.
```

Here the parser correctly produces **3 lexemes** (Noun/E1, Verb/E1, Noun/E2),
not one. The `etymology_index` field disambiguates between the two Noun
lexemes sharing the same language + PoS but arising from different
etymologies.

**General rule:** Lexeme identity within a page is the tuple
`(language, lexicographic_section, etymology_index)` together with the
verbatim `part_of_speech_heading` when multiple blocks share the same section slug.
Display grouping may use strict `part_of_speech` when present, else `lexicographic_section`.

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

Named sections (`===Usage notes===`, `====Translations====`) are identified by heading regex and their content is extracted up to the next same-level or higher heading. Headings allow flexible numbers of `=` and surrounding whitespace, consistent across decoders (semantic relations, usage notes, alternative forms, etc.).

## 5. Decoder Registry Architecture

The system is a registry of decoders (`src/registry.ts`) coordinated by `DecoderRegistry`:

```ts
interface TemplateDecoder {
  id: string;
  /** Optional: explicit template names for introspection / coverage tools */
  handlesTemplates?: string[];
  matches(ctx: DecodeContext): boolean;
  /** Returns a patch object `{ entry?: Partial<Lexeme>, … }`; merged with other decoders */
  decode(ctx: DecodeContext): unknown;
}

// decodeAll(ctx, { debug?: boolean }) =>
//   - normally: merged patch (deep-merged into the lexeme shell)
//   - debug: { patch, debug: DecoderDebugEvent[] }
```

**Rules:**

- Decoders may only read explicit template parameters or explicit Wikitext lines/sections.
- Decoders must not infer stems/endings/classes if not present.
- All template calls are stored verbatim under `lexeme.templates` by the `store-raw-templates` decoder (runs for every context).

**Current decoder families (v2):**

1. **Raw storage** (`store-raw-templates`): runs on every context; stores all templates verbatim.
2. **Pronunciation** (extended): `ipa`, `el-ipa`, `audio` (now also resolves `audio_url`), `hyphenation`, `rhymes`, `homophones`, `romanization`.
3. **Headword / POS**: `el-verb-head`, `el-noun-head`, `el-adj-head`, `el-adv-head`, `el-pron-head`, `el-numeral-head`, `el-participle-head`, `el-art-head`, **`nl-noun-head`**, **`nl-verb-head`**, **`nl-adj-head`**, **`de-noun-head`**, **`de-verb-head`**, **`de-adj-head`**.
4. **Headword morphology** (new): `el-verb-morphology` (extracts `transitivity`, `principal_parts` from `{{el-verb}}` params); `el-noun-gender` (extracts `gender` from `{{el-noun}}`); **`nl-noun-head`** (extracts `gender` from `{{nl-noun}}`); **`de-noun-head`** (extracts `gender` from `{{de-noun}}`).
5. **Form-of** (extended): the `form-of` decoder matches **`isFormOfTemplateName()`** — the historical `FORM_OF_TEMPLATES` / `VARIANT_TEMPLATES` sets, per-lang `{{xx-verb form of|…}}`, **and** the large en.wiktionary [Category:Form-of templates](https://en.wiktionary.org/wiki/Category:Form-of_templates) family (names ending in ` … of`, plus `rfform`, `IUPAC-*`, etc.). Common Wiktionary **short aliases** (`altcase`, `alt case`, `altsp`, `altform`) are included in `VARIANT_TEMPLATES` so they produce `FORM_OF` lexeme type and readable display labels (e.g. "Alternative case form"). Produces `form_of.label` from `TAG_LABEL_MAP` / template name. **`isVariantFormOfTemplateName()`** distinguishes `FORM_OF` (spelling/lexical variant) from `INFLECTED_FORM` (grammatical inflection). `only used in` is **not** treated as lemma `form_of`; it is handled on sense lines.
6. **Translations**: parses `====Translations====` sections for `t`, `t+`, `tt`, `tt+`, `t-simple`.
7. **Senses**: parses `#` / `##` / `#:` lines; now extracts `qualifier` from parenthetical text and `labels`/`topics` from `{{lb|...}}` templates on definition lines.
8. **Semantic relations**: inline `syn`, `ant`, `hyper`, `hypo`; section lists for Synonyms, Antonyms, Hypernyms, Hyponyms, Coordinate terms, Holonyms, Meronyms, Troponyms, Comeronyms, Parasynonyms, and Collocations (brace-tolerant `====…====` headings; `{{l}}` / `{{link}}` on list lines). Inline `{{cot}}`, `{{hol}}`, `{{mer}}`, `{{tro}}` are **not** decoded into structured fields yet.
9. **Etymology v2**: produces `chain[]` (from `inh`, `der`, `bor`) and `cognates[]` (from `cog`) as separate arrays; now supports compositional templates like **`affix`**, **`compound`**, **`back-formation`**, and **`clipping`**.
10. **Usage notes**: extracts `===Usage notes===` section text.
11. **References** (new): extracts `====References====` section text into `entry.references[]`.
12. **Alternative forms** (new): parses `====Alternative forms====` section for `{{l}}`/`{{link}}` templates into `entry.alternative_forms[]`.
13. **See also** (new): parses `====See also====` section into `entry.see_also[]`.
14. **Anagrams** (new): parses `====Anagrams====` section for `{{l}}` templates into `entry.anagrams[]`.
15. **Inflection table reference** (new): captures the raw inflection template call (e.g. `{{el-conj-γράφω}}`) into `entry.inflection_table_ref`.
16. **Section links**: parses `====Derived terms====`, `====Related terms====`, `====Descendants====` for `{{l}}` and `{{link}}` templates; stores both `raw_text` and structured `items`.

Each decoder may declare `handlesTemplates: string[]` for introspection; `registry.getHandledTemplates()` returns the union for coverage reporting.

**Merge semantics:** `mergePatches()` deep-merges all decoder outputs in registration order. Conflicts are last-writer-wins at the key level; template storage is aggregated by name. **Registration order matters** — `AGENTS.md` requires no duplicate `id` values and warns that reordering patches can change behaviour.

## 6. Lemma Resolution (explicit only)

For `INFLECTED_FORM` lexemes:

- Detect form-of templates via `isFormOfTemplateName()` (e.g. `{{inflection of|...}}`, `{{comparative of|...}}`, `{{es-verb form of|...}}`)
- Extract lemma from template parameters (explicit)
- **Prioritization**: When resolving a lemma, the engine prioritizes lexemes explicitly marked as `INFLECTED_FORM` over metadata-only blocks (like Pronunciation sections) to ensure the correct lexeme is chosen for the query.
- Fetch lemma page and include lemma LEXEME lexeme

Disambiguation:

- If lemma has multiple PoS lexemes, mark those matching `preferred_pos` as `preferred: true`.
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

Wikidata attachment runs only when `enrich !== false` in `wiktionary()`. It applies to lexemes with `type === "LEXEME"` on the **queried** page (see loop in `src/index.ts`).

**QID resolution order (per page, first successful wins and is reused across lexemes on that page):**

1. `pageprops.wikibase_item` from the Wiktionary page (when present).
2. Else **`fetchWikidataEntityByWiktionaryTitle(enwiktionary, title)`** — `wbgetentities` with `sites=enwiktionary&titles=…`.
3. Else **`fetchWikidataEntityByWikipediaTitle(enwiki, title)`** — same API with `sites=enwiki` (helps when the lemma aligns with a Wikipedia article but pageprops are missing).

**Translingual exclusion:** When the QID was resolved via the Wikipedia-title fallback (step 3), **Translingual** lexemes are **skipped** and receive no `wikidata` block. Wikipedia articles describe language-specific concepts (e.g. Q190 = "god" the deity), which are semantically wrong for Translingual entries (ISO 639 codes, taxonomic symbols, etc.). QIDs from steps 1–2 are applied to all lexemes including Translingual.

**ISO 639 Translingual enrichment:** Translingual Symbol entries whose definition is `{{ISO 639|N}}` receive dedicated enrichment (via `src/pipeline/iso639-enrich.ts`): the template is expanded via `action=parse` to resolve the language name (e.g. "Godié"), and the correct Wikidata QID is looked up via the language's Wikipedia article (e.g. "Godié language" → Q3914412).

**Entity fetch:** `fetchWikidataEntity(qid)` loads `labels`, `descriptions`, `claims`, `sitelinks`. The SDK:

- Builds `sitelinks[].url` when the API omits it, using `https://${lang}.wikipedia.org/wiki/…` for `*wiki` sites.
- Maps **`P18`** to `wikidata.media` with Commons filename, `commons_file`, and **`commonsThumbUrl()`** thumbnail (default width 420) from `src/infra/utils.ts`.
- Maps **`P31`** → `wikidata.instance_of` and **`P279`** → `wikidata.subclass_of` as arrays of QID strings.

Failures are recorded on the lexeme as **`wikidata_error`** (string message) in the catch path — this field is runtime-only and not part of the formal JSON Schema; consumers should treat it as diagnostic.

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

### 11.1 REST server surface (`server.ts`) vs full SDK options

The minimal HTTP wrapper exposes **`GET /api/fetch`** with query parameters
`query`, `lang` (defaults to `el`, unlike the library default `Auto`),
`enrich` (default true; set `enrich=false` to disable), optional `format=yaml|json`,
`matchMode` (`strict` \| `fuzzy`), `sort` (`source` \| `priority`),
optional `langPriorities` (`el=1,grc=2,...`) for custom priority ordering,
`debugDecoders` (`true` \| `1` \| `yes`),
optional `lemmaFetchConcurrency` / `formOfParseConcurrency` (positive integers),
**`filterPos`** for the same PoS filtering as `wiktionary({ pos })` (default `Auto`),
and **`preferredPos`** for lemma disambiguation. For backwards compatibility,
a bare **`pos=`** query argument still maps to **`preferredPos`** only (legacy
behaviour); use **`filterPos=`** when you need strict PoS filtering.

**Implementation note:** Response assembly lives in **`src/ingress/server-fetch.ts`** as **`buildApiFetchResponse(url, deps?)`**, which returns `{ status, headers, body }` so unit tests can inject **`deps.wiktionaryFn`** without listening on a port. **`server.ts`** delegates to that helper. YAML responses use **`Content-Type: text/yaml; charset=utf-8`** so clients treat the payload as UTF-8 explicitly.

**Health:** `GET /api/health` returns a small JSON status object.

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
When `debugDecoders: true` is passed to `wiktionary()`, each primary lexeme receives a `DecoderDebugEvent[]` listing decoder id, matched templates, and fields produced. **Caveat:** lemma-resolved lexemes appended to the result currently receive empty debug arrays in the merged output (see `wiktionaryRecursive` debug concatenation). **Rationale:** coverage reporting and introspection tools use declared `handlesTemplates` and actual decode outcomes. The webapp uses this for the Decoder column in debug mode.

### 12.7 Template Ordering and Location Metadata
`templates_all` stores templates in document order with optional `start`, `end`, `line`. **Rationale:** preserves source order for forensic verification; enables accurate click-to-source mapping when raw wikitext and decoded output are displayed side-by-side.

### 12.8 Section Links: Explicit-Only Extraction
Derived/Related/Descendants sections are stored with both `raw_text` (verbatim) and `items` (from `{{l}}`/`{{link}}` only). **Design choice:** we do not parse plain wikilinks or free text into structured items; only explicitly templated links are extracted. This keeps the output source-faithful and avoids heuristics.

### 12.9 Brace-Aware Gloss Stripping
`stripWikiMarkup()` uses depth-based scanning rather than regex for `[[links]]` and `{{templates}}`. **Rationale:** regex-based replacement can mis-handle nested structures (e.g. `[[link]]` producing duplicated text, or `{{t|g={{g|m}}}}` leaving stray braces). The brace-aware implementation: (1) finds matching `]]`/`}}` by depth counting; (2) extracts `[[link|display]]` → display, `[[link]]` → link; (3) recursively strips markup inside link display text; (4) removes templates entirely. **Design choice:** process `'''` before `''` to avoid partial italic matches.

### 12.10 Formatter Architecture (High-Fidelity Rendering)
`src/formatter.ts` provides a polymorphic `format(data, options)` function that dispatches to a registered `FormatterStyle`. From v2.2, the system utilizes **Handlebars-based templates** (`src/templates/*.hbs`) for complex output formats (HTML, Markdown).

**Design choice:** `styleRegistry` is a plain object; `registerStyle()` allows consumers to add custom styles (e.g. LaTeX, CSV) without modifying the core library. The dispatcher runs before style dispatch, keeping each style method purely presentational.

#### 12.10.1 Handlebars Integration
The move to Handlebars allows for:
- **Logical Branching**: Handling optional fields (Principal Parts, Wikidata) without complex string concatenation.
- **Reusable Partials**: Shared logic for etymology chains and sense nesting.
- **Separation of Concerns**: CSS (`entry.css`) and structure (`entry.html.hbs`) are decoupled from the TypeScript logic.

#### 12.10.2 Typographic Neutrality (Fragment Architecture)
HTML and Markdown outputs are designed as **fragments/snippets**, not standalone documents.
- **Scoped Styles**: CSS targets the `.wiktionary-entry` class to prevent global pollution.
- **Default face in bundled CSS**: The shipped `ENTRY_CSS` may set a readable serif stack (e.g. Alegreya) so the fragment looks intentional out of the box. Host applications can override `.wiktionary-entry` (or wrap the fragment) to inherit their own typeface.
- **Inline flow**: The HTML fragment is structured as a single block with inline / inline-block children so sections (head, etymology, senses, relations) participate in one wrapping text flow unless the container width forces natural line breaks.
- **Single-Column Flow**: Avoids forced multi-column layouts so the snippet adapts to its container width.

#### 12.10.3 Bundled `templates.ts` (environment-agnostic runtime)
The runtime imports **compiled template strings** from `src/templates/templates.ts` (`HTML_ENTRY_TEMPLATE`, `MD_ENTRY_TEMPLATE`, `ENTRY_CSS`). This keeps Node, CLI, and browser bundles free of `fs`/`path` at render time (see architectural constraint in `AGENTS.md`). The human-editable sources live beside it as `entry.html.hbs`, `entry.md.hbs`, and `entry.css`; they must be **re-bundled** into `templates.ts` when those files change (see §12.10.4).

#### 12.10.4 Webapp: live sync from template sources
The Vite dev server (`webapp/`) registers a small plugin that watches `src/templates/entry.html.hbs`, `lexeme-homonym-group.html.hbs`, `entry.md.hbs`, and `entry.css`, regenerates `src/templates/templates.ts` on save, and triggers a reload. **Rationale:** authors edit the real `.hbs` / `.css` files while the demo hot-updates, without manually copying strings into `templates.ts`. Production builds of the SDK should still commit an up-to-date `templates.ts` so consumers who do not run Vite receive the same output.

#### 12.10.5 Etymology language labels in Handlebars (`langLabel`)
Decoders populate `EtymologyLink.source_lang` (language code or Wiktionary lang slot) for every chain/cognate row. The optional `source_lang_name` field is not always present. Handlebars templates therefore use a **`langLabel`** helper (registered in `src/formatter.ts`) that prints `source_lang_name` when set, otherwise **`source_lang`**, matching the fallback behaviour already used in plain-text formatters. **Rationale:** avoids empty language tags in HTML/Markdown when only the code is extracted from template parameters.

#### 12.10.6 `FetchResult` rendering and homonym merge (presentation layer)

`format(data, { mode: "html" | "html-fragment" | … })` detects a **`FetchResult`** (object with `schema_version` and `lexemes: Lexeme[]`) and delegates to **`formatFetchResult()`** in `src/formatter.ts`.

- **Query notes:** `FetchResult.notes` are emitted as a `wiktionary-fetch-notes` block (redirect, fuzzy variant, errors). **Rationale:** surfaces META-axis cases from `docs/query-result-dimensional-matrix.md` without requiring consumers to wrap JSON manually.
- **Empty results:** `lexemes.length === 0` yields a visible empty-state fragment. **Rationale:** L-15 / META-A2 in template coverage mocks.
- **Homonym merge:** `groupLexemesForIntegratedHomonyms()` groups **consecutive** lexemes that share `language`, `form`, and normalized class key (`part_of_speech`, else `lexicographic_section`, else `part_of_speech_heading`) and have **distinct** `etymology_index`, all with `type === "LEXEME"`. Each group is rendered with **`HTML_LEXEME_HOMONYM_GROUP_TEMPLATE`** (one shared headline, then one block per etymology). **Rationale:** the API still returns one lexeme per etymology slice (source-faithful); merge is **display-only**, documented in `docs/query-result-dimensional-matrix.md` §11 and `docs/mockups/template-coverage-mock-entries.md` (L-02).
- **Non-HTML modes:** Markdown joins per-lexeme markdown without homonym merge (same data, simpler text pipeline). Text/ANSI modes concatenate per-lexeme `format(lexeme)`.

**Single-lexeme `HTML_ENTRY_TEMPLATE` choices (see `docs/mockups/template-coverage-mock-entries.md`):**

- **Ultra-compact form-of:** When `form_of` is present, type is not `FORM_OF`, there is exactly one sense with a gloss, no abbrev-only morph phrase, no single-tag morph line, and no multi-morph need, render one line: surface + normalized label + lemma + gloss (L-05). **Rationale:** avoids a redundant `→` row for trivial plurals.
- **Merged morph phrase:** Two or more morph lines from `##` subsenses, `display_morph_lines`, or expanded tags are collapsed into one phrase when possible (e.g. first/third person with shared tail; hyphen `first-person` uses “and”, spaced `first person` uses “or”), then `of:` and the lemma row (L-06/L-07). If merge is not applicable, lines are joined with ` · `. **Rationale:** dictionary-style density; bullets remain a fallback when merged text is empty.
- **Lemma without etymology chain:** If there is no `form_of` and no `etymology.chain` but senses exist, show an explicit “(etymology not given on Wiktionary)” placeholder (L-04). **Rationale:** avoids a blank gap; inflected-only stubs still omit this on the inflected row where empty etym is normal.
- **Subsense inline lettering:** Subsenses are rendered inline with `(a)`, `(b)`, `(c)` labels when there are two or more; singleton subsenses omit the label. **Rationale:** mid-dot bullets with `inline-block` caused undesirable line breaks; alphabetic labels with `display: inline` preserve the continuous flow expected in academic dictionaries.
- **Usage note bullet stripping:** `formatUsageNoteLine` strips leading wikitext list markers (`*`, `#`, `:`, `;`) before wiki markup stripping. **Rationale:** the `*` bullet conflated with Markdown emphasis markers from `preserveEmphasis`, causing `applyInlineEmphasis` to incorrectly italicize intervening text.

#### 12.10.7 Planned standard exports (roadmap)

Phase 9 / Stage 24 (`docs/ROADMAP.md`) adds **fragment-first** lexicographic serializers beside Handlebars, including **TEI Lex-0** and **full, ODXML-compliant** output per [ODict’s ODXML element reference](https://www.odict.org/docs/xml) (alongside OntoLex-Lemon, LMF, and XDXF). See §15 item 6.

### 12.11 Playground: Multi-Interface Triple-Window Architecture
The webapp's API Playground presents the SDK's three consumption interfaces —
TypeScript library, CLI tool, and REST API — as three stacked pseudo-windows
that stay in sync with the current playground state (query, language, PoS,
target wrapper, and props). Each window mimics a different operating-system
chrome to visually distinguish the interfaces:

1. **TypeScript** (Windows-style): title-bar with minimize/maximize/close
   controls (`─ ☐ ✕`) on the right. Displays the equivalent `import` +
   `await` call with syntax-highlighted TypeScript and the result as
   trailing comments.
2. **CLI** (macOS-style): traffic-light dots (red/yellow/green) on the left.
   Shows the shell command (`wiktionary-sdk γράφω --lang Auto --extract stem`)
   with colour-coded arguments, followed by formatted output via
   `TerminalHtmlStyle`.
3. **REST API** (Linux/Ubuntu-style): minimize/maximize/close controls
   (`▽ △ ✕`) on the right with a `user@sdk:~$` prompt. Displays the
   equivalent `curl` command targeting `http://localhost:3000/api/fetch`
   with the current query parameters, followed by raw JSON output.
   Non-ASCII query text is shown in the **decoded** form in the preview
   (Unicode in the URL path/query), matching browser address-bar behaviour;
   the wire format still uses percent-encoding when the request is sent.

All three title bars share a uniform dark background (`rgba(0,0,0,0.22)`)
and height (32px) for visual cohesion. The triple-window layout reinforces
that every playground action has an equivalent in all three interfaces,
teaching users to transition naturally between them.

The webapp root (`#root`) applies light horizontal padding so the layout does
not sit flush against the viewport edge on narrow screens.

### 12.12 API Enrichment: Structured Metadata Over Wikitext Parsing
From v2.0, the API call is extended to fetch `categories`, `langlinks`, and `info` alongside the Wikitext revision. **Rationale:** fetching these fields from the structured MediaWiki API is more reliable than parsing them from Wikitext (e.g., categories appear in Wikitext as `[[Category:...]]` entries scattered throughout, and are easily missed). The API also returns the revision ID and last-modified timestamp in the same request at no extra cost, enabling consumers to implement cache invalidation by revision.

**Design choice:** categories are filtered per language lexeme (lexemes only see categories relevant to their language section) using a heuristic that strips generic "Pages with..." administrative categories. The raw unfiltered list is available in `FetchResult.metadata.categories`.

### 12.13 Etymology: Ancestors vs. Cognates
Prior to v2, the `etymology.links` array mixed direct ancestors (`{{inh}}`, `{{der}}`, `{{bor}}`) with lateral cognates (`{{cog}}`). This was a design error: cognates are _not_ on the direct lineage path. In v2:
- `chain[]` contains only direct ancestors, in template order, allowing consumers to traverse the lineage tree.
- `cognates[]` contains only lateral cognates, for consumers who want cross-language comparison.
- Each entry in both arrays has an explicit `relation` field (`"inherited"` | `"borrowed"` | `"derived"` | `"cognate"`) so consumers do not need to inspect the original template name.

**Migration:** the `etymology()` library function reads `chain` first, falling back to the legacy `links` field.

### 12.14 Headword Morphology: Template Parameters as Ground Truth
Instead of inferring grammatical traits from the form or gloss, v2 extracts them directly from headword template parameters. **Rationale:** `{{el-verb|past=έγραψα|fut=θα γράψω|tr=yes|intr=yes}}` is an explicit, authoritative declaration by the Wiktionary editor. The parameter values are verbatim — they can be displayed directly to users and used to seed downstream morphological engines. If a parameter is absent, the field is `undefined`; the SDK makes no attempt to guess.

### 12.15 Form-of Labels: TAG_LABEL_MAP
The tag arrays produced by form-of templates (`["1", "s", "perf", "past", "actv", "indc"]`) are opaque to consumers unfamiliar with Wiktionary tagging conventions. The `label` field converts them to a natural-language phrase using a `TAG_LABEL_MAP` dictionary (`"perf"` → `"perfective"`, `"indc"` → `"indicative"`, etc.). **Design choice:** the raw `tags` array is always preserved alongside `label`, so consumers can apply their own formatting.

### 12.16 Offline API normalization (`normalizeWiktionaryQueryPage`)
`fetchWikitextEnWiktionary` maps one MediaWiki `query.pages[]` object (JSON `formatversion=2`) into the normalized page record (`wikitext`, `categories`, `langlinks`, `info`, `pageprops`, `exists`, `title`, `pageid`). That mapping is implemented as **`normalizeWiktionaryQueryPage(page, requestedTitle)`** in `src/api.ts` and reused by the fetch function.

**Rationale:** keeps a single source of truth for field extraction (NFC on wikitext, Category prefix stripping, etc.). **Use cases:** unit tests can feed synthetic or recorded JSON without HTTP; `tools/refresh-api-recording.ts` can refresh `test/fixtures/api-recordings/` for drift checks.

### 12.17 Unit-test harness: stub `src/api`, not the network
Default `npm test` must remain **offline**. Tests should prefer **`vi.mock("../src/api")`** with `fetchWikitextEnWiktionary` / `fetchWikidataEntity` (and `mwFetchJson` when exercising foreign wikis) returning fixture wikitext or minimal pages, then call the **real** `wiktionary()` so the parser and registry run on real wikitext.

**Partial `vi.mock("../src/index")` caveat:** replacing only the exported `wiktionary` with `vi.fn()` does not reliably replace the `wiktionary` binding inside `src/convenience/*.ts` modules (circular module graph with `importOriginal`). Helpers such as `lemma()`, `interwiki()`, `pageMetadata()`, and `stem()` may still invoke the **real** fetch path unless `api` is stubbed. **Design choice:** document this in `test/README.md` and `AGENTS.md` so new tests do not reintroduce live `en.wiktionary.org` calls or reliance on the in-memory cache to mask them.

### 12.18 Quality gates: goldens, decoder coverage, parser invariants
These are **verification artifacts**, not part of the runtime contract:

- **Golden snapshots** (`test/golden/entry-snapshots.test.ts`): fixture wikitext + mocked API → real `wiktionary()` → stable projection of LEXEME / INFLECTED_FORM fields compared to committed `.snap` files. **Rationale:** catches unintended decoder or merge regressions without asserting full AST dumps.
- **Decoder coverage** (`test/decoder-coverage.test.ts`): each registry decoder `id` must appear in the `test/` corpus (template names in fixtures, or explicit allowlist with rationale). **Rationale:** new decoders are not silently untested.
- **Parser invariants** (`test/parser.invariants.test.ts`): structural checks on `parseTemplates(wikitext, true)` (raw slice equals source span, non-overlapping regions, nesting). **Rationale:** guards the brace-aware parser independent of linguistic content.

### 12.19 Convenience aliases (`phonetic`, `derivations`, `audioDetails`, `interwiki`)

- **`phonetic`**: In `src/convenience/lexical-wrappers.ts`, exported as an alias for **`ipa()`** (primary IPA string per lexeme), not for `pronounce()` (audio-first). Prefer importing `ipa` or `pronounce` explicitly if the distinction matters.
- **`derivations`**: Alias for **`derivedTerms()`** only — returns `derived_terms.items` per lexeme. It does **not** merge `etymologyChain()`; use `etymologyChain()` / `etymology()` separately.
- **`audioDetails`**: Deprecated alias for **`audioGallery()`** (full `pronunciation.audio_details` list).
- **`interwiki`**: Alias for **`langlinks()`** (other Wiktionary editions for the page title).

### 12.20 Rationale for Multi-Audio Galleries

**Problem**: MediaWiki's `{{audio}}` templates are often used to list multiple regional variations (e.g., London / ˈlʌndən / and New York / ˈlʌndən /). Standard scrapers typically flatten these to a single file, causing loss of dialectal data.

**Solution**: The SDK's `audio_details` structure (v2.1) treats audio as a collection rather than a scalar. By extracting labels like "US", "UK", or "Netherlands", we preserve the linguistic geographic context, making the SDK suitable for accent analysis and localized TTS pipelines.

### 12.21 Rationale for Structured Citations

**Problem**: Usage examples in dictionary entries are typically a mix of prescriptive phrases (`{{ux}}`) and descriptive literary citations (`{{quote-book}}`). Treating both as simple strings fails to capture the metadata (author, year, work) essential for philological research.

**Solution**: The SDK distinguishes between these types at the decoder level. By mapping `author`, `year`, and `source` to the `Example` object, we transition from a "string-based example" model to a "structured literary corpus" model, enabling quantitative analysis of citation frequency and historical usage directly from the dictionary source.

### 12.22 Rationale for Ontological Depth (P31 vs P279)

**Problem**: Lexical entries are often categorized in Wikidata using both `instance of` (P31) and `subclass of` (P279). Most basic integrations only fetch P31, missing the broader categorical hierarchy (e.g., "dog" is a *subclass* of "canid", not an *instance* of it).

**Solution**: In v2.1, the SDK explicitly separates `instance_of` and `subclass_of` in the enrichment layer. This ensures that callers can differentiate between specific entities (tokens) and categorical types (concepts), which is critical for knowledge graph construction and semantic search.

### 12.23 Typographic Standard: The "Classical Academic" Aesthetic

From v2.1, the SDK adopts a specific "Design North Star" for human-readable output, codified in `docs/EXHAUSTIVE_TYPOGRAPHIC_SPECIMEN.html`.
- **Typographic Density**: Prioritizing high information density (multi-column layouts) over whitespace-heavy dashboards.
- **Academic Notation**: Standardized use of serif fonts (EB Garamond), small-caps for semantic labels (SYN, ANT, DER), and arrow-notation for etymology (←).
- **Rationale**: To emulate the formal authority and ease-of-scanning found in premium printed dictionaries (e.g., LSJ, Oxford, Brill).

### 12.24 Text-to-Dictionary (T2D) Pipeline

The SDK serves as the foundational "Layer 1" for the **Text-to-Dictionary** architecture (see `docs/TEXT_TO_DICTIONARY_PLAN.md`).
- **Context-Aware Extraction**: Future layers will use the SDK's metadata to disambiguate senses based on provided input text.
- **Token-to-Lemma Mapping**: T2D maps specific morphological occurrences in a text back to their exhaustive SDK entries.

### 12.25 Lexicographic Model: Entry vs. Lexeme

The project adopts a precise lexicographic terminology to avoid semantic
conflation between the page level and the concept level:

- **Entry** (or "vocabulary entry"): The page-level aggregate of all lexemes
  that share a headword. The Wiktionary page for "γράφω" is one entry.
- **Lexeme**: A single linguistic concept identified by the combination of
  **(language + part-of-speech + etymology index)**. A lexeme has one
  canonical form (the lemma), one set of definitions (senses), one
  pronunciation, and one set of semantic relations. If the entry for "γράφω"
  contains data for Ancient Greek Verb, Modern Greek Verb, and Italiot Greek
  Verb, those are three distinct lexemes.

**Mapping to the data model:**
- `FetchResult.lexemes: Lexeme[]` — the array of all lexemes found for a
  query. When `lang` and `pos` are specified, this typically contains one
  element. When both are `"Auto"`, it contains all lexemes discovered on the
  page.
- Each `Lexeme.id` encodes the triple: `el:γράφω#E1#verb#LEXEME`.
- The previous `entries` field and `Entry` interface were renamed to
  `lexemes` and `Lexeme` in v3.0 to align code semantics with this model.

**Why this matters:**
A Wiktionary page conflates multiple lexemes into a single document. Without
a clear lexeme-level identity model, downstream operations (filtering,
translating, inflecting) silently operate on the wrong lexeme or discard
valid alternatives. The v3 model makes every lexeme individually addressable.

### 12.26 Per-Lexeme Convenience Wrappers (`GroupedLexemeResults<T>`)

**Problem:** Prior to v3.1, convenience wrappers like `synonyms()`,
`stem()`, and `ipa()` called `getMainLexeme()` or `.find()` to select a
single lexeme from `FetchResult` and silently discarded the rest. When
`lang="Auto"` and `pos="Auto"`, a query like `"γράφω"` yields 3 lexemes,
but the caller only saw data from one — with no indication that alternatives
existed or were discarded.

**Design:** All lexeme-scoped wrappers now return `GroupedLexemeResults<T>`:

```typescript
interface GroupedLexemeResults<T> extends Array<LexemeResult<T>> {
  order: string[];
  lexemes: Record<string, {
    language: string;
    pos: string;
    etymology_index: number;
    value: T;
    support_warning?: string;
  }>;
}
```

The internal utility `mapLexemes<T>(result, extractor)` maps an extractor
function over every lexeme and wraps each output in this envelope. Extractors
may return either **`T`** or a branded envelope from **`withExtractionSupport(value, note)`**;
**`unwrapExtraction`** merges optional **`support_warning`** into each row. For
row-oriented iteration APIs (`map`, `find`, `filter`), callers can use
`asLexemeRows(grouped)` to project the grouped object into ordered rows.

**Consequences:**
- Callers always see the full picture: every lexeme's data, tagged with
  enough metadata to identify which lexeme produced it.
- Lexemes with no data for the requested field are included with empty/null
  values (e.g., `{ value: [] }`). The _absence_ of data is informative;
  callers can filter with `.filter(r => r.value.length > 0)`.
- When a specific language and PoS are provided, `order` usually has one
  lexeme id and `lexemes[id].value` gives the direct answer.
- Boolean predicates (`isCategory`, `isInstance`, `isSubclass`) return
  `GroupedLexemeResults<boolean>`; callers can use `asLexemeRows(results).some(r => r.value)` for
  "any" semantics.

**Scalar exceptions:**
- `lemma()`: A form-resolution utility that returns a string. It selects the
  best lemma by priority heuristic; used internally by other wrappers as a
  pre-resolution step.
- `pageMetadata()`: Returns `result.metadata?.info`, which is inherently
  page-level, not lexeme-level.
- `getMainLexeme()`: Retained as a public convenience utility for callers
  who explicitly want single-lexeme shortcutting. Documented as a "first
  match" heuristic.

### 12.27 Stem and Morphology Extraction: Per-Lexeme Templates

**Problem:** The `stem()`, `conjugate()`, and `decline()` functions
originally operated on `result.rawLanguageBlock` — the monolithic Wikitext
of the entire language section — and used `parseTemplates()` to find
paradigm templates. This meant they could not distinguish between templates
belonging to different lexemes within the same language block.

**Solution (v3.1):** These functions now operate on each lexeme's
`templates_all` field, which contains pre-parsed template data scoped to
that specific lexeme (with `params.positional` and `params.named` already
available).

- `stem()` uses a pure `extractStemsFromLexeme(lexeme)` function that
  iterates over `lexeme.templates_all`, filtering for paradigm template
  names (`el-conjug-*`, `el-verb-*`, `el-noun-*`, `el-nM-*`, `el-nF-*`,
  `el-nN-*`, `el-adj-*`, `el-decl-*`, `grc-conj`, `grc-decl`, etc.) and
  extracting stems from their parameters. Ancient Greek **`{{grc-conj}}`**
  tense codes map into **`VerbStems`** slots (present, imperfect, aorist,
  future, perfect, pluperfect, future perfect, etc.); **`{{grc-decl}}`**
  contributes nominal stems where applicable. Greek stem tokens are validated
  with a Unicode Greek-block regex (including polytonic and breve variants),
  not ASCII-only Greek letters.
- `conjugate()` finds the conjugation template in `lexeme.templates_all`,
  sends it to the MediaWiki parse API for HTML expansion, then scrapes the
  inflection table — but now scoped per-lexeme.
- `decline()` follows the same pattern for declension templates.

This means a query returning multiple lexemes (e.g., grc + el + Italiot
Greek for "γράφω") now extracts stems/paradigms independently for each
lexeme, rather than conflating them from the shared language block.

### 12.28 Lexeme Sort Order: Source vs. Priority

**Problem:** Wiktionary pages list language sections in a specific order
(often alphabetical, sometimes editorial). This order is meaningful — it
reflects editorial convention and can vary between pages. However, some
consumers (particularly those focused on Modern Greek) want the most
relevant language first regardless of source order.

**Solution:** The `sort` option on `wiktionary()` controls lexeme ordering:
- `"source"` (default): preserves the order in which language sections
  appear in the Wiktionary source markup. For "γράφω", this gives
  `[Ancient Greek, Greek, Italiot Greek]`.
- `"priority"`: applies a language-priority heuristic (`el` > `grc` > `en`
  by default), yielding `[Greek, Ancient Greek, Italiot Greek]` for that map.
- `{ strategy: "priority", priorities: { ... } }`: caller-supplied rank map
  for product-specific ordering (e.g. `grc` first for historical corpora).

Within the same language tier, secondary keys are deterministic:
1. `etymology_index` ascending
2. `part_of_speech_heading` alphabetical

**Design choice:** Source order is the default because it honors the
"source-faithful extraction" principle. Priority sorting remains opt-in,
and is now configurable without changing extraction semantics.

#### 12.28.1 Extraction support transparency (`support_warning`)

**Problem:** An empty **`value`** from a convenience wrapper is ambiguous: the
data may be missing from the entry, or present in wikitext but not extracted.

**Design:** Each **`LexemeResult<T>`** may include **`support_warning?: string`**.
**`src/convenience/extraction-support.ts`** provides **`withExtractionSupport`** /
**`unwrapExtraction`**, shared template checks, and **`warn*`** helpers; **`mapLexemes`**
merges warnings into rows. **`format()`** branch **3b** prints **Support:** beside
the formatted value across text, Markdown, HTML, terminal-HTML, and ANSI modes.
**`stem()`** lifts **`WordStems.support_warning`** from **`extractStemsFromLexeme`**
onto the row so JSON does not duplicate the note inside **`value`**.

**Rationale:** Additive typing; one optional string preserves JSON and formatted
parity without new top-level result envelopes.

**Coverage:** **`AGENTS.md`** lists which wrappers set warnings and known gaps.

### 12.29 Cross-interface invocation parity

**Problem:** The same convenience wrapper could be routed with different
argument order or defaults depending on caller surface (SDK direct call,
CLI `--extract`, or webapp Live API Playground). These drifts are subtle:
they often pass type checks but change runtime semantics.

**Design:** Wrapper invocation is centralized in
`src/convenience/wrapper-invoke.ts` via `invokeWrapperMethod()` and reused by:
- `cli/index.ts` (`invokeExtractWrapper`)
- `webapp/src/playground-api-execute.ts` (`runPlaygroundApiExecute`), called from **`App.tsx`**

The Live API Playground also exposes **`wiktionary`** as a first-class method
(direct **`wiktionary({ query, lang, pos, … })`** with **`enrich`**, **`matchMode`**,
**`debugDecoders`**, and **`sort`**) so the raw fetch path stays aligned with the wrapper
matrix without a separate code path.

The helper enforces canonical signatures for special families:
- `translate(query, sourceLang, target, props, preferredPos)`
- `wikipediaLink(query, sourceLang, target, preferredPos)`
- `isInstance/isSubclass(query, qid, sourceLang)`
- `conjugate/decline(query, sourceLang, criteria)`
- `hyphenate(query, sourceLang, options, preferredPos)`
- default wrappers `(query, sourceLang, preferredPos)`

**Rationale:** interface parity is now guaranteed by construction instead
of duplicated conditionals across clients.

### 12.30 Enrichment fallback chain hardening

When `pageprops.wikibase_item` is absent, enrichment now applies a strict
fallback sequence:
1. `fetchWikidataEntityByWiktionaryTitle(title)`
2. `fetchWikidataEntityByWikipediaTitle(title)`
3. only attach `lexeme.wikidata` if a valid `id` (`Q...`) is resolved

This path is validated by `test/fallback-enrichment-matrix.test.ts` with
four explicit branches (direct pageprops hit, Wiktionary fallback hit,
Wikipedia fallback hit, total miss).

**Rationale:** prevents partial/stub enrichment and ensures deterministic,
traceable QID attachment behavior.

### 12.31 Schema and formatter negative hardening

Beyond happy-path tests, the suite now includes:
- negative JSON schema assertions (`test/negative-schema-hardening.test.ts`)
  for malformed nested fields, invalid URI formats, invalid QID patterns,
  and additional-property violations in strict objects.
- formatter/adapter regression guards (`test/integration-adapters.test.ts`,
  `test/integration-hardening.test.ts`) to prevent `[object Object]` output
  and sparse payload artifacts across CLI/webapp presentation paths.

**Rationale:** reliability failures in integration layers are often caused
by shape drift, not extraction logic. Negative and adapter-level tests close
that gap.

### 12.32 Debug padding and TieredCache JSON resilience

**Debug padding:** When `debugDecoders: true` and lemma resolution appends
rows, `FetchResult.debug` is padded with **fresh** empty arrays per resolved
lexeme (`Array.from(..., () => [])`). **Rationale:** `Array.prototype.fill([])`
reuses one array reference for every slot, so mutating “lexeme *i*” events
would alias across indices — a subtle regression for inspector UIs.

**TieredCache L1:** `JSON.parse` on L1 string values is wrapped in
`try/catch`. **Rationale:** disk corruption, manual cache tampering, or
version skew can leave non-JSON strings in L1; treating parse failure as a
cache miss and **deleting** the bad entry avoids throwing on unrelated
`get()` calls and self-heals on the next write.

### 12.33 Testable REST handler (`buildApiFetchResponse`)

**Problem:** `server.ts` historically inlined fetch logic, making it awkward to
assert status codes, YAML vs JSON `Content-Type`, and error bodies without a
full HTTP server.

**Design:** `buildApiFetchResponse` parses `URL` search params, calls
`wiktionary()` (or a test double), and returns plain `{ status, headers, body }`.
**Rationale:** keeps CORS and response-shape rules in one module; tests stay
offline via mocked `wiktionaryFn`.

### 12.34 Orchestration audit suites and webapp RTL tests

Beyond goldens and integration matrices, the repository adds **targeted audit
tests** (filenames `*-audit.test.ts`) that encode expectations from the
engineering audit: orchestration (`wiktionary` / fuzzy / debug), API fetch
shapes, `wrapper-invoke` parity edges, `server-fetch` HTTP mapping, parser and
registry invariants, formatter and form-of enrichment behaviour, morphology
tag helpers, and `GroupedLexemeResults` typing. **Rationale:** freeze
non-obvious contracts called out in `audit.md` without bloating the main
regression files.

**Webapp:** Selected UI helpers (**URL/query sync**, **FormOfLexemeBlock**,
**playground API runner**) live in standalone modules under `webapp/src/` for
readability. **Vitest** runs **`test/webapp/*.test.ts(x)`** with **`jsdom`**,
**`@testing-library/react`**, and shared **`test/vitest-setup.ts`** (jest-dom
matchers, RTL cleanup). **Rationale:** guard popstate/query behaviour and
playground error paths that are easy to break inside a large `App.tsx`.

---

**Artifacts:**
- `src/index.ts`: Orchestration entry point.
- `src/model/`: Canonical type definitions (`src/model/index.ts` barrel).
- `docs/EXHAUSTIVE_TYPOGRAPHIC_SPECIMEN.html`: The typographic gold standard.
- `docs/TEXT_TO_DICTIONARY_PLAN.md`: Future architecture for text analysis.
- `schema/normalized-entry.schema.json`: Formal output schema (v3.0.0).
- `docs/dictionary-entry-v2.yaml`: Canonical machine-readable specimen.
- `webapp/src/App.tsx`: React frontend with inspector, comparison mode, and triple-window playground.
- `webapp/src/playground-api-execute.ts`, `url-query-popstate.ts`, `FormOfLexemeBlock.tsx`, `pick-lemma-lexeme.ts`: extracted playground helpers (tested under `test/webapp/`).
- `audit.md`: Architecture and reliability critique (non-normative; informs audit tests).
- `docs/ROADMAP.md`: Forward-only implementation plan (remaining work); delivered history in `CHANGELOG.md`.
- `webapp/src/index.css`: Dual-theme stylesheet (light dictionary + dark inspector).
- `cli/index.ts`: CLI tool with `--extract`, `--props`, `--format ansi`.
- `server.ts`: HTTP API wrapper.
- This specification document.

## 13. Post-v1.0 roadmap (non-normative)

This section is informational only. For the **backlog** of staged engineering and product work, see `docs/ROADMAP.md`. Delivered roadmap stages are summarized in `CHANGELOG.md`.

**Completed (post-v1.0):**

- **Parser correctness**: fully brace-aware template parameter splitting
  (split on `|` only when both `[[...]]` and `{{...}}` depths are zero).
- **Translation shape correctness**: `term` (required), `gloss?`, `transliteration?`,
  `gender?`, `alt?` from explicit params. No inference.
- **Unknown language behavior**: `langToLanguageName()` returns `null` for
  unknown codes; `wiktionary()` returns early with a note.
- **Schema versioning**: `FetchResult` always includes `schema_version`.
- **Distribution hardening**: CLI and server compiled to `dist/`; `bin` and
  `serve` point to built JS. Cache key normalization for redirects.
- **Type alignment**: `LexemeType` matches schema enum.
- **Registry-driven debug events**: `wiktionary({ debugDecoders: true })` returns
  `FetchResult.debug` with per-lexeme decoder match info.
- **Template ordering and location**: `Lexeme.templates_all` stores templates in document
  order with optional `start`, `end`, `line`. Parser supports `parseTemplates(..., withLocation)`.
- **Cycle protection and lemma linkage**: `wiktionaryRecursive()` with visited set;
  `lemma_triggered_by_lexeme_id` on resolved lemma lexemes.
- **Declared decoder coverage**: `handlesTemplates` on decoders; `getHandledTemplates()` for
  introspection. Template-introspect uses declared coverage instead of probe-based logic.
- **Sense gloss_raw**: `Sense.gloss_raw` stores exact text before stripping.
- **Section links**: `derived_terms`, `related_terms`, `descendants` with `raw_text` and `items`
  from `{{l}}`/`{{link}}` in `====Derived terms====`, etc.
- **Sample mode**: `--sample N` flag on template-introspect samples real Greek entries and
  reports top missing templates by frequency.
- **Cross-interface invocation parity**: shared wrapper dispatch helper used
  by SDK/CLI/webapp; parity and routing contracts covered by dedicated suites.
- **Fallback-enrichment matrix**: explicit tests for pageprops, Wiktionary
  title fallback, Wikipedia title fallback, and no-QID branches.
- **Negative schema hardening**: malformed payload cases intentionally
  rejected by JSON Schema validation suite.
- **Audit-driven regression suites**: `*-audit.test.ts` files encode
  orchestration, REST wiring, parser/registry, formatter, and wrapper contracts
  called out in `audit.md`; **`buildApiFetchResponse`** keeps `server.ts`
  testable without sockets; debug padding and TieredCache JSON parse guard
  (§12.32–12.33). Webapp playground helpers covered by **`test/webapp/`**
  (jsdom + React Testing Library, §12.34).

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

- **Webapp: triple-window playground**: The API Playground now presents three synced
  pseudo-windows — TypeScript (Windows chrome), CLI (macOS chrome), and REST API
  (Linux/Ubuntu chrome) — each showing the equivalent invocation and output. See §12.11.

- **Webapp: GitHub corner**: Canonical tholman-style GitHub corner with octocat wag animation
  on hover, linking to `https://github.com/rhythmus/wiktionary-sdk`. Uses document-flow
  positioning (`position: absolute`) so it scrolls with the page.

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
- **Lemma Resolution Prioritization**: Updated `src/convenience/lemma-translate.ts` to favor `INFLECTED_FORM` entries
  when searching for a lemma, preventing metadata blocks from intercepting resolution.
- **Robust IPA Decoding**: Updated `src/registry.ts` to find IPA even if slashes (`/`) or 
  brackets (`[]`) are missing in the wikitext template.
- **Hyphenation Support**: Confirmed `hyphenate()` returns arrays by default and supports 
  the `{ format: 'string' }` option for full flexibility.
- **API Aliases**: `phonetic` is an alias for `ipa()`. `derivations` is an alias for
  `derivedTerms()` (returns `derived_terms.items`, typically `{ term, … }[]`).

**Completed (v1.4 Auto-discovery & PoS Filtering):**

- **Auto-discovery Mode**: Implemented `lang="Auto"` as the default, enabling the SDK to scan
  and aggregate lexemes across all language sections found on a page.
- **Language Priority Engine**: Introduced a `LANG_PRIORITY` map for opt-in sorting 
  via `sort: "priority"` (Greek > Ancient Greek > English). Default is `sort: "source"`,
  preserving Wiktionary source order.
- **Optional PoS Filtering**: Added `pos` as an optional parameter (defaulting to `"Auto"`)
  supporting both precise PoS matching and broad discovery.
- **Robust H3-H5 Parser**: Refactored the core segmentation logic to use symmetrical regex
  for all heading levels from H3 to H5, resolving missing PoS blocks in complex etymologies.
- **Cross-Language Resolution**: Optimized `lemma()` and convenience wrappers to operate
  seamlessly across multiple languages in Auto mode, while maintaining language-affinity
  during recursive resolution.
- **Expanded Language Mapping**: Added support for 15+ additional languages in the internal
  mapping to improve the reliability of multi-language scans.
- **Webapp Integration**: Updated the React playground to use Auto-discovery by default,
  providing instant feedback on the SDK's ability to handle multi-entry pages like "bank".

**Completed (v2.0 Comprehensive Schema Evolution & API Enrichment):**

- **API Enrichment**: Extended `prop` to include `categories`, `langlinks`, and `info` on every
  fetch. `FetchResult.metadata` now exposes all three. Per-lexeme `categories` and `langlinks`
  are filtered by language section; `source.wiktionary.revision_id`, `last_modified`, and
  `pageid` provide full audit provenance.
- **Schema bump to v2.0.0**: Major version increment reflecting structural changes to
  `EtymologyData`, `SemanticRelations`, `Sense`, `Pronunciation`, `Entry`, and `FetchResult`.
  JSON Schema (`schema/normalized-entry.schema.json`) updated throughout.
- **Etymology restructure**: `etymology.links` split into `chain[]` (ancestors) and
  `cognates[]` (lateral cognates), each with an explicit `relation` field. `raw_text` preserves
  the full etymology prose preamble.
- **Headword morphology**: New `headword_morphology` field on `Lexeme` with `transitivity`,
  `aspect`, `voice`, `gender`, and `principal_parts`, all extracted from headword template
  params — never guessed.
- **Pronunciation extended**: `audio_url` (resolved Commons URL), `romanization`, `rhymes`,
  and `homophones` added to the `Pronunciation` interface.
- **Sense enrichment**: `qualifier` (parenthetical text), `labels` (register tags from
  `{{lb}}`), and `topics` (domain tags) added to `Sense`.
- **Expanded semantic relations**: `coordinate_terms`, `holonyms`, `meronyms`, `troponyms`
  added to `SemanticRelations` via `{{cot}}`, `{{hol}}`, `{{mer}}`, `{{tro}}`.
- **New section decoders**: Alternative forms, See also, Anagrams, References, Inflection
  table reference.
- **Form-of labels**: `form_of.label` provides human-readable description from tag array
  via `TAG_LABEL_MAP`.
- **19 new convenience wrappers**: `principalParts()`, `gender()`, `transitivity()`,
  `alternativeForms()`, `seeAlso()`, `anagrams()`, `usageNotes()`, `derivedTerms()`,
  `relatedTerms()`, `descendants()`, `referencesSection()`, `etymologyChain()`,
  `etymologyCognates()`, `etymologyText()`, `categories()`, `langlinks()`, `isCategory()`,
  `pageMetadata()`, `inflectionTableRef()`.
- **`richEntry()` updated**: now includes `coordinate_terms`, `holonyms`, `meronyms`,
  `troponyms`, `references`, `aspect`, and `voice` from the enriched entry data.
- **Test suite updated**: `test/phase2.test.ts`, `test/integration.test.ts`,
  `test/library.test.ts`, `test/readme_examples.test.ts`, `test/auto.test.ts` updated
  for new field names and shapes; `test/enrichment.test.ts` for metadata extraction;
  offline API stubs in enrichment/auto/stem/library tests; `test/golden/` snapshots,
  `test/decoder-coverage.test.ts`, `test/parser.invariants.test.ts`,
  `test/network-replay.test.ts`, `test/fixtures/api-recordings/`; `vitest` default run
  excludes `test/bench.test.ts` (`npm run test:perf`); see `test/README.md`.

### v3.1.0 — Per-Lexeme Convenience Wrappers

- **`GroupedLexemeResults<T>` envelope**: All lexeme-scoped convenience wrappers now
  return grouped per-lexeme output with stable `order` and a `lexemes` map, preserving
  explicit metadata (`language`, `pos`, `etymology_index`) for each extracted `value`.
- **`mapLexemes<T>()` utility**: A generic mapping function in `src/convenience/grouped-results.ts` that applies
  an extractor to each lexeme and wraps it in grouped output.
- **`asLexemeRows()` helper**: Provides an ordered row projection for callers that prefer
  `map/find/filter` ergonomics.
- **Scalar exceptions**: `lemma()` (form resolution), `pageMetadata()` (page-level data),
  and `getMainLexeme()` (convenience shortcut) remain scalar.
- **`stem()` refactored**: Now extracts stems from each lexeme's `templates_all` field
  and returns compact stem aliases; `stemByLexeme()` exposes full `WordStems` structures.
- **`morphology()`, `conjugate()`, `decline()` refactored**: Now operate per-lexeme,
  finding paradigm templates in `lexeme.templates_all` and returning tagged results.
- **~38 lexeme-scoped wrappers updated**: `synonyms`, `antonyms`, `ipa`, `translate`,
  `richEntry`, `isCategory`, `isInstance`, `isSubclass`, and all others now return
  grouped results.
- **Schema version**: `SCHEMA_VERSION` remains `"3.0.0"` (the `LexemeResult` envelope
  is a library-level contract, not a change to the normalized entry schema).

### v3.1.1 — Playground Triple-Window & Lexicographic Formats Roadmap

- **Triple-window playground**: The API Playground now presents three stacked,
  synced pseudo-windows — TypeScript (Windows chrome), CLI (macOS chrome), and
  REST API (Linux/Ubuntu chrome) — showing the equivalent invocation for each
  SDK interface. See §12.11 for architecture details.
- **REST API curl preview**: A new `buildPlaygroundCurlSnippet()` function generates
  the equivalent `curl` command for the REST API server (`GET /api/fetch?query=…`),
  dynamically synced with the current playground state.
- **GitHub corner scroll fix**: Changed from `position: fixed` (viewport-locked) to
  `position: absolute` (document-flow) so the GitHub corner scrolls with the page.
- **Unified title-bar styling**: All three window chrome bars share the same
  background, height, and border for visual cohesion.
- **Roadmap: Lexicographic Standard Output Formats (Stage 24)**: Added a detailed
  roadmap issue for implementing five standard output formats: Semantic HTML5,
  TEI Lex-0, OntoLex-Lemon (JSON-LD), LMF (ISO 24613), and XDXF. Includes
  element mapping tables, architecture notes, and priority ordering.

### v3.1.2 — Contract hardening and responsive mobile layout

- **Wrapper contract tests**: Added a dedicated `wrapper-contract` suite to enforce
  grouped per-lexeme result shape across convenience wrappers.
- **Decoder coverage evidence tightened**: Added explicit corpus evidence matching for
  `alternative-forms-section` and `el-noun-stems`, plus fixture evidence for
  `Alternative forms` sections.
- **Mobile playground ergonomics**: Added narrow-layout reflow for the Live API
  Playground controls (split rows, hidden inspector, square execute icon).
- **Search bar narrow UX**: On narrow viewports, language/PoS filters move below the
  search bar as a full-width external row; fetch button collapses to icon mode to
  maximize query input width.
- **Preview panes constrained**: TypeScript/CLI/REST pseudo-windows now cap at `80vh`
  with internal vertical scrolling to avoid viewport overflow.

### v3.1.3 — Shared copy pipeline and webapp style-system consolidation

- **Single-source copy management**: Added `shared-copy.yaml` as canonical source for
  hero title/tagline/intro content and link targets. **Rationale:** avoid drift between
  README marketing copy and webapp hero copy.
- **Generated web constants**: Added `webapp/src/shared-copy.generated.ts` and
  `tools/sync-shared-copy.ts`; `npm run sync:copy` now regenerates web constants and
  rewrites README hero content in one step.
- **Sync guard in CI**: Added `npm run check:sync-copy` to fail when generated copy is
  stale. **Rationale:** makes copy drift a detectable build-time issue rather than a
  manual review burden.
- **URL query routing**: The webapp now supports `/?q=...` deep-links, initializes the
  search box from URL state, pushes query changes to browser history, and handles
  back/forward (`popstate`) updates.
- **Inline-style extraction complete**: Moved App-level inline style declarations into
  semantic classes in `webapp/src/index.css` and removed `webapp/src/App.css`.
  **Rationale:** reduce JSX noise, improve maintainability, and make responsive tuning
  centralized and deterministic.

### v3.1.7 — FetchResult formatting, homonym-merged cards, and template coverage

- **`format(FetchResult)` / `formatFetchResult()`:** When `format()` receives a `FetchResult` (`schema_version` + `lexemes[]`), HTML modes render **query `notes`** (redirect/fuzzy/miss messages), an **empty lexeme** banner when appropriate, and **homonym-merged** cards: consecutive `LEXEME` rows with the same language, surface form, and PoS but different `etymology_index` are combined into one headline plus stacked etymology+sense blocks (`src/lexeme-display-groups.ts`, `lexeme-homonym-group.html.hbs`). **Rationale:** matches dictionary UX in `docs/mockups/template-coverage-mock-entries.md` (L-02) without changing the normalized `lexemes[]` API.
- **Single-lexeme templates:** Ultra-compact inflected line (L-05), merged multi-line morph phrase instead of bullets when lines share a person pattern (L-06/L-07), lemma **subsenses** in HTML, etymology **placeholder** when a lemma has senses but no chain, **`posLine`** fallback to heading and `(unknown)`.
- **Prose mocks:** `docs/mockups/template-coverage-mock-entries.md` enumerates presentation targets for template authors.

### v3.1.6 — Query result dimensional matrix

- **Documentation:** `docs/query-result-dimensional-matrix.md` enumerates the cross-product of page fetch, strict/fuzzy match, language scope, etymology slices, PoS blocks, lexeme type, morph display richness (including Spanish-style multi-line within one lexeme), lemma resolution, and enrichment — with code pointers and explicit “what the matrix does not guarantee.”

### v3.1.5 — Form-of morph display, abbrev tokens, and MediaWiki parse enrichment

- **Problem:** Per-lang form-of templates (e.g. `{{es-verb form of|sensar}}`) often leave **no** `##` subsenses and **no** morph tags in wikitext; Lua emits nested lists only in **parsed HTML**. Plain wikitext extraction therefore had only `form_of.label` (“Verb form”) for display.
- **`form_of.display_morph_lines` / `display_morph_lines_source`:** Optional enrichment via `action=parse` on `gloss_raw` + page title; extraction of `ol ol > li` text; gated by `isPerLangFormOfTemplate()` and empty wikitext-derived morph lines; runs when `enrich` is true (`src/form-of-parse-enrich.ts`, wired from `src/index.ts`).
- **Formatter:** Morph bullets vs inline headline (`plural of`, single `ing-form`, abbrev `voc|m|s`, multi-line Spanish); `first/third-person …` split; lemma–PoS spacing CSS. See bundled templates and `src/formatter.ts`.
- **Documentation:** Normative design note `docs/form-of-display-and-mediawiki-parse.md` (quirks, rationales, what not to do, Spanish exemplar).

### v3.1.4 — Extended form-of family, sense restrictions, fuzzy fetch, and tooling

- **Category-aligned form-of detection**: `isFormOfTemplateName()` / `isVariantFormOfTemplateName()` in `registry.ts` align the decoder and `guessLexemeTypeFromTemplates()` with en.wiktionary’s broad “form of” template category (plus explicit exclusions such as `only used in`, which uses a different sense-level contract).
- **`Sense.only_used_in`**: Structured decode of `{{only used in|lang|term(s)}}` with JSON Schema (`OnlyUsedIn`) and reference YAML note; supports plain + HTML presentation without surfacing raw wikitext as the primary gloss.
- **Semantic relations headings**: `semantic-relations` decoder matches section titles with the same `=+Title=+` pattern as `extractSectionByLevelHeaders`, fixing missed `====Synonyms====`-style blocks.
- **Template-only definition glosses**: When a definition line is only templates, sense parsing emits readable `gloss` strings (form-of family, `construed with`, etc.) using the same positional rules as the form-of decoder where applicable.
- **`wiktionary({ matchMode: "fuzzy" })`**: Optional query variants (diacritic-stripping / compatibility forms) merge deduplicated lexemes with audit notes; strict mode remains the default.
- **`normalizeWikiLangArg()`**: Maps Wiktionary section titles (e.g. “Afrikaans”) to `WikiLang` codes where listed in `langToLanguageName` / `languageNameToLang`; extended language codes include `af`, `da`, `es`, `la`, `ja`, `ar`, `ru`, `it`, `pt` for playground and normalisation.
- **Hyphenation**: Leading language tokens on `{{hyphenation|…}}` use an explicit allowlist and script-aware rules so Greek syllables are never dropped as if they were language codes.
- **Tooling**: `npm run report:form-of` runs `tools/form-of-template-report.ts` against the live API to list category members vs `isFormOfTemplateName()` (with a short section for `only used in` as same-category, different semantics).
- **Tests**: `test/registry-ids.test.ts` guards against duplicate decoder `id` registrations; registry and integration tests cover new decoders and gloss behaviour.

### v3.3.0 — JSON Schema parity and documentation `$defs`

- **`SCHEMA_VERSION` / JSON Schema**: `schema_version` is **required** on `FetchResult` in the schema (always emitted by `wiktionary()`). New `$defs` document `LexicographicSectionSlug`, langlinks, page `info`, decoder debug events, library row shapes (`LexemeResult`, `GroupedLexemeMapValue`), morphology API criteria, `EtymologyData.links` (deprecated alias of `chain`), `AlternativeForm.type` / `labels`, and corrected **`RichEntry`** (`etymology` as `EtymologyData`, `headword_morphology`, `images`, typed `translations` items). `TranslationItem.params` accepts `TemplateParams` or a generic object.

### v3.2.0 — PartOfSpeech vocabulary (ODict alignment)

- **`PartOfSpeech` / `PART_OF_SPEECH_VALUES`**: Expanded with standard tags from [ODict part-of-speech reference](https://www.odict.org/docs/reference/pos) using **snake_case** (`auxiliary_adjective`, `subordinating_conjunction`, …) and the full **Japanese** tag set with hyphens mapped to underscores (`adj_na`, `v5r_i`, …). Synonymous ODict abbreviations (`n`, `adj`, `vt`, …) are **not** separate enum members; map them onto `noun`, `adjective`, `transitive_verb`, etc. when importing.
- **`lexicographic-headings.ts`**: Unchanged default strict mapping for en.wiktionary English headings; new slugs are primarily for interchange, filtering, and future headword or edition-specific decoders.
- **JSON Schema**: `$defs.PartOfSpeech.enum` and package `SCHEMA_VERSION` bumped to **3.2.0** (additive enum extension).

## 14. Implementation map (source tree)

This section is a **reader’s guide** to the repository layout as it exists today. It complements the normative rules above with file-level pointers for contributors and advanced consumers.

### 14.1 Core engine (`src/`)

| Module | Responsibility |
|--------|----------------|
| **`index.ts`** | Public package **barrel**: re-exports **`wiktionary()`**, **`wiktionaryRecursive()`**, **`stripCombiningMarksForPageTitle`** from `wiktionary-core.ts`, plus library/formatter/stem/wrapper helpers and shared constants. |
| **`wiktionary-core.ts`** | **`wiktionary()`**, fuzzy merge, **`wiktionaryRecursive()`**, lemma resolution queue, Wikidata enrichment loop, `sort`, internal `guessLexemeTypeFromTemplates()` (via `isFormOfTemplateName` / `isVariantFormOfTemplateName`). Import from here inside the repo instead of `index.ts` to avoid cycles. |
| **`constants.ts`** | Shared defaults: **`LANG_PRIORITY`**, **`SERVER_DEFAULT_WIKI_LANG`**, cache TTL, rate-limit interval. |
| **`src/model/`** | `SCHEMA_VERSION`, `Lexeme`, `FetchResult`, `EtymologyStep`, `DecodeContext`, `TemplateDecoder`, `DecoderDebugEvent`, and all shared interfaces (see `model/index.ts`). |
| **`api.ts`** | **`mwFetchJson()`** (rate limit + fetch), **`normalizeWiktionaryQueryPage()`**, **`fetchWikitextEnWiktionary()`**, **`fetchWikidataEntity()`**, Wikidata title lookups by site. |
| **`parser.ts`** | Language sections (`extractLanguageSection`, `extractAllLanguageSections`), **`splitEtymologiesAndPOS()`** (PoS-boundary rule), **`parseTemplates()`** (brace-aware, optional positions), heading → PoS mapping, language name ↔ code helpers, sense-line parsing helpers used by the registry. |
| **`registry.ts`** | Public entry: singleton **`registry`**, **`registerAllDecoders(registry)`**, re-exports **`registerAllDecoders`**, **`DecoderRegistry`**, **`stripWikiMarkup`**, form-of predicates. Ordered decoder list: **`docs/registry-inventory.md`**. |
| **`registry/decoder-registry.ts`** | **`DecoderRegistry`** class, **`decodeAll()`**, patch merge via **`merge-patches.ts`**. |
| **`registry/decoder-ids.ts`** | **`EXPECTED_DECODER_IDS`** — canonical registration sequence for order tests and **`tools/assert-registry-order.ts`**. |
| **`registry/register-core-pronunciation.ts`** | **`registerCoreAndPronunciation(reg)`** — first four decoders (verbatim templates, IPA, hyphenation, PoS-block alternative-forms section). |
| **`registry/register-all-decoders.ts`** | **`registerAllDecoders(reg)`** — thin orchestrator: sequential **`register*(reg)`** calls into family modules under **`registry/register-*.ts`**, normative order. |
| **`registry/`** (helpers) | **`merge-patches.ts`**, **`form-of-predicates.ts`**, **`strip-wiki-markup.ts`**, **`section-extract.ts`** (section bodies + `l`/`link` lists + heading match), **`gender-map.ts`**, **`form-of-display-label.ts`** (form-of human labels). |
| **`src/convenience/`** | Convenience wrappers (split modules: **`grouped-results`**, **`lemma-translate`**, **`relations`**, **`lexical-wrappers`**, **`page-enrichment`**, **`rich-entry`**, morphology/stem; **`getNativeSenses()`** lives with `translate` for foreign wikis). |
| **`morphology.ts`** | **`morphology()`**, **`conjugate()`**, **`decline()`**, **`parseMorphologyTags()`**, Greek template discovery via `templates_all`, **`action=parse`** on raw conjugation/declension template wikitext, HTML table scraping via `node-html-parser`. |
| **`form-of-display.ts`** | Pure morph-line helpers for form-of cards (`expandDualPersonInflectionLine`, abbrev-tag detection, **`inflectionMorphDisplayLines`**) — shared by **`formatter.ts`** and **`form-of-parse-enrich.ts`**. |
| **`form-of-parse-enrich.ts`** | Batch **`enrichFormOfMorphLinesFromParseBatch()`**, **`mwParseWikitextFragment()`** (parse with page title context), HTML extraction `ol ol > li`. |
| **`formatter.ts`** | **`format()`**, **`formatFetchResult()`**, Handlebars registration, prose merge helpers for multi-line morph display, style registry (`text`, `markdown`, `html`, `ansi`, `terminal-html`, …); re-exports morph helpers from **`form-of-display.ts`**. |
| **`lexeme-display-groups.ts`** | **`groupLexemesForIntegratedHomonyms()`** — consecutive lexeme grouping for HTML homonym cards (display-only). |
| **`templates/templates.ts`** | Generated/bundled template strings (`HTML_ENTRY_TEMPLATE`, `ENTRY_CSS`, …). Sources: `src/templates/*.hbs`, `entry.css`. |
| **`stem.ts`** | Stem extraction from **`lexeme.templates_all`** (paradigm templates). |
| **`wrapper-invoke.ts`** | **`invokeWrapperMethod()`** — canonical argument wiring for CLI and webapp (`translate`, `wikipediaLink`, `isInstance`, `conjugate`, `hyphenate`, …). |
| **`utils.ts`** | **`deepMerge()`**, **`commonsThumbUrl()`**, shared utilities. |
| **`cache.ts`** | **`TieredCache`**, **`MemoryCache`**, **`getCache()`** / **`setCache()`** global accessor pattern for L1 (+ optional L2/L3 adapters). |
| **`server-fetch.ts`** | **`buildApiFetchResponse()`** — pure assembly of `GET /api/fetch` responses for `server.ts` and tests. |
| **`rate-limiter.ts`** | **`RateLimiter`**, **`getRateLimiter()`**, throttle + User-Agent headers. |

### 14.2 Consumers

| Surface | Location | Notes |
|---------|----------|-------|
| **CLI** | `cli/index.ts` | `--extract`, `--props`, `--sort`, `--lang-priorities`, `--no-enrich`, batch mode, YAML/JSON/ANSI output. |
| **HTTP** | `server.ts` | Minimal `GET /api/fetch` (see §11.1); delegates to **`src/ingress/server-fetch.ts`**. |
| **Webapp** | `webapp/src/App.tsx` + helpers | Playground, inspector, triple-window codegen; **`runPlaygroundApiExecute`** uses **`invokeWrapperMethod`** like CLI (§12.29). |

### 14.3 Tooling (`tools/`)

| Script | Role |
|--------|------|
| **`verify_templates.ts`** | Template verification against live or recorded data (see `AGENTS.md`). |
| **`template-introspect.ts`** | Category crawl → missing-decoder report (`npm run introspect`). |
| **`form-of-template-report.ts`** | Live category vs `isFormOfTemplateName()` (`npm run report:form-of`). |
| **`sync-shared-copy.ts`** | Regenerate marketing copy for README + webapp (`npm run sync:copy`). |
| **`refresh-api-recording.ts`** | Refresh offline API fixtures (`npm run refresh-recording`). |
| **`stress-test.ts`**, **`inspect-word.ts`**, **`raw-api-dump.ts`**, **`test-formatter.ts`** | Ad-hoc diagnostics and benchmarks. |

### 14.4 Tests (`test/`)

Representative suites (see **`test/README.md`** for tiers and mocking rules):

- **`parser.test.ts`**, **`parser.invariants.test.ts`** — template/syntax invariants.
- **`registry.test.ts`**, **`decoder-coverage.test.ts`**, **`registry-ids.test.ts`** — decoder behaviour and evidence allowlist.
- **`library.test.ts`**, **`wrapper-contract.test.ts`**, **`cross-interface-parity.test.ts`** — wrappers and CLI/webapp parity.
- **`golden/entry-snapshots.test.ts`** — stable projections vs committed snapshots.
- **`schema-pos-parity.test.ts`**, **`types-grouped-results.test.ts`** — CI parity guards for TypeScript enum/type surfaces vs schema and grouped wrapper result contracts.
- **`integration*.test.ts`**, **`fallback-enrichment-matrix.test.ts`**, **`negative-schema-hardening.test.ts`** — integration and schema guards.
- **`network-replay.test.ts`** — optional live/replay path (`WIKT_TEST_LIVE=1`).
- **`*-audit.test.ts`** — orchestration, API, server-fetch, parser, registry, formatter, form-of, morphology, library, wrapper-invoke audits (see §12.34, `audit.md`).
- **`test/webapp/*.test.ts(x)`** — jsdom + React Testing Library for extracted playground modules (`vitest-setup.ts`).

### 14.5 Morphology implementation detail (Greek-first)

`conjugate()` / `decline()` locate **Modern Greek** paradigm templates by default on **`lexeme.templates_all`** (e.g. `el-conjug-`, `el-conj-`, `el-noun-`, `el-decl-`, …). Their `action=parse` calls now include **`title`** context so Lua modules that depend on page title can resolve consistently. Non-Greek template families are opt-in via explicit `MorphologyExpansionOptions` prefix arrays (`conjugationTemplatePrefixes`, `declensionTemplatePrefixes`) to avoid silent broadening of extraction scope.

### 14.6 Category filtering on lexemes

Per-lexeme **`categories`** are filtered in `index.ts` with a substring heuristic: keep categories whose names mention the **language section display name** (e.g. “Greek”) **or** the generic “pages with” maintenance bucket. Full, unfiltered categories remain on **`FetchResult.metadata.categories`**.

## 15. Future development vectors (non-normative)

The codebase is deliberately modular so the following extensions can be pursued without breaking the “source-faithful decoder registry” invariant:

1. **Language-priority profiles**: Build higher-level presets/locales on top of configurable `wiktionary({ sort: { strategy: "priority", priorities } })` (see §12.28).
2. **REST/CLI parity (continued)**: Keep query-param/flag parity as options evolve (recently: `matchMode`, `sort`, `langPriorities`, `debugDecoders`, true `pos` filter); evaluate whether server default `lang=el` should converge with library default `Auto`.
3. **Non–en.wiktionary wikis**: Introduce a site parameter (e.g. `el.wiktionary.org`) with separate normalizers; most of the pipeline (brace-aware parse, registry) is reusable, but section headings and template families differ.
4. **Decoder expansion**: Continue category-driven coverage (`template-introspect`, `report:form-of`); keep **one registration per `id`**, evidence in fixtures or allowlist (`decoder-coverage.test.ts`).
5. **Persistent cache adapters**: Implement L2/L3 `CacheAdapter` for Node (SQLite/disk) or browser (IndexedDB) and document cache invalidation using `revision_id` / `last_modified`.
6. **Standard lexicographic exports**: TEI Lex-0, **ODXML ([ODict ODXML](https://www.odict.org/docs/xml))** — full schema-compliant serialization alongside TEI; OntoLex-Lemon, LMF, XDXF — mapped in roadmap Stage 24 (Phase 9 of `ROADMAP.md`); would sit beside Handlebars as additional **`FormatterStyle`** or standalone serializers of `Lexeme`.
7. **Optional schema diagnostics**: Add `wikidata_error` to JSON Schema as an optional string if long-term consumer validation of failed enrichment is desired.
8. **Morphology beyond Greek**: Expand and harden non-el template families (currently explicit-prefix opt-in), then add regression fixtures per language.
9. **Sense disambiguation layer**: Build “Layer 2” consumers (see `docs/TEXT_TO_DICTIONARY_PLAN.md`) that use `FetchResult.lexemes` + metadata to pick senses from running text — explicitly out of scope for the extractor itself.

---

*End of specification v3.4.*
