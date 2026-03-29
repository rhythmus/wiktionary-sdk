# Wiktionary SDK — Formal Specification (v2.1)

**Scope:** deterministic, source-faithful extraction of lexicographic data from **Wiktionary** (primary), optionally enriched with **Wikidata** and **Wikimedia Commons**.  
**Non-scope:** any linguistic inference, paradigm completion, stem guessing, accent rules, generation of missing forms.

## 1. Goals

Given:

- `query_term: string` (required)
- `lang: string` (optional; defaults to `"Auto"`)
- `pos: string` (optional; defaults to `"Auto"`)
- optional disambiguators:
  - `enrich_wikidata?: boolean` (lemma-only)

Return:

1) **verbatim** Wikitext extracted from Wiktionary via MediaWiki API  
2) a **normalized JSON/YAML representation** derived *only* from explicit Wikitext/template data  
3) optional Wikidata enrichment for lemma entries (QID, sitelinks, P18 image)  
4) **page-level metadata** (categories, interwiki links, revision ID, last-modified timestamp) extracted from the MediaWiki API

The output conforms to a formal JSON Schema (`schema/normalized-entry.schema.json`), versioned per `VERSIONING.md`.

**Roadmap note (non-normative):** this document specifies v2.0 behavior and
data contracts. For the implementation history and completed stages, see `docs/ROADMAP.md`.

## 2. Data Sources

### 2.1 Wiktionary (primary)

- API endpoint: `https://en.wiktionary.org/w/api.php`
- Fetch method:
  - `action=query`
  - `prop=revisions|pageprops|categories|images|langlinks|info`
  - `rvprop=content`, `rvslots=main`
  - `cllimit=50`, `imlimit=20`, `lllimit=20`
  - `redirects=1`

In addition to the Wikitext revision content, every API call now retrieves:

- **`categories`**: structured list of page categories ("Category:" prefix stripped).
- **`langlinks`**: links to parallel Wiktionary editions in other languages.
- **`info`**: page-level metadata — `touched` (last edit timestamp), `length` (wikitext byte count), `pageid`, `lastrevid` (revision ID).

**Rationale:** the English Wiktionary is used as the canonical parsing surface even for Greek entries. Structured categories and metadata are extracted from the API directly — this is far more reliable than trying to parse them from wikitext headings or prose.

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
schema_version: "2.1.0"
rawLanguageBlock: "==Greek==..."
entries: [...]
notes: [...]
debug: [...]      # optional; present when debugDecoders=true
metadata:          # page-level data from the API
  categories: [...]
  langlinks: [...]
  info: { last_modified, length, pageid }
```

- `schema_version` (required): Semantic version of the output schema, from
  `SCHEMA_VERSION` in `src/types.ts`. Current value is `"2.1.0"`.
- `debug` (optional): When `fetchWiktionary({ debugDecoders: true })` is used,
  `debug[i]` is an array of `DecoderDebugEvent` for `entries[i]`, listing which
  decoder matched which templates and what fields it produced.
- `metadata` (optional): Page-level data fetched alongside the wikitext
  (categories, langlinks, page info). Separate from per-entry `categories` and
  `langlinks` which are filtered by language section.

Each `Entry` contains:

| Field | Type | Source |
|-------|------|--------|
| `id` | string | Generated from lang, title, etymology index, POS heading, entry type |
| `language` | WikiLang | Input parameter |
| `query` | string | Input parameter |
| `type` | `LEXEME \| INFLECTED_FORM \| FORM_OF` | Determined by presence of form-of templates |
| `form` | string | Page title |
| `etymology_index` | integer | Parsed from `===Etymology N===` headings |
| `part_of_speech_heading` | string | Verbatim POS section heading |
| `part_of_speech` | string? | From headword templates (`el-verb`, etc.) or heading mapping |
| `pronunciation` | `Pronunciation` | From `{{IPA}}`, `{{el-IPA}}`, `{{audio}}`, `{{rhymes}}`, `{{homophones}}` |
| `hyphenation` | `{syllables?, raw}` | From `{{hyphenation}}` |
| `senses` | `Sense[]` | From `#` / `##` / `#:` lines; includes `qualifier`, `labels`, `topics` |
| `semantic_relations` | `SemanticRelations` | From `{{syn}}`, `{{ant}}`, `{{hyper}}`, `{{hypo}}`, `{{cot}}`, `{{hol}}`, `{{mer}}`, `{{tro}}` |
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
| `lemma_triggered_by_entry_id` | string? | Entry id that triggered lemma resolution |
| `categories` | `string[]` | API categories filtered by language section |
| `langlinks` | `Array<{lang, title}>` | Interwiki links to other Wiktionary editions |
| `page_links` | `string[]` | Internal wikilinks extracted from the page |
| `external_links` | `string[]` | External HTTP links extracted from the page |
| `instance_of` | `string[]` | Wikidata QIDs for "instance of" (P31) |
| `subclass_of` | `string[]` | Wikidata QIDs for "subclass of" (P279) |
| `metadata` | `{last_modified?, length?, pageid?}` | Page-level API metadata |
| `wikidata` | `WikidataEnrichment` | Optional QID, labels, descriptions, sitelinks, media |
| `source` | `{wiktionary: WiktionarySource}` | Full traceability metadata |

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
- `topics` (optional): topic domains from `{{lb|...}}` (e.g. `["law", "art"]`). Wiktionary uses a shared label-tag system; the decoder separates stylistic labels from topic labels heuristically.
- Stripping is **brace-aware**: `[[link|display]]` → display, `[[link]]` → link; nested `{{...}}` removed correctly; no regex-induced duplication.

### 3.4 Semantic relations

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
```

| Field | Template | Notes |
|-------|----------|-------|
| `synonyms` | `{{syn}}` | |
| `antonyms` | `{{ant}}` | |
| `hypernyms` | `{{hyper}}` | |
| `hyponyms` | `{{hypo}}` | |
| `coordinate_terms` | `{{cot}}` | Peers at the same level (e.g. days of the week) |
| `holonyms` | `{{hol}}` | Wholes that contain this term as a part |
| `meronyms` | `{{mer}}` | Parts that make up this term |
| `troponyms` | `{{tro}}` | Manner-of-action subtypes (e.g. "sprint" for "run") |

All share the same shape: `term` (required), `qualifier?` from `q=` named param, `sense_id?` from `sense=`.

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

### 3.5d Form-of labels

For inflected entries, `form_of.label` provides a human-readable description:

```yaml
form_of:
  template: inflection of
  lemma: γράφω
  lang: el
  tags: ["1", "s", "perf", "past", "actv", "indc"]
  label: "1st pers. singular perfective past active indicative"
```

The `label` is composed from a `TAG_LABEL_MAP` dictionary mapping standard Wiktionary tags to English descriptors (e.g. `"1"` → `"1st pers."`, `"s"` → `"singular"`, `"perf"` → `"perfective"`).

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

The output shape is formalized in `schema/normalized-entry.schema.json` (JSON Schema draft-07). The current schema version is **`2.1.0`** (a major bump from 1.x, with v2.1 adding high-fidelity "buried data" extraction). The version follows Semantic Versioning and is documented in `VERSIONING.md`. A `SCHEMA_VERSION` constant is exported from `src/types.ts`.

Human-readable schema examples are in `docs/schemata/`:
- `verb-lemma.yaml`: annotated example for a verb lemma entry.
- `verb-non-lemma.yaml`: annotated example for an inflected verb form.
- `DictionaryEntry — proposed v2 schema.yaml`: comprehensive annotated field inventory with implementation status notes.

### 3.9 Convenience API & High-Level Wrappers

The SDK provides a high-level functional layer above the raw `FetchResult` to simplify common lexicographical queries. High-level structures like **`RichEntry`** and **`InflectionTable`** provide an aggregate view of a term.

#### 3.9.1 `RichEntry` (The Aggregate Profile)
A `RichEntry` is a comprehensive, flattened representation of a linguistic term, combining lemma-level metadata with its full inflectional and semantic profile. It is the primary return type for `richEntry()`.

#### 3.9.2 `InflectionTable` (The Structured Paradigm)
An `InflectionTable` is a hierarchical representation of a grammatical paradigm (e.g., all forms of a verb across mood, tense, and voice). It is returned by `conjugate()` and `decline()` when called in "full-table" mode (empty criteria).

| Wrapper | Return type | Notes |
|---------|-------------|-------|
| `lemma(q, l)` | `string` | Resolves inflections to canonical lemma. |
| `ipa(q, l)` | `string\|null` | Primary IPA transcription. |
| `pronounce(q, l)` | `string\|null` | Audio URL (prefers `audio_url`, falls back to filename or IPA). |
| `hyphenate(q, l, opts)` | `string[]\|string\|null` | Syllable list or joined string. |
| `synonyms(q, l)` | `string[]` | Synonyms list. |
| `antonyms(q, l)` | `string[]` | Antonyms list. |
| `hypernyms(q, l)` | `string[]` | Hypernyms. |
| `hyponyms(q, l)` | `string[]` | Hyponyms. |
| `translate(q, l, t)` | `string[]` | Gloss-mode translation. |
| `etymology(q, l)` | `EtymologyStep[]` | Structured lineage (reads `chain` with `links` fallback). |
| `partOfSpeech(q, l)` | `string\|null` | Normalized POS tag. |
| `conjugate(q, l, c)` | `string[]\|Record\|null` | Full paradigm or targeted cell. |
| `decline(q, l, c)` | `string[]\|Record\|null` | Full declension or targeted cell. |
| `morphology(q, l)` | `GrammarTraits` | Inherent grammatical traits. |
| `richEntry(q, l)` | `RichEntry` | Aggregate high-fidelity object. |
| `stem(q, l)` | `WordStems` | Logical stems from templates. |

**New in v2** (morphology, etymology, metadata, sections):

| Wrapper | Return type | Notes |
|---------|-------------|-------|
| `principalParts(q, l)` | `Record<string,string>\|null` | Verb paradigm slots from headword template params. |
| `gender(q, l)` | `"masculine"\|"feminine"\|"neuter"\|null` | Noun/adj grammatical gender. |
| `transitivity(q, l)` | `"transitive"\|"intransitive"\|"both"\|null` | Verb transitivity. |
| `alternativeForms(q, l)` | `Array<{term, qualifier?}>` | From `====Alternative forms====`. |
| `seeAlso(q, l)` | `string[]` | From `====See also====`. |
| `anagrams(q, l)` | `string[]` | From `====Anagrams====`. |
| `usageNotes(q, l)` | `string[]` | From `===Usage notes===`. |
| `derivedTerms(q, l)` | `SectionLinkItem[]` | From `====Derived terms====`. |
| `relatedTerms(q, l)` | `SectionLinkItem[]` | From `====Related terms====`. |
| `descendants(q, l)` | `SectionLinkItem[]` | From `====Descendants====`. |
| `referencesSection(q, l)` | `string[]` | From `====References====`. |
| `etymologyChain(q, l)` | `EtymologyLink[]` | Ancestor chain (inherited/borrowed/derived). |
| `etymologyCognates(q, l)` | `EtymologyLink[]` | Cognate list from `{{cog}}`. |
| `etymologyText(q, l)` | `string\|null` | Raw prose text of the etymology section. |
| `categories(q, l)` | `string[]` | Language-filtered page categories. |
| `langlinks(q, l)` | `Array<{lang,title}>` | Links to other Wiktionary editions (`interwiki` is an alias). |
| `isCategory(q, cat, l)` | `boolean` | Checks if `cat` appears in the categories list. |
| `pageMetadata(q, l)` | `object` | Raw page info (`last_modified`, `length`, `pageid`). |
| `inflectionTableRef(q, l)` | `{template_name, raw}\|null` | Name of the conjugation/declension template. |
| `audioGallery(q, l)` | `AudioDetail[]` | Full list of audio files with URLs and labels. |
| `audioDetails(q, l)` | `AudioDetail[]` | Alias for `audioGallery` (deprecated). |
| `exampleDetails(q, l)` | `Example[]` | Structured usage examples with translations. |
| `citations(q, l)` | `Example[]` | Literary citations extracted from `{{quote-book}}` etc. |
| `isInstance(q, qid, l)` | `boolean` | Checks if entry belongs to Wikidata instance `qid`. |
| `isSubclass(q, qid, l)` | `boolean` | Checks if entry belongs to Wikidata subclass `qid`. |
| `wikipediaLink(q, l)` | `string\|null` | Direct link to the corresponding Wikipedia article. |
| `internalLinks(q, l)` | `string[]` | List of internal wikilinks on the page. |
| `externalLinks(q, l)` | `string[]` | List of external HTTP links on the page. |

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
- **Auto-discovery (`lang="Auto"`)**: When no language is specified, the engine scans the entire page for level-2 headings (`==...==`) and extracts all sections matching the internal language map.
- **Priority-Based Sorting**: Discovered entries are sorted by linguistic significance:
  1. **Greek (`el`)** (Primary target)
  2. **Ancient Greek (`grc`)**
  3. **English (`en`)**
  4. Others (Alphabetical)
- **Unknown language codes:** If `lang` is specified but not found in the mapping, `fetchWiktionary()` returns early with `empty entries`.

### 4.2 Etymology and PoS segmentation

- **Robust Heading Detection**: Split on symmetrical level-3 to level-5 headings (e.g., `===Etymology===`, `====Verb====`, `=====Noun=====`).
- **Nesting Support**: Correctly identifies PoS blocks nested under Etymology or other H3 headers.
- **Whitespace Sanitation**: Trims all headings and block content to prevent parsing artifacts.

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

**Current decoder families (v2):**

1. **Raw storage** (`store-raw-templates`): runs on every context; stores all templates verbatim.
2. **Pronunciation** (extended): `ipa`, `el-ipa`, `audio` (now also resolves `audio_url`), `hyphenation`, `rhymes`, `homophones`, `romanization`.
3. **Headword / POS**: `el-verb-head`, `el-noun-head`, `el-adj-head`, `el-adv-head`, `el-pron-head`, `el-numeral-head`, `el-participle-head`, `el-art-head`, **`nl-noun-head`**, **`nl-verb-head`**, **`nl-adj-head`**, **`de-noun-head`**, **`de-verb-head`**, **`de-adj-head`**.
4. **Headword morphology** (new): `el-verb-morphology` (extracts `transitivity`, `principal_parts` from `{{el-verb}}` params); `el-noun-gender` (extracts `gender` from `{{el-noun}}`); **`nl-noun-head`** (extracts `gender` from `{{nl-noun}}`); **`de-noun-head`** (extracts `gender` from `{{de-noun}}`).
5. **Form-of** (extended): detects `inflection of`, `infl of`, `form of`, `alternative form of`, and 7 other form-of templates; now produces a human-readable `label` from the `tags` array via `TAG_LABEL_MAP`. **New:** Distinguishes between `INFLECTED_FORM` and `FORM_OF` based on template semantics (variants/abbreviations vs. grammatical inflections).
6. **Translations**: parses `====Translations====` sections for `t`, `t+`, `tt`, `tt+`, `t-simple`.
7. **Senses**: parses `#` / `##` / `#:` lines; now extracts `qualifier` from parenthetical text and `labels`/`topics` from `{{lb|...}}` templates on definition lines.
8. **Semantic relations**: `syn`, `ant`, `hyper`, `hypo`, and now also `cot` (coordinate terms), `hol` (holonyms), `mer` (meronyms), `tro` (troponyms).
9. **Etymology v2**: produces `chain[]` (from `inh`, `der`, `bor`) and `cognates[]` (from `cog`) as separate arrays; now supports compositional templates like **`affix`**, **`compound`**, **`back-formation`**, and **`clipping`**.
10. **Usage notes**: extracts `===Usage notes===` section text.
11. **References** (new): extracts `====References====` section text into `entry.references[]`.
12. **Alternative forms** (new): parses `====Alternative forms====` section for `{{l}}`/`{{link}}` templates into `entry.alternative_forms[]`.
13. **See also** (new): parses `====See also====` section into `entry.see_also[]`.
14. **Anagrams** (new): parses `====Anagrams====` section for `{{l}}` templates into `entry.anagrams[]`.
15. **Inflection table reference** (new): captures the raw inflection template call (e.g. `{{el-conj-γράφω}}`) into `entry.inflection_table_ref`.
16. **Section links**: parses `====Derived terms====`, `====Related terms====`, `====Descendants====` for `{{l}}` and `{{link}}` templates; stores both `raw_text` and structured `items`.

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

### 12.12 API Enrichment: Structured Metadata Over Wikitext Parsing
From v2.0, the API call is extended to fetch `categories`, `langlinks`, and `info` alongside the Wikitext revision. **Rationale:** fetching these fields from the structured MediaWiki API is more reliable than parsing them from Wikitext (e.g., categories appear in Wikitext as `[[Category:...]]` entries scattered throughout, and are easily missed). The API also returns the revision ID and last-modified timestamp in the same request at no extra cost, enabling consumers to implement cache invalidation by revision.

**Design choice:** categories are filtered per language entry (entries only see categories relevant to their language section) using a heuristic that strips generic "Pages with..." administrative categories. The raw unfiltered list is available in `FetchResult.metadata.categories`.

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

**Partial `vi.mock("../src/index")` caveat:** replacing only the exported `wiktionary` with `vi.fn()` does not reliably replace the `wiktionary` binding inside `library.ts` (circular module graph with `importOriginal`). Helpers such as `lemma()`, `interwiki()`, `pageMetadata()`, and `stem()` may still invoke the **real** fetch path unless `api` is stubbed. **Design choice:** document this in `test/README.md` and `AGENTS.md` so new tests do not reintroduce live `en.wiktionary.org` calls or reliance on the in-memory cache to mask them.

### 12.18 Quality gates: goldens, decoder coverage, parser invariants
These are **verification artifacts**, not part of the runtime contract:

- **Golden snapshots** (`test/golden/entry-snapshots.test.ts`): fixture wikitext + mocked API → real `wiktionary()` → stable projection of LEXEME / INFLECTED_FORM fields compared to committed `.snap` files. **Rationale:** catches unintended decoder or merge regressions without asserting full AST dumps.
- **Decoder coverage** (`test/decoder-coverage.test.ts`): each registry decoder `id` must appear in the `test/` corpus (template names in fixtures, or explicit allowlist with rationale). **Rationale:** new decoders are not silently untested.
- **Parser invariants** (`test/parser.invariants.test.ts`): structural checks on `parseTemplates(wikitext, true)` (raw slice equals source span, non-overlapping regions, nesting). **Rationale:** guards the brace-aware parser independent of linguistic content.

### 12.19 Convenience aliases (`phonetic`, `derivations`)

The SDK provides several aliases for common linguistic operations to improve DevX. For example, `phonetic()` is an alias for the primary `pronounce()` result, and `derivations()` aggregates results from `derivedTerms()` and `etymologyChain()` into a combined view.

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

---

**Artifacts:**
- `src/index.ts`: Orchestration entry point.
- `src/types.ts`: Canonical type definitions.
- `docs/EXHAUSTIVE_TYPOGRAPHIC_SPECIMEN.html`: The typographic gold standard.
- `docs/TEXT_TO_DICTIONARY_PLAN.md`: Future architecture for text analysis.
- `schema/normalized-entry.schema.json`: Formal output schema (v2.1.0).
- `docs/dictionary-entry-v2.yaml`: Canonical machine-readable specimen.
- `webapp/src/App.tsx`: React frontend with inspector, comparison mode, and CLI playground.
- `webapp/src/index.css`: Dual-theme stylesheet (light dictionary + dark inspector).
- `cli/index.ts`: CLI tool with `--extract`, `--props`, `--format ansi`.
- `server.ts`: HTTP API wrapper.
- This specification document.

## 13. Post-v1.0 roadmap (non-normative)

This section is informational only. For the detailed staged plan, see `docs/ROADMAP.md`.

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
- **API Aliases**: `phonetic()` is an alias for `ipa()`. `derivations()` is an alias for
  `derivedTerms()` (same signature; returns `derived_terms.items`, typically `{ term, … }[]`).

**Completed (v1.4 Auto-discovery & PoS Filtering):**

- **Auto-discovery Mode**: Implemented `lang="Auto"` as the default, enabling the SDK to scan
  and aggregate entries across all language sections found on a page.
- **Language Priority Engine**: Introduced a `LANG_PRIORITY` map to ensure results are 
  consistently sorted (Greek > Ancient Greek > English).
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
  fetch. `FetchResult.metadata` now exposes all three. Per-entry `categories` and `langlinks`
  are filtered by language section; `source.wiktionary.revision_id`, `last_modified`, and
  `pageid` provide full audit provenance.
- **Schema bump to v2.0.0**: Major version increment reflecting structural changes to
  `EtymologyData`, `SemanticRelations`, `Sense`, `Pronunciation`, `Entry`, and `FetchResult`.
  JSON Schema (`schema/normalized-entry.schema.json`) updated throughout.
- **Etymology restructure**: `etymology.links` split into `chain[]` (ancestors) and
  `cognates[]` (lateral cognates), each with an explicit `relation` field. `raw_text` preserves
  the full etymology prose preamble.
- **Headword morphology**: New `headword_morphology` field on `Entry` with `transitivity`,
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
