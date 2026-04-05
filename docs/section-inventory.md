# Section inventory (en.wiktionary MoS headings)

This document cross-references **typical English Wiktionary section titles** with:

1. **[wiktionary-scraper](https://github.com/LearnRomanian/wiktionary-scraper)** — keys from [`src/constants/sections/english.ts`](https://github.com/LearnRomanian/wiktionary-scraper/blob/main/src/constants/sections/english.ts) (after `reverseObject`: **display heading → internal key**), plus the [README “Section support”](https://github.com/LearnRomanian/wiktionary-scraper?tab=readme-ov-file) list (Relations there omits **Descendants** and **Collocations**; both exist in `english.ts` and are included below).
2. **This SDK** — structured field / decoder family, or gap.

**Status**

| Value | Meaning |
|-------|---------|
| **supported** | Heading (or equivalent content path) is decoded into a dedicated `Lexeme` field or relation bucket. |
| **partial** | Some content may appear indirectly (e.g. under senses, morphology, or API metadata) but there is no full section-level or template-complete decode. |
| **unsupported** | No dedicated extraction; content may only live in raw wikitext / `templates` / unparsed prose. |

Headings are matched with **brace-tolerant** `====…====` logic where a decoder exists (`src/registry/section-extract.ts`), not a brittle `==Title==` substring.

---

## A. Headings aligned with wiktionary-scraper `english.ts`

| Wiktionary heading | Scraper key | Status | SDK mapping / notes |
|--------------------|-------------|--------|---------------------|
| Description | `description` | unsupported | No `Lexeme` field; language preamble / prose stays in raw block. |
| Glyph origin | `glyphOrigin` | unsupported | No structured field (CJK / glyph entries). |
| Etymology | `etymology` | supported | `Lexeme.etymology` — `registerEtymology`. |
| Pronunciation | `pronunciation` | supported | `Lexeme.pronunciation` — `registerCoreAndPronunciation`, `registerPronunciationExtra`. |
| Production | `production` | unsupported | — |
| Usage notes | `usageNotes` | supported | `Lexeme.usage_notes` — `usage-notes` decoder (`====Usage notes====`). |
| Reconstruction notes | `reconstructionNotes` | unsupported | — |
| Inflection | `inflection` | partial | `headword_morphology`, `inflection_table_ref`; no dedicated “Inflection” section blob. |
| Conjugation | `conjugation` | partial | Inflection template ref + `morphology.ts` expansion; not full wikitext section capture. |
| Declension | `declension` | partial | Same as conjugation for nominal paradigms. |
| Mutation | `mutation` | unsupported | (e.g. Celtic initial mutation sections.) |
| Quotations | `quotations` | partial | No `====Quotations====` slice; quotes may surface in `Sense.examples` when on definition lines / templates. |
| Alternative forms | `alternativeForms` | supported | `Lexeme.alternative_forms` — `alternative-forms`. |
| Alternative reconstructions | `alternativeReconstructions` | unsupported | — |
| Synonyms | `synonyms` | supported | `semantic_relations.synonyms` — `{{syn|…}}` + `====Synonyms====` (`semantic-relations`). |
| Antonyms | `antonyms` | supported | `{{ant|…}}` + `====Antonyms====`. |
| Hypernyms | `hypernyms` | supported | `{{hyper|…}}` + `====Hypernyms====`. |
| Hyponyms | `hyponyms` | supported | `{{hypo|…}}` + `====Hyponyms====`. |
| Meronyms | `meronyms` | supported | `====Meronyms====` — list lines via `{{l}}` / `{{link}}`. |
| Holonyms | `holonyms` | supported | `====Holonyms====` — same. |
| Comeronyms | `comeronyms` | supported | `====Comeronyms====` — same. |
| Troponyms | `troponyms` | supported | `====Troponyms====` — same. |
| Parasynonyms | `parasynonyms` | supported | `====Parasynonyms====` — same. |
| Coordinate terms | `coordinate` | supported | `semantic_relations.coordinate_terms` — `====Coordinate terms====`. |
| Derived terms | `derived` | supported | `Lexeme.derived_terms` — `section-links`. |
| Related terms | `related` | supported | `Lexeme.related_terms` — `section-links`. |
| Collocations | `collocations` | supported | `semantic_relations.collocations` — `====Collocations====`. |
| Descendants | `descendants` | supported | `Lexeme.descendants` — `section-links`. |
| Translations | `translations` | supported | `Lexeme.translations` — `registerTranslations`. |
| Trivia | `trivia` | unsupported | — |
| See also | `seeAlso` | supported | `Lexeme.see_also` — `see-also`. |
| References | `references` | supported | `Lexeme.references` — `references`. |
| Further reading | `furtherReading` | unsupported | — |
| Anagrams | `anagrams` | supported | `Lexeme.anagrams` — `anagrams`. |
| Definitions | `definitions` | partial | Wiktionary uses `===Part of speech===` + `#` lines, not usually `===Definitions===`. Parsed as `Lexeme.senses` — `registerSenses`. |
| Examples | `examples` | partial | Primarily `#:` and example templates under senses; rare standalone `====Examples====` not targeted. |

**Inline template gap (relations):** `coordinate_terms`, `holonyms`, `meronyms`, and `troponyms` are filled from **section lists**. `{{cot}}`, `{{hol}}`, `{{mer}}`, and `{{tro}}` are **not** yet in `RELATION_TEMPLATES` (unlike `{{syn}}` / `{{ant}}` / `{{hyper}}` / `{{hypo}}`).

**Lexeme boundaries:** Most rows apply within each lexeme slice (language + etymology + PoS heading). See `src/lexicographic-headings.ts` for which headings open a lexeme vs. metadata-only blocks.

---

## B. Common MoS headings *not* in wiktionary-scraper `english.ts`

Use this block as a backlog for headings that appear on en.wiktionary but are absent from the scraper’s `english.ts` map.

| Wiktionary heading | Scraper key | Status | SDK mapping / notes |
|--------------------|-------------|--------|---------------------|
| Notes | — | supported | Treated like Usage notes: `usage-notes` decoder matches `Usage notes` **or** `Notes`. |
| Statistics | — | unsupported | Optional lemma statistics (word frequency, etc.). |
| Derived characters | — | unsupported | Common under Han/CJK entries. |
| Compounds | — | unsupported | Sometimes `====Compounds====` or “Compounded words”; not `derived_terms`. |
| Compound words | — | unsupported | Variant heading for compound lemmas. |
| **Citations** (dedicated section) | — | partial | No section decoder; `{{quote}}`-style content may appear in `Sense.examples`. Library `citations()` filters those examples only. |
| Gallery | — | partial | File lists often come from API `prop=images` / enrichment, not a parsed `====Gallery====` section. |
| Map | — | unsupported | Dialect maps and similar. |

Rare spelling variants of headings already covered in **§A** (e.g. singular “Coordinate term”) should extend the same decoder’s `matches` / heading list rather than new `Lexeme` fields.

---

## C. Extension checklist (future work)

Tick items off as decoders, types, schema, and templates gain parity.

### Unsupported section-level extraction

- [ ] **Description** — optional `Lexeme` field or raw section blob under language/PoS context.
- [ ] **Glyph origin** — structured CJK glyph story (traceable to section wikitext).
- [ ] **Production** — how a sign is produced (e.g. sign-language entries).
- [ ] **Reconstruction notes** — parallel to usage notes for reconstructions.
- [ ] **Mutation** — language-specific mutation rules section.
- [ ] **Alternative reconstructions** — list + gloss pattern (mirror **Alternative forms** where appropriate).
- [ ] **Trivia** — section text or structured bullets.
- [ ] **Further reading** — wikilinks / bibliography lines (distinct from **References**).
- [ ] **Statistics** — optional frequency / scrabble / letter-count blocks.
- [ ] **Derived characters** — Han-derived character lists.
- [ ] **Compounds** / **Compound words** — compound lemma sections (if distinct from derived/related).
- [ ] **Map** — dialect or geographic map sections.

### Partial → stronger parity

- [ ] **Inflection** — retain raw section text and/or unify with `inflection_table_ref` + expanded tables.
- [ ] **Conjugation** / **Declension** — full section fidelity beyond template ref + `morphology.ts` paths.
- [ ] **Quotations** — dedicated `====Quotations====` (and long quotation blocks not on `#` lines).
- [ ] **Definitions** — if editors use a literal Definitions header in non-standard layouts, normalize into senses or store raw.
- [ ] **Examples** — standalone `====Examples====` when not expressed as `#:` under a sense.
- [ ] **Citations** — first-class section model aligned with `Sense.examples` / quote templates.
- [ ] **Gallery** — explicit section parse in addition to API image lists.
- [ ] **Relations** — add `{{cot}}`, `{{hol}}`, `{{mer}}`, `{{tro}}` to `RELATION_TEMPLATES` with the same parameter conventions as `{{syn}}` (corpus tests + schema unchanged shape).

### Cross-cutting

- [ ] **Template coverage audit** — for each supported section, enumerate high-frequency templates in the wild still stored only under `templates` / verbatim wikitext.
- [ ] **Section inventory ↔ registry** — keep this file in sync when adding `extractSectionByLevelHeaders` callers in `src/registry/register-*.ts`.
