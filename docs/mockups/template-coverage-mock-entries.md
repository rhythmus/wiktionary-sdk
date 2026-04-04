# Template coverage — mock vocabulary entries (single-language scope)

Synthetic **prose specimens** for designing HTML/Markdown entry templates. Each block is **one language only**; multi-language layouts are modeled by **repeating** the same patterns under different language headers in the UI.

**Source matrix:** `docs/query-result-dimensional-matrix.md`  
**Case IDs** encode axes: **D** = etymology slice, **E** = PoS cardinality, **F** = lexeme type, **H** = morph richness, **I** = lemma resolution, **META** = page/query level (not a lexeme row).

---

## Index (checklist for template authors)

| ID | Matrix / scenario | What the template must show |
|----|-------------------|------------------------------|
| `L-01` | A1 B1 C1 D2 E1 F1 H1 | Simplest lemma card |
| `L-02` | D3 homonyms | **One** integrated card: same headword + PoS; **stacked** etymology+definition runs |
| `L-03` | E2 multi-PoS | One surface, noun + verb (shared or split etym) |
| `L-04` | D1 implicit etym | No `===Etymology===` prose; PoS block only |
| `L-05` | F2 H1 | **Ultra-compact** inflected line: surface + relation + gloss, no PoS banner |
| `L-06` | F2 H2 | Inflected morph **merged into one phrase** + `→` **lemma continuation** (etym + senses) |
| `L-07` | F2 H5 “Spanish” | Same as `L-06` pattern: merged morph phrase + `→` lemma + senses |
| `L-08` | D1 F2 H5 | Stub section: form-of only, minimal etym |
| `L-09` | F3 FORM_OF | Variant / alt spelling → lemma (non-inflectional pointer) |
| `L-10` | F1 H4 | Lemma with **`##` subsenses** under a sense |
| `L-11` | F1 H3 | Abbrev / inline tags on headword line (`m`, `f`, `pl`, …) |
| `L-12` | E4 | Unmapped PoS heading → **(unknown)** or generic bucket |
| `L-13` | I2 + resolved lemma | **Alternate:** two stacked blocks (query surface vs resolved lemma); prefer **`L-06`/`L-07`** single-card `→` when possible |
| `L-14` | I3 lemma missing | Inflected card + **failure** strip for missing lemma page |
| `L-15` | E3 empty PoS filter | **Zero** lexemes for this language (placeholder panel) |
| `META-A2` | Page missing | **No** lexeme rows; query-level message |
| `META-A3` | Redirect | Query-level “redirected from …” |
| `META-B2` | Fuzzy merge | Query-level note / variant title |
| `L-16` | J2 Wikidata | Optional lemma **QID / sitelinks** line (when enrich on) |
| `L-17` | J1 enrich off | Same as `L-01` but **no** enrichment strip |

---

## `L-01` — Simplest lemma (D2 · E1 · F1 · H1)

One etymology, one part of speech, `LEXEME`, plain senses.

```
cat  (English)

  noun  (< Middle English cat, catte < Old English catt (male cat) < 
  Late Latin cattus)  
  1 A domesticated species of feline, Felis catus. 2 slang A person.
  3 nautical A strong tackle used to hoist an anchor.
```

---

## `L-02` — Two etymologies, same language + PoS (D3 homonyms)

The SDK may still return **two** lexemes (distinct `etymology_index` / `id`). For **dictionary-style** UI, **merge** into one record: one headword line + PoS, then **multiple** (etymology prose + numbered senses) **stacks**—do **not** repeat the title as if it were two separate cards.

```
bank noun gender

  (< Middle English banke < Old Norse bakki) 1 A slope of earth adjoining
    a body of water. 2 A raised mass of sand, gravel, or snow. 3 A row or
    tier of objects.

  (< Middle French banque < Italian banca) 1 An institution where one
    can place and borrow money. 2 A safe storage for valuable objects.
    3 A supply or stock held in reserve.
```

The headline is **`{lemma} {pos} {gender?}`**—`gender` is a slot when the headword supplies it (often empty or omitted for English).

---

## `L-03` — Same language, multiple PoS blocks (E2)

Same headword string; **stacked PoS sections** under one etymology (your “sense” style).

```
sense  (English)

  noun masc.  (< Middle English sense < Old French sens, sen, san “sense, perception, 
  direction” < Latin sēnsus “sensation, feeling, meaning” < … )  
  1 Any of the manners by which living beings perceive the physical world: for humans 
  sight, smell, hearing, touch, taste. 2 Perception through the intellect; apprehension; 
  awareness. 3 Sound practical or moral judgment. 4 The meaning, reason, or value of 
  something. 5 A natural appreciation or ability. 6 pragmatics The way that a referent 
  is presented. 7 One of two opposite directions in which a vector may point. 
  8 One of two opposite directions of rotation. 9 biochemistry referring to the strand 
  of a nucleic acid that directly specifies the product. SYN. non-nonsense

  verb  (< Middle English sense < Old French sens … )  
  1 To use biological senses: to either see, hear, smell, taste, or feel. 
  2 To instinctively be aware. 3 To comprehend.
```

---

## `L-04` — Implicit / empty etymology slice (D1)

No long chain; template should tolerate **missing etymology block** or placeholder.

```
foobar  (English)

  interjection  (etymology not given on Wiktionary)  
  1 Expresses mild annoyance or surprise.
```

---

## `L-05` — Inflected form, single morph line (F2 · H1)

`INFLECTED_FORM`, `form_of` set, **no** `display_morph_lines` / no subsense split. **Compact** line: surface + grammatical relation + short gloss (optional link on lemma).

```
cats plural of: cat Domesticated felid
```

---

## `L-06` — Inflected + positional / tag expansion (F2 · H2)

Several tag-derived readings are **collapsed into one readable phrase**, then the **resolved lemma** continues on the same card after `→` (etymology + senses). Still **one** inflected lexeme in the API; lemma block comes from resolution / merge in the UI.

```
was first or third person singular past indicative or subjunctive of:
→ be verb (< Middle English been < Old English bēon < … )
  1 auxiliary 2 copulative 3 intransitive
```

---

## `L-07` — “Spanish case”: one surface, many morph readings (F2 · H5)

Parse/Lua yields multiple morph labels; **merge** them into one natural phrase (cf. `L-06`), then **`→` lemma** + senses on the same integrated card.

```
hablara first and third person singular imperfect subjunctive of:
→ hablar verb
  1 I/he/she/it would speak (hypothetical or reported past context).
  2 (second reading if editor/Lua supplies distinct line) …
```

---

## `L-08` — Stub: form-of only, no etym prose (D1 · F2 · H5)

Valid card; **empty** etymology chain is correct, not an error.

```
hablara  (Spanish)

  verb form of: hablar  (no etymology section on this page)  
    first-person singular imperfect subjunctive  
    third-person singular imperfect subjunctive  
```

---

## `L-09` — Variant form-of (F3 · FORM_OF)

Pointer styling may differ from inflectional (alt spelling, obsolete form, etc.).

```
colour  (English)

  noun  — alternative form of: color (US spelling)  
  1 Commonwealth spelling of color (“hue, pigment”).
```

---

## `L-10` — Lemma with subsenses / `##` bullets (F1 · H4)

Nested list under one numbered sense.

```
run  (English)

  verb  (< Middle English ronnen … )  
  1 To move quickly on foot.  
    ## To run as sport or exercise.  
    ## To flee.  
  2 transitive To operate or execute (a program, machine).  
  3 nautical To sail before the wind with all sails set.
```

---

## `L-11` — Abbrev / inline headword tags (F1 · H3)

No separate bullet morph list; **inline** gender/number on the PoS line.

```
amicus  (Latin)

  noun m inan  (masculine inanimate, nominative singular shown)  
  1 friend, comrade.
```

---

## `L-12` — Unmapped PoS heading (E4)

Template should render **unknown** bucket without breaking layout.

```
weirdpage  (English)

  (unknown)  
  1 Contributor used a heading the decoder maps to “(unknown)”; content still shows.
```

---

## `L-13` — Lemma resolution: inflected + resolved lemma card (I2)

When **not** using the integrated **`→` lemma** layout (`L-06`, `L-07`), the UI may show **two** stacked blocks: query surface first, then resolved lemma (accordion or secondary card).

```
cats  (English)  [queried page]

  noun  — inflected form of: cat · plural  
  1 plural of cat.

——— resolved lemma (same query result, secondary block) ———

cat  (English)  [resolved for query]

  noun  (< Middle English cat, catte … )  
  1 A domesticated species of feline, Felis catus. 2 slang A person. …
```

---

## `L-14` — Lemma page missing (I3)

Inflected card stands; **error or warning** region for failed second fetch.

```
xyzunknownlemmaform  (English)

  noun  — inflected form of: this-lemma-title-does-not-exist · some inflection  
  ⚠ Lemma page could not be loaded. Definitions below may be incomplete.
```

---

## `L-15` — Empty after PoS filter (E3)

**No lexeme rows** for this language when `pos` excludes all blocks.

```
(English · filtered to Verb only)

  No verb sections found for this headword in English.  
  (Noun-only entry would yield this empty state.)
```

---

## `META-A2` — Page missing (A2)

**Query-level** panel; `lexemes` empty.

```
Query: “notawordatall”

  No Wiktionary page found for this title.
```

---

## `META-A3` — Redirect (A3)

**Query-level** note; content follows target page title.

```
Query: “USA” → redirected to: United States

  (Lexeme cards would use the target page’s language sections.)
```

---

## `META-B2` — Fuzzy match merged (B2)

**Query-level** note; lexeme set as for matched title.

```
Query: “colour” (fuzzy) — matched title: color

  (Cards follow the resolved page; notes may list normalization variant.)
```

---

## `L-16` — Wikidata enrichment strip (J2)

Optional **one line** or icon row on **lemma** rows when `enrich: true`.

```
cat  (English)

  Wikidata: Q146  ·  Wikipedia · Commons …

  noun  (< Middle English cat … )  
  1 A domesticated species of feline, Felis catus.
```

---

## `L-17` — Enrich off (J1)

Same structural card as `L-01`; **omit** Wikidata / parse-only morph extras.

```
cat  (English)

  noun  (< Middle English cat … )  
  1 A domesticated species of feline, Felis catus.
```

---

## Why this is “all” cases for templates

The full Cartesian product **A×B×C×…×K** explodes and many cells are **∅** or **visually identical** (e.g. B1 vs B2 changes a **banner**, not the lexeme body). Here, **every distinct row type** in `lexemes[]` and **every distinct morph/etym/PoS/layout** combination the formatter can emit is represented by **at least one** mock above.

When you add a new axis value in the matrix, add a new **ID** + prose block here and extend the index table.

---

## See also

- `docs/mockups/dictionary-entry-v3-exhaustive-lexemes.yaml` — structured field-level examples aligned with `types.ts`
- `docs/query-result-dimensional-matrix.md` — axis definitions
- **Library:** `format(fetchResult, { mode: 'html-fragment' })` and `formatFetchResult()` render **homonym-merged** cards (L-02), query **notes** (META), and empty states (L-15 / META-A2). Single-lexeme cases use `entry.html.hbs` helpers (`formOfMorphMergedProseLine`, `formOfUltraCompactEligible`, subsenses, etymology placeholder).
