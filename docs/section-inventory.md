# Section inventory (en.wiktionary MoS headings)

This document cross-references **typical English Wiktionary section titles** with:

1. **`wiktionary-scraper`** — keys from [`src/constants/sections/english.ts`](https://github.com/LearnRomanian/wiktionary-scraper/blob/main/src/constants/sections/english.ts) (after that module’s `reverseObject`, the map is **display heading → internal key**).
2. **This SDK** — where the same heading is decoded today (`Lexeme` field, decoder family, or “not yet”).

Headings are matched in wikitext with the same **brace-tolerant** `====…====` logic as other section decoders (variable `=` count), not a fragile substring on `==Title==`.

| Wiktionary heading | Scraper key | SDK mapping |
|--------------------|-------------|-------------|
| Description | `description` | Not a dedicated field; prose may appear in language preamble / unparsed wikitext. |
| Glyph origin | `glyphOrigin` | Not extracted as structured data. |
| Etymology | `etymology` | `Lexeme.etymology` (`registerEtymology`). |
| Pronunciation | `pronunciation` | `Lexeme.pronunciation` (`registerCoreAndPronunciation`, `registerPronunciationExtra`). |
| Production | `production` | Not extracted. |
| Usage notes | `usageNotes` | `Lexeme.usage_notes` (`usage-notes` decoder). |
| Reconstruction notes | `reconstructionNotes` | Not extracted. |
| Inflection | `inflection` | Partially via `headword_morphology`, `inflection_table_ref`; not a single “Inflection” section blob. |
| Conjugation | `conjugation` | `inflection_table_ref` / morphology helpers; full table expansion is separate (`morphology.ts`). |
| Declension | `declension` | Same as conjugation for nouns/adjectives. |
| Mutation | `mutation` | Not extracted. |
| Quotations | `quotations` | Not extracted as a standalone section; quotes may appear in sense `examples` when on definition lines. |
| Alternative forms | `alternativeForms` | `Lexeme.alternative_forms` (`alternative-forms-section`). |
| Alternative reconstructions | `alternativeReconstructions` | Not extracted. |
| Synonyms | `synonyms` | `semantic_relations.synonyms` — `{{syn|…}}` + `====Synonyms====` (`semantic-relations`). |
| Antonyms | `antonyms` | `semantic_relations.antonyms` — `{{ant|…}}` + `====Antonyms====`. |
| Hypernyms | `hypernyms` | `semantic_relations.hypernyms` — `{{hyper|…}}` + `====Hypernyms====`. |
| Hyponyms | `hyponyms` | `semantic_relations.hyponyms` — `{{hypo|…}}` + `====Hyponyms====`. |
| Meronyms | `meronyms` | `semantic_relations.meronyms` — `====Meronyms====` (list lines with `{{l}}` / `{{link}}`). |
| Holonyms | `holonyms` | `semantic_relations.holonyms` — `====Holonyms====`. |
| Comeronyms | `comeronyms` | `semantic_relations.comeronyms` — `====Comeronyms====`. |
| Troponyms | `troponyms` | `semantic_relations.troponyms` — `====Troponyms====`. |
| Parasynonyms | `parasynonyms` | `semantic_relations.parasynonyms` — `====Parasynonyms====`. |
| Coordinate terms | `coordinate` | `semantic_relations.coordinate_terms` — `====Coordinate terms====`. |
| Derived terms | `derived` | `Lexeme.derived_terms` (`registerSections` derived). |
| Related terms | `related` | `Lexeme.related_terms`. |
| Collocations | `collocations` | `semantic_relations.collocations` — `====Collocations====`. |
| Descendants | `descendants` | `Lexeme.descendants`. |
| Translations | `translations` | `Lexeme.translations` (`registerTranslations`). |
| Trivia | `trivia` | Not extracted. |
| See also | `seeAlso` | `Lexeme.see_also` (`see-also`). |
| References | `references` | `Lexeme.references` (`references`). |
| Further reading | `furtherReading` | Not extracted. |
| Anagrams | `anagrams` | `Lexeme.anagrams` (`anagrams`). |
| Definitions | `definitions` | `Lexeme.senses` from `#` / `##` lines (`registerSenses`). |
| Examples | `examples` | Sense-level `examples` from `#:` and templates on definition lines. |

**Semantic relations note:** `coordinate_terms`, `holonyms`, `meronyms`, and `troponyms` are filled from **section lists** in the per-PoS block. Inline templates `{{cot}}`, `{{hol}}`, `{{mer}}`, and `{{tro}}` are **not** yet mapped in `RELATION_TEMPLATES` (unlike `{{syn}}` / `{{ant}}` / `{{hyper}}` / `{{hypo}}`).

**Lexeme boundaries:** PoS-level sections above are parsed within each lexeme slice (language section + etymology + `===Part of speech===` heading). See `src/lexicographic-headings.ts` for which headings open a lexeme vs. metadata-only blocks.
