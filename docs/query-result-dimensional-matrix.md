# Query result dimensional matrix

This document gives an **exhaustive, axis-by-axis** overview of what `wiktionary()` / `wiktionaryRecursive()` can return when callers use permissive defaults (`lang: "Auto"`, `pos: "Auto"`, `matchMode: "fuzzy"`, `enrich: true`). It is a **conceptual combinatorics** guide: real pages instantiate *subsets* of these dimensions.

**Related:** `docs/form-of-display-and-mediawiki-parse.md` (one important **within-lexeme** richness case), `docs/wiktionary-sdk-spec.md` (normative contracts), `docs/mockups/template-coverage-mock-entries.md` (prose mocks per presentation pattern, single-language scope).

---

## 1. Dimensions (axes)

Each **lexeme** in `FetchResult.lexemes` is keyed in the pipeline by the Cartesian-style tuple:

| Axis | Role in code | Typical values / notes |
|------|----------------|----------------------|
| **A. Query / page** | `query`, `fetchWikitextEnWiktionary(title)` | Page exists, missing, redirect, or alternate title (fuzzy / NFC retry). |
| **B. Match mode** | `matchMode: "strict" \| "fuzzy"` | Strict: one title fetch. Fuzzy: several normalized variants merged with dedup + `notes`. |
| **C. Language filter** | `lang: WikiLang \| "Auto"` | `Auto`: every `==Section==` from `extractAllLanguageSections`. Else: one `extractLanguageSection`. |
| **D. Etymology slice** | `splitEtymologiesAndPOS` → `e.idx`, `source.wiktionary.etymology_index` | `===Etymology===`, `===Etymology 2===`, … or implicit single slice (see parser). |
| **E. Part of speech / lexeme class** | `posBlock.posHeading`, `isLexemeSectionHeading`, `lexemeMatchesPosQuery`, `pos` filter | Verb, Suffix, Symbol, …; `pos: "Auto"` keeps all lexeme-class blocks; else filter drops non-matching blocks (**0 lexemes** possible). Strict `part_of_speech` is only set for grammatical PoS; other sections use `lexicographic_section` + `lexicographic_family`. |
| **F. Lexeme type** | `guessLexemeTypeFromTemplates` + `isFormOfTemplateName` / `isVariantFormOfTemplateName` | `LEXEME` \| `INFLECTED_FORM` \| `FORM_OF`. |
| **G. Surface string** | `lexeme.form` / page `title` | Usually equals page title; inflected entries still use page title as surface form string. |
| **H. Form-of / morph richness** | `form_of`, `senses[].subsenses`, `display_morph_lines` | Plain lemma card vs template-only stub vs multi-line morph (wikitext `##`, tags, abbrev, or `mediawiki_parse`). |
| **I. Lemma resolution** | Second `wiktionaryRecursive` for unique `(lang, lemma)` | Only for `INFLECTED_FORM` with `form_of.lemma`; deduped; cycle guard; lemma page may be missing. |
| **J. Enrichment** | `enrich` | Wikidata on **lemma** lexemes; `display_morph_lines` via `action=parse` on **inflected** stubs when gated. |
| **K. Ordering** | `sort: "source" \| "priority" \| { strategy, priorities? }` | Source order vs language-priority reorder of merged array; caller may override priority ranks. Priority mode uses secondary keys: `etymology_index` asc then PoS heading (alphabetical). |

The **simplest** case is one point in each axis: existing page, strict match, one language, one etymology, one PoS, type `LEXEME`, no form_of, no extra fetches.

---

## 2. Axis A–B: Page fetch and match mode

| Case | Outcome |
|------|---------|
| **A1. Page exists, exact title** | Full wikitext; `metadata` populated. |
| **A2. Page missing** | `lexemes: []`, `notes` explain failure. |
| **A3. Redirect** | API `redirects=1`; normalized title in page object; content is redirect target’s revision (normal MW behaviour). |
| **A4. Combining-mark retry** | If title missing, retry without combining marks; note may be appended when `debugDecoders` or internal note path documents it. |
| **B1. Strict** | Single `runSingle(query)`. |
| **B2. Fuzzy** | Variants include NFC, lowercased, **capitalize-first**, and combining-mark-stripped forms (plus cross-products). Variants are **sorted alphabetically** before iteration, so merge ordering is **deterministic** regardless of input casing (`"god"` and `"God"` both produce variants `["God", "god"]`). Merged lexeme list with **deduplication by lexeme `id`**; `notes` list variant used. Because lexeme IDs embed the source page title, lexemes from different case-variant pages (e.g. "God" vs "god") are correctly treated as **distinct** entries and both appear in the result. |

**Combination:** (A2) alone yields **empty** result regardless of other axes. (B2)+(A1) can yield **one** merged set when variants hit the same page, or **multiple distinct lexemes** when variants hit **different** pages (common for case-sensitive pairs like "God"/"god", proper noun/common noun splits).

---

## 3. Axis C: Language coverage

| Case | Lexeme count driver |
|------|---------------------|
| **C0. Requested language unknown** | No section → **0** lexemes for that request path, `notes`. |
| **C1. Single language `lang: "es"`** | At most lexemes from that section only. |
| **C2. `lang: "Auto"`** | **Sum over all** `==…==` language sections (excluding non-lexical sections Wiktionary uses — parser treats each level-2 header as a section name). |

**Cross-language homography:** Same **string** page title, **different** `language` and/or `etymology_index` and/or `pos_heading` → **distinct lexeme `id`s**.

---

## 4. Axis D: Etymology slices per language section

| Case | Behaviour |
|------|-----------|
| **D1. No `===Etymology===` heading** | Parser still builds slices from PoS flow; **implicit** etymology bucket `idx: 0` or merged preamble + first PoS (see `splitEtymologiesAndPOS` fallback when `etyms.length === 0`). |
| **D2. Single `===Etymology===`** | One slice index (usually `1` or `0` depending on numbering). |
| **D3. `===Etymology 2===`, …** | **Multiple slices**; same PoS heading can repeat **per etymology** → **multiple lexemes** same language + PoS **heading string** but **different `etymology_index`** (true homonyms). |

---

## 5. Axis E: Part of speech per etymology

| Case | Behaviour |
|------|-----------|
| **E1. One PoS block** | One candidate lexeme per (language, etymology, PoS) before type split. |
| **E2. Several PoS blocks** (e.g. Noun + Verb) | **Multiple lexemes** same language + etymology. |
| **E3. `pos: "verb"` filter** | Only PoS blocks mapping to `"verb"` produce lexemes; others **skipped** (can yield **empty** for that language if only nouns exist). |
| **E4. Unmapped heading** | Falls into `"(unknown)"` bucket in parser fallback paths — still a PoS block, may yield a lexeme. |

---

## 6. Axis F–G: Lexeme type and surface

| Case | `type` | Implications |
|------|--------|----------------|
| **F1. No form-of template in PoS block** | `LEXEME` | No `form_of`; lemma resolution pass **does not** add a second fetch *for this lexeme*. |
| **F2. Inflectional form-of** | `INFLECTED_FORM` | `form_of` set; **lemma resolution** queued (`form_of.lemma`, `form_of.lang`). |
| **F3. Variant form-of** (spelling, alt form, …) | `FORM_OF` | Still has `form_of`; **variant** path in registry; lemma resolution behaviour same class (pointer to target lemma). |
| **G1. `form` field** | Always set from **page title** for entries on that page | The “search term” in UI is the **page** queried; surface form is the headword page, not necessarily dictionary lemma. |

---

## 7. Axis H: “Spanish case” and morphological *display* richness (one lexeme)

Important distinction:

- **Multiple lexemes** = multiple rows in `lexemes[]` (different language / etymology / PoS / id).
- **Multiple morph *lines*** = **one** `INFLECTED_FORM` lexeme with several gloss lines for **one** surface form.

| Subcase | Source | Fields |
|---------|--------|--------|
| **H1. Lemma-like** | No `form_of` | Single headword line; senses as usual. |
| **H2. Form-of + positional tags** | `{{infl of|…\|tags…}}` | `form_of.tags`, `form_of.label`; may expand to **multiple display lines** (e.g. `first/third-person` split). |
| **H3. Abbrev tags** | `voc`, `m`, `s`, … | **Inline** phrase + gender on PoS; **no** bullet list (formatter). |
| **H4. Wikitext `##` subsenses** | Editor-written sub-bullets | `senses[].subsenses[]` → bullet list in UI. |
| **H5. Lua-only list (Spanish-style)** | `{{es-verb form of|lemma}}` only | **`display_morph_lines`** from `action=parse` when `enrich` + gate passes (`docs/form-of-display-and-mediawiki-parse.md`). |

**User “Spanish case”** in the UI usually means **H5** (or H4 if `##` exist): **one language, one PoS, one lexeme row**, but **several morph readings** for that inflected surface.

---

## 8. Axis I: Lemma resolution (second fetch)

| Case | Result |
|------|--------|
| **I1. No `INFLECTED_FORM` lexemes** | No lemma batch. |
| **I2. Several inflected lexemes, same lemma** | **Deduped** single recursive fetch per `(lang, lemma)`. |
| **I3. Lemma page missing** | Resolved list lacks that lemma; nested UX may show error (webapp). |
| **I4. Cycle** | `_visited` set prevents infinite recursion; note returned. |

Resolved lemma lexemes are **appended** to `lexemes` with **`resolved_for_query`** (original query string) and **`lemma_triggered_by_lexeme_id`** (the `Lexeme.id` of the `INFLECTED_FORM` row that triggered the recursive fetch) for traceability. See `src/index.ts` / `docs/wiktionary-sdk-spec.md` §3.2.

---

## 9. Axis J: Enrichment

| Case | Applies to |
|------|------------|
| **J1. `enrich: false`** | No Wikidata merge; **no** `display_morph_lines` parse pass; **no** ISO 639 enrichment. |
| **J2. Wikidata** | **Lemma** rows (`type === "LEXEME"`) on the **queried** page when QID resolvable. **Exception:** Translingual lexemes are **skipped** when the QID came from the Wikipedia-title fallback (step 3 of the resolution chain), because Wikipedia articles describe language-specific concepts that are semantically wrong for Translingual entries. |
| **J3. Parse morph lines** | **Inflected** stubs matching `isPerLangFormOfTemplate` + empty wikitext morph (see enrich module). |
| **J4. ISO 639 enrichment** | **Translingual** Symbol entries with `{{ISO 639\|N}}` definition lines: template expanded via `action=parse` to resolve language name; correct Wikidata QID looked up via the language's Wikipedia article (e.g. "Godié language" → Q3914412). Module: `src/pipeline/iso639-enrich.ts`. |
| **J5. Disambiguation resolution** | When the resolved QID is a disambiguation page (P31 includes `Q4167410`), `buildSenseMatchesForDisambiguation` scores lexeme senses against Wikipedia candidates (title-token = 2 pts, aux-token = 1 pt, title-phrase = 4 pts). Confident matches (score >= 4) promote the best candidate QID to `lex.wikidata.qid`, annotate senses with `sense.wikidata_qid`, strip `Q4167410` from `instance_of`, and store the original in `disambiguation.source_qid`. Unresolved entries set `disambiguation.unresolved = true`. Rendering filters `Q4167410` from pill lists and shows per-sense QID pills inline. The webapp hoists shared unresolved QIDs to a global annotation. |

---

## 10. Full combination matrix (template)

Use this as a **checklist** for mental simulation: pick one option from each row; if the row is impossible with Wiktionary layout, mark **∅**.

| # | A Page | B Match | C Langs | D Etyms | E PoS | F Type | H Morph | I Lemma fetch | J Enrich |
|---|--------|---------|---------|---------|-------|--------|---------|---------------|----------|
| Example | exists | strict | 1 | 1 | 1 | LEXEME | H1 | no | on |
| … | … | … | … | … | … | … | … | … | … |

**Cardinality explosion:** Practically, **C2×D3×E2×F2×H5** already yields “many lexemes + rich cards”. Fuzzy **B2** multiplies **fetch count**, not necessarily **distinct** lexeme ids.

---

## 11. Named scenarios (cross-product examples)

1. **Simplest lemma**  
   A1 + B1 + C1 + D2 + E1 + F1 + H1 + I none + J on  
   → One `LEXEME`, one language, one etymology, one PoS.

2. **Same word, two etymologies, same language**  
   C1 + D3 + E1 + F1  
   → Two `LEXEME`s differing by `etymology_index` (homonyms).

3. **Same language, noun + verb**  
   C1 + D2 + E2 + F1  
   → Two lexemes, same `etymology_index`, different `part_of_speech_heading`.

4. **Auto: many languages**  
   C2 + (any per-section D/E/F)  
   → `lexemes.length` = sum over sections of per-section lexeme counts.

5. **Spanish-style single inflected card**  
   C1 + D2 + E1 + F2 + H5 + I2  
   → One `INFLECTED_FORM` with `display_morph_lines` + appended resolved `LEXEME` for lemma.

6. **Strict PoS filter empty**  
   C1 + E3 with no matching PoS  
   → Zero lexemes, possibly `notes` / empty array.

7. **Fuzzy merged**  
   B2 + A1  
   → One logical result set; notes may mention variant title (e.g. lowercase fallback), with `debug` rows aligned to merged `lexemes` when `debugDecoders` is enabled.

8. **Custom priority profile**  
   K with `{ strategy: "priority", priorities: { grc: 1, el: 2 } }`  
   → Historical-language-first ordering without changing extraction semantics.

9. **Only form-of stubs (no etym prose)**  
   D1 + F2 + H5  
   → Valid lexeme with empty/minimal etymology chain; **not** an error.

10. **Disambiguation page QID resolved to concept QIDs**  
    J2 + J5  
    → Polysemous word (e.g. "pan") where the page-level QID is a Wikipedia disambiguation page. Pipeline scores senses against candidates; confident matches promote per-sense QIDs and replace the top-level QID. Rendering suppresses `Q4167410` noise; webapp hoists shared unresolved QIDs to a global annotation.

---

## 12. What this matrix does *not* guarantee

- **Predictable count** for arbitrary strings: Wiktionary is contributor-shaped; axes are **possible**, not **probable**.
- **1:1 search term ↔ lemma**: the **page title** is the join key; lemmas on **other** pages are only reached via **lemma resolution** or a **new query**.
- **Disambiguation**: the SDK returns **all** matching slices for the request; **UI** (e.g. language + PoS pills, merged stacks) is a **presentation** layer on top of `lexemes[]`.

---

## 13. Code pointers

| Concern | Location |
|---------|----------|
| Language sections | `extractLanguageSection`, `extractAllLanguageSections` (`parser.ts`) |
| Etymology × PoS | `splitEtymologiesAndPOS` (`parser.ts`) |
| Lexeme assembly | `wiktionaryRecursive` (`pipeline/wiktionary-core.ts`) |
| Form-of + type | `registry.ts` (`form-of` decoder, `isFormOfTemplateName`, …) |
| Parse morph enrichment | `form-of-parse-enrich.ts` |
| Sense-relation linking | `sense-relation-linker.ts` (post-decode pass, see below) |
| Formatter / bullets | `formatter.ts`, `entry.html.hbs` |
| **`FetchResult` HTML** (notes, empty state, homonym merge) | `formatFetchResult()`, `groupLexemesForIntegratedHomonyms()` (`lexeme-display-groups.ts`), `lexeme-homonym-group.html.hbs` |

---

## 14. Axis L: Sense-level semantic relation linking

After decoding, the sense-relation linker (`src/pipeline/sense-relation-linker.ts`) runs on each lexeme to produce **`semantic_relations_by_sense`** — a projection of the flat `semantic_relations` keyed by sense ID.

| Case | Behaviour |
|------|-----------|
| **L1. Template `id=` anchor** | Direct sense match, `confidence: "high"`, score 100. |
| **L2. Section qualifier** | Parenthetical text on bullet line, scored against sense text bags; `confidence: "medium"` when score >= 5. |
| **L3. Heuristic overlap** | Token overlap between relation term/qualifier and sense gloss; `confidence: "low"` when 2 <= score < 5. |
| **L4. Unresolved** | Score < 2 against all senses; item stays in flat structure only, absent from by-sense view. |
| **L5. No senses** | Linker skips entirely; `semantic_relations_by_sense` absent. |

This axis is **within-lexeme** (like H) and orthogonal to the other dimensions. Every relation item in the flat structure may acquire `source_evidence`, `confidence`, and `matched_sense_id`. The by-sense view is a strict subset of the flat view.

**Detail:** [`docs/sense-level-semantic-relations.md`](sense-level-semantic-relations.md).

---

*When adding new behaviours (e.g. another enrichment gate), extend **Axis H**, **Axis J**, or **Axis L** and add a row to §11.*
