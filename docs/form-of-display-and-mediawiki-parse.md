# Form-of entries: Wiktionary’s split between wikitext, Lua, and SDK display

This document explains **why** English Wiktionary form-of entries are awkward for a wikitext-only pipeline, **what** the SDK does about it (including an explicit exception to “wikitext only” for *display lines*), **what we refuse to do**, and **how** that maps to code and schema. It is normative for maintainers and AI agents alongside `AGENTS.md` and `docs/wiktionary-sdk-spec.md`.

---

## 1. The core tension

**Stated mission (AGENTS):** *source-faithful extraction* — we do not guess morphology or invent parameters that are not in the page.

**Reality on en.wiktionary:** many “inflection gloss” strings that readers see **never appear** as extra `##` definition sub-bullets or as template positionals. They are produced at **render time** by **Lua modules** invoked from a **single** definition line.

So we have three layers:

| Layer | What it is | Example (Spanish “sense”) |
|--------|------------|---------------------------|
| **A. Wikitext** | What `action=query` returns in `revisions[].slots.main.content` | One line: `# {{es-verb form of\|sensar}}` |
| **B. Structured wikitext** | What our brace-aware parser + decoders see | One sense; `form_of.lemma = sensar`, `form_of.tags = []`, optional `gloss` from template-only gloss expansion |
| **C. Rendered HTML** | What MediaWiki outputs when the template runs | Nested lists: “first/third-person singular present subjunctive”, “third-person singular imperative”, etc. |

The SDK historically operated on **A → B**. Users comparing our cards to the **website** were comparing **B** to **C**. For stub sections where **A** contains **no** `##` lines and **no** tag positionals, **B** cannot carry the per-form glosses **without** either giving up those lines or taking **C** into account in a controlled way.

---

## 2. Exemplar case: Spanish `sense` → `{{es-verb form of|sensar}}`

### 2.1 Actual en.wiktionary wikitext (verbatim structure)

The Spanish verb subsection for [[sense]] is minimal:

```wikitext
==Spanish==

===Verb===
{{head|es|verb form}}

# {{es-verb form of|sensar}}
```

There are **no** `##` sub-definition lines under that `#` line.

### 2.2 What the site shows (conceptually)

Readers see something equivalent to:

- **Verb** — **sense**
  - *inflection of sensar:*
    - first/third-person singular present subjunctive  
    - third-person singular imperative  

That prose is **not** copied from extra wikitext bullets; it is emitted by **`Template:es-verb form of`** → `#invoke:es-inflections|verb_form_of`, which compares the **page title** (“sense”) to the **lemma’s** paradigm.

### 2.3 What the decoder can extract from wikitext alone

From `{{es-verb form of|sensar}}` the `form-of` decoder correctly gets:

- `template: "es-verb form of"`
- `lemma: "sensar"`
- `lang: "es"` (from template name)
- `tags: []` (no further positionals)
- `label: "Verb form"` (from template kind — **no** morph detail)

So **`form_of` is correct for lemma resolution and high-level kind**, but **empty tags** mean there is **no** machine-readable list of morph lines in the normalized object **until** we add another source (below).

### 2.4 Why `##` parsing does not save us here

`parseSenses` in `registry.ts` attaches **subsenses** only to lines matching:

```text
## …
```

under an existing `#` sense. Spanish stub uses a **single** `#` line with only the template. Therefore **`senses[0].subsenses` is absent** — not a parser bug, but a faithful reflection of the source.

---

## 3. Other problematic shapes (same family, different symptoms)

### 3.1 Short **tag** positionals (`voc`, `m`, `s`)

Some templates pass **abbreviated** morphology as **multiple** positionals (e.g. Latin participle lines). Feeding each positional as a separate “morph line” produced silly bullets (`voc` / `m` / `s`).

**Response:** treat **all-known-abbrev** runs as **one inline phrase** (“vocative singular”) via `parseMorphologyTags` + display rules in `formatter.ts`; push **gender** to the noun PoS line (`masc.` / `fem.` / `neut.`) instead of bullets.

### 3.2 Prose **subsenses** (e.g. Spanish-style when `##` *does* exist)

When editors **do** add `##` lines, those strings are **first-class** wikitext; we prefer them over everything else for morph bullets.

### 3.3 Single morph token (`ing-form`)

One subsense or one tag string like `ing-form` should stay **inline** with the surface (`writing **ing-form** of:`), not a one-item bullet list.

### 3.4 `{{plural of|…}}` and similar

Parse expansion often yields a **single** gloss paragraph **without** nested `<ol><ol><li>…</li></ol></ol>`. Our HTML extractor finds **no** nested lines; we **do not** fabricate morph lines. An extra `action=parse` may run for allowlisted templates but leaves `display_morph_lines` unset when extraction is empty.

---

## 4. Rationale for **MediaWiki `action=parse` enrichment**

### 4.1 What it is

When `enrich !== false` (default), after building lexemes we may call:

- `action=parse`
- `title=<page title>` (e.g. `sense` — **required** so Lua knows the surface form)
- `text=<verbatim sense `gloss_raw` wikitext>` (typically the same template call as on the page)

We read **only** a **narrow** DOM pattern: **`ol ol > li`** text nodes in the parser output. That mirrors the nested list structure produced by form-of Lua for many **`{{xx-verb|noun|adj form of}}`** templates.

Results are stored as:

```yaml
form_of:
  display_morph_lines: ["first-person singular present subjunctive", ...]
  display_morph_lines_source: mediawiki_parse
```

`inflectionMorphDisplayLines()` in `formatter.ts` consumes these **after** real `##` subsenses and **before** positional `tags`, then applies the same `first/third-person …` line expansion as for wikitext subsenses.

### 4.2 Why this is **not** “scraping Wiktionary HTML” in the forbidden sense

`AGENTS.md` forbids scraping **article HTML** from the public site (fragile, SEO, different from API contract).

Here we:

- Use the **documented** MediaWiki API (`action=parse`) — the same class of call already used in `src/morphology.ts` to expand conjugation/declension templates and scrape **table cells** from returned HTML.
- Send **wikitext we already hold** (`gloss_raw`) plus the **correct title** for module context.
- Extract **structure** (nested list items), not arbitrary painted layout.

So: **API-driven expansion of known wikitext**, not **GET /wiki/Title** parsing.

### 4.3 Traceability

- `display_morph_lines_source: "mediawiki_parse"` marks provenance.
- `sense.gloss_raw` remains the **exact** definition-line wikitext that was parsed.
- We do **not** claim those strings appeared as separate wikitext bullets; they are **module output** serialized into our model for display and downstream formatting.

### 4.4 Scope gate (which templates)

We do **not** parse-expand **every** form-of template on the wiki (would spam the API and mostly return empty nested lists).

**Included:** any template name matching **`isPerLangFormOfTemplate()`** in `registry.ts`:

```text
^[a-z]{2,3}-(?:verb|noun|adj)\s+form\s+of$
```

So **all** language codes (2–3 letters) for **verb / noun / adjective** per-lang form-of names on en.wiktionary.

**Further gate:** enrichment runs only when, **before** parse, we would show **no** morph lines from `##` subsenses, **no** abbrev-only inline phrase, and **no** tag-derived lines (`lexemeNeedsFormOfParseEnrichment` in `form-of-parse-enrich.ts`).

---

## 5. Formatter behaviour (summary)

Implemented in `src/formatter.ts` + Handlebars (`entry.html.hbs`):

1. **Abbrev-only** tag runs → **inline** phrase + `of:` (no `<ul>`).
2. **≥ 2** morph lines (from subsenses, `display_morph_lines`, or expanded tags) → **bullet list** + `of:` + lemma row.
3. **Exactly 1** morph line → **inline** with surface (e.g. `ing-form`).
4. **None** → **compact** row with lowercased `form_of.label` + `of:` (e.g. `plural of`).
5. **`first/third-person …`** strings → split into two display lines (en.wiktionary convention).

Lemma vs PoS spacing uses CSS adjacent-sibling rules because Handlebars `~` often removes literal spaces between `<span class="lemma">` and `<span class="pos">`.

---

## 6. What we **do not** do (explicit)

| Anti-pattern | Reason |
|--------------|--------|
| Guess Spanish (or any) inflection from the lemma alone | Violates “no linguistic inference”; Lua already did the work — we either surface **API-expanded** output or leave fields empty. |
| Scrape `/wiki/Title` HTML | Fragile, not API-contractual; forbidden by project rules. |
| Call `parse` for **every** lexeme on every page | Rate limits + noise; we allowlist per-lang `verb|noun|adj form of` and only when wikitext morph is empty. |
| Treat `action=parse` output as **lemma** or **POS** facts without wikitext | We only take **list-item text** for **morph gloss lines**; lemma still comes from template parameters. |
| Conflate this with **Wikidata** | Wikidata is QID/claims enrichment; this is **Wiktionary parser output** from wikitext. |

---

## 7. Code map

| Piece | Role |
|--------|------|
| `src/form-of-parse-enrich.ts` | Gate, `action=parse`, `ol ol > li` extraction, merge into `form_of.display_morph_lines` |
| `src/index.ts` | Runs batch enrichment when `enrich` is true, after lexemes built, before lemma resolution |
| `src/formatter.ts` | `inflectionMorphDisplayLines`, bullets vs inline, abbrev phrase, `expandDualPersonInflectionLine` |
| `src/decode/registry.ts` | `form_of` decoder, `isPerLangFormOfTemplate`, `##` subsenses |
| `schema/normalized-entry.schema.json` | `FormOf.display_morph_lines`, `display_morph_lines_source` |
| `test/form-of-parse-enrich.test.ts` | HTML fixture for extractor; template-name gate |

---

## 8. Operational notes

- **Default `enrich: true`:** playground and most callers get morph lines; set `enrich: false` to skip extra parse calls (and Wikidata enrichment).
- **Rate limiting:** parse calls go through `mwFetchJson` / rate limiter like other Wiktionary API traffic.
- **Regression test:** live `wiktionary({ query: "sense", lang: "es", pos: "verb" })` should populate `display_morph_lines` with three strings after `first/third-person` expansion (manual or scripted check).

---

## 9. Related reading

- `AGENTS.md` — mission, “no scraping” nuance (parse API exception for template expansion), hyphenation / stub sections.
- `docs/wiktionary-sdk-spec.md` — §3.5d form-of, decoder pipeline.
- `docs/query-result-dimensional-matrix.md` — how this case fits the full cross-product of query results (languages, PoS, etymologies, …).
- `src/morphology.ts` — precedent: `action=parse` + HTML parse for Greek paradigm tables.

This document should be updated when:

- New form-of families routinely emit different HTML shapes (adjust selector or gate).
- Policy changes on parse API usage (document here and in AGENTS).
