# Decoder registration inventory (`src/registry.ts`)

Ordered list of **`registry.register({ id })`** calls as they appear in source (**registration order is normative**; do not reorder casually). See `STAGED_IMPLEMENTATION_PLAN.md` Phase 4 and `test/registry-ids.test.ts`.

**`DecoderRegistry`** and decode orchestration live in **`src/registry/decoder-registry.ts`**. All **`reg.register({ id })`** calls run inside **`registerAllDecoders(reg)`** in **`register-all-decoders.ts`** (historical order; do not reorder). The package entry **`src/registry.ts`** constructs the singleton and calls `registerAllDecoders(registry)`.

Pure helpers under **`src/registry/`**: **`merge-patches.ts`**, **`form-of-predicates.ts`**, **`strip-wiki-markup.ts`**, **`section-extract.ts`**, **`gender-map.ts`**, **`form-of-display-label.ts`**. The public barrel **`registry.ts`** re-exports form-of predicates and **`stripWikiMarkup`**; other helpers are imported by **`register-all-decoders.ts`** only.

| # | `id` | Family (informal) |
|---|------|---------------------|
| 1 | `store-raw-templates` | bootstrap / verbatim |
| 2 | `ipa` | pronunciation |
| 3 | `hyphenation` | pronunciation / orthography |
| 4 | `alternative-forms-section` | orthography / variants |
| 5–12 | `el-adj-head` … `el-art-head` | Greek headword |
| 13–15 | `nl-adj-head`, `nl-noun-head`, `nl-verb-head` | Dutch headword |
| 16–18 | `de-adj-head`, `de-noun-head`, `de-verb-head` | German headword |
| 19 | `form-of` | inflection / lemma pointer |
| 20 | `wikidata-p31` | Wikidata |
| 21 | `translations` | sense / translations |
| 22 | `senses` | sense pipeline |
| 23 | `el-verb-morphology` | Greek morphology |
| 24 | `el-noun-gender` | Greek morphology |
| 25 | `la-noun-head` | Latin headword |
| 26 | `semantic-relations` | relations |
| 27 | `etymology` | etymology |
| 28 | `el-ipa` | Greek pronunciation |
| 29 | `audio` | media |
| 30 | `romanization` | pronunciation |
| 31 | `rhymes` | pronunciation |
| 32 | `homophones` | pronunciation |
| 33 | `section-links` | derived / related / descendants |
| 34 | `alternative-forms` | variants (inline) |
| 35 | `see-also` | cross-refs |
| 36 | `anagrams` | misc section |
| 37 | `usage-notes` | sense / usage |
| 38 | `references` | citations |
| 39 | `inflection-table-ref` | paradigm pointer |
| 40 | `el-verb-stems` | stems |
| 41 | `el-noun-stems` | stems |

Greek headword row spans: `el-adj-head`, `el-noun-head`, `el-verb-head`, `el-pron-head`, `el-numeral-head`, `el-participle-head`, `el-adv-head`, `el-art-head` (8 decoders).
