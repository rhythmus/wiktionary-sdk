# Sense-Level Semantic Relations

**Status:** Implemented (additive, backward-compatible).  
**Related:** [`wiktionary-sdk-spec.md` §3.4](wiktionary-sdk-spec.md), [`architecture-layers.md`](architecture-layers.md), [`query-result-dimensional-matrix.md`](query-result-dimensional-matrix.md).

---

## 1. Problem statement

Semantic relations (synonyms, antonyms, hypernyms, etc.) connect **meanings**, not surface forms. A polysemous word like "bank" has distinct synonym sets for its "financial institution" sense and its "river edge" sense. Wiktionary, however, models semantic relations inconsistently: sometimes inline on a definition line with an explicit sense anchor (`{{syn|en|…|id=S1}}`), sometimes in a section (`====Synonyms====`) with a parenthetical qualifier (`* (finance) {{l|en|depository}}`), and sometimes as a bare list without any sense scoping.

Prior to this feature, the SDK flattened all semantic relations to the **lexeme level** (`lexeme.semantic_relations`). This conflated polysemy and homonymy — callers could not tell which synonym belonged to which sense.

### Comparison with WordNet

WordNet correctly links synonyms (and other relations) through **synsets**: a synset is a set of words sharing a specific meaning. The word "bank" belongs to multiple synsets, and each synset has its own relational network. Wiktionary has no formal synset concept, but it does provide partial evidence of sense scoping through template parameters and section structure. The SDK now exploits this evidence to approximate synset-like groupings with explicit confidence signals.

---

## 2. Design: hybrid model

The implementation preserves **full backward compatibility** while adding a **sense-centric projection**.

### 2.1 Flat relations (unchanged)

```typescript
lexeme.semantic_relations?: SemanticRelations
```

Every relation item is still present in the flat structure, exactly as before. Existing callers, convenience wrappers (`synonyms()`, `antonyms()`, etc.), formatters, and tests see no change in behavior.

### 2.2 Sense-grouped relations (new)

```typescript
lexeme.semantic_relations_by_sense?: SemanticRelationsBySense
// where SemanticRelationsBySense = Record<string, SemanticRelations>
```

Keys are **sense IDs** (e.g. `"S1"`, `"S2"`, `"S1.1"` for subsenses). Values are `SemanticRelations` objects containing **only** the relation items linked to that sense. If no relations could be linked to any sense, this field is absent (not an empty object).

### 2.3 Per-item enrichment

Each `SemanticRelation` item in the flat structure is enriched with linking metadata:

| Field | Type | When present |
|-------|------|--------------|
| `source_evidence` | `"template_id" \| "section_scope" \| "qualifier_match" \| "heuristic"` | When the linker has processed this item |
| `confidence` | `"high" \| "medium" \| "low"` | When linking succeeded |
| `matched_sense_id` | `string` | The sense ID this item was resolved to |

Items that could not be linked to any sense retain their existing shape unchanged (no `matched_sense_id`, no `confidence`).

---

## 3. Evidence tiers and the linking algorithm

The sense-relation linker (`src/pipeline/sense-relation-linker.ts`) runs as a **post-decode pass** on each lexeme, after all decoders have produced `semantic_relations` and `senses`. It proceeds in strict priority order:

### Tier 1: Template sense anchor — **high confidence**

**Source:** `{{syn|en|sprint|id=S1}}` (the `id=` named parameter).

The decoder (`register-semantic-relations.ts`) captures `sense_id` and stamps `source_evidence: "template_id"` on the relation item at decode time. The linker performs a direct ID match against `lexeme.senses[].id`. If the sense exists, the item is linked with `confidence: "high"` and a score of 100.

This is deterministic and infallible when editors use `id=` correctly.

### Tier 2: Section/qualifier scoping — **medium confidence**

**Source:** Bullet lines in `====Synonyms====` sections with parenthetical qualifiers:

```wikitext
====Synonyms====
* (financial institution) {{l|en|depository}}
* (river) {{l|en|shore}}
```

The enhanced section parser (`parseSectionRelationItems`) extracts the parenthetical text and attaches it as `qualifier` on the relation item, with `source_evidence: "section_scope"`. The linker then scores each sense:

| Signal | Score contribution |
|--------|--------------------|
| Each qualifier token matching a sense's text bag | +3 per token |
| Full qualifier phrase contained in sense gloss | +5 |
| Each term token matching a sense's text bag | +1 per token |

The sense with the highest score wins. If score >= 5, confidence is `"medium"`; if 2 <= score < 5, it falls to `"low"`.

**Sense text bag construction:** The linker tokenizes (lowercase, strip punctuation, remove stopwords, minimum 3-char tokens) and unions tokens from: `sense.gloss`, `sense.gloss_raw`, `sense.qualifier`, `sense.labels[]`, and `sense.topics[]`.

### Tier 3: Heuristic — **low confidence**

Items with no template ID and no qualifier (bare section items, or template items without `id=`) are scored against all senses using the same tokenization. If any sense scores >= 2, the best match is linked with `source_evidence: "heuristic"` and `confidence: "low"`.

### Unresolved items

Items that score below the threshold (< 2) against all senses remain in the flat `semantic_relations` without `matched_sense_id`. They are **not dropped** — the flat structure is always complete. They simply don't appear in `semantic_relations_by_sense`.

### Tie-breaking and thresholding

- **Deterministic tie-breaking:** When multiple senses score equally, the first sense in document order wins (stable sort).
- **Minimum score threshold:** Score < 2 is treated as "no match" (avoids over-linking on noise tokens).
- **Stopword filtering:** Common English function words ("the", "and", "for", "with", etc.) are excluded from token matching.

---

## 4. Supported relation families

All 11 relation families participate in sense linking:

| Family | Template source | Section source |
|--------|----------------|----------------|
| `synonyms` | `{{syn}}` | `====Synonyms====` |
| `antonyms` | `{{ant}}` | `====Antonyms====` |
| `hypernyms` | `{{hyper}}` | `====Hypernyms====` |
| `hyponyms` | `{{hypo}}` | `====Hyponyms====` |
| `coordinate_terms` | — | `====Coordinate terms====` |
| `holonyms` | — | `====Holonyms====` |
| `meronyms` | — | `====Meronyms====` |
| `troponyms` | — | `====Troponyms====` |
| `comeronyms` | — | `====Comeronyms====` |
| `parasynonyms` | — | `====Parasynonyms====` |
| `collocations` | — | `====Collocations====` |

---

## 5. Schema changes

### 5.1 New `$defs` in JSON Schema

| Definition | File | Purpose |
|------------|------|---------|
| `RelationSourceEvidence` | `06-relations.yaml` | Enum: `template_id`, `section_scope`, `qualifier_match`, `heuristic` |
| `RelationConfidence` | `06-relations.yaml` | Enum: `high`, `medium`, `low` |
| `SemanticRelationsBySense` | `06-relations.yaml` | `Record<senseId, SemanticRelations>` |

### 5.2 Extended `SemanticRelation`

Three new optional properties on every relation item:

```yaml
SemanticRelation:
  properties:
    term: { type: string }        # (unchanged)
    sense_id: { type: string }    # (unchanged — source anchor)
    qualifier: { type: string }   # (unchanged)
    source_evidence:              # NEW
      $ref: '#/$defs/RelationSourceEvidence'
    confidence:                   # NEW
      $ref: '#/$defs/RelationConfidence'
    matched_sense_id:             # NEW
      type: string
```

### 5.3 New fields on `Lexeme` and `RichEntry`

| Interface | New field | Type |
|-----------|-----------|------|
| `Lexeme` | `semantic_relations_by_sense` | `SemanticRelationsBySense` (optional) |
| `RichEntry` | `relations_by_sense` | `SemanticRelationsBySense` (optional) |

---

## 6. TypeScript model changes

### `src/model/relations.ts`

```typescript
export type RelationSourceEvidence =
  | "template_id"
  | "section_scope"
  | "qualifier_match"
  | "heuristic";

export type RelationConfidence = "high" | "medium" | "low";

export interface SemanticRelation {
  term: string;
  sense_id?: string;
  qualifier?: string;
  source_evidence?: RelationSourceEvidence;    // NEW
  confidence?: RelationConfidence;              // NEW
  matched_sense_id?: string;                    // NEW
}

export interface SenseSemanticRelations extends SemanticRelations {
  sense_id: string;
}

export type SemanticRelationsBySense = Record<string, SemanticRelations>;
```

All new types are re-exported from `src/model/index.ts`.

---

## 7. Pipeline integration

The linking pass executes in `src/pipeline/wiktionary-core.ts` after all decoders have run and after form-of morph-line enrichment, but **before** lemma resolution and Wikidata enrichment:

```
decode → form-of-parse-enrich → linkRelationsToSenses → lemma resolution → wikidata
```

This ensures that senses are fully populated (including any subsenses from `##` lines) before the linker runs.

---

## 8. Convenience API

### Existing wrappers (unchanged)

```typescript
synonyms(query, lang?, pos?)   → GroupedLexemeResults<string[]>
antonyms(query, lang?, pos?)   → GroupedLexemeResults<string[]>
hypernyms(query, lang?, pos?)  → GroupedLexemeResults<string[]>
hyponyms(query, lang?, pos?)   → GroupedLexemeResults<string[]>
comeronyms(query, lang?, pos?) → GroupedLexemeResults<string[]>
parasynonyms(query, lang?, pos?) → GroupedLexemeResults<string[]>
collocations(query, lang?, pos?) → GroupedLexemeResults<string[]>
```

These continue to return flat term lists per lexeme.

### New sense-grouped wrappers

```typescript
synonymsBySense(query, lang?, pos?)
  → GroupedLexemeResults<Record<string, SemanticRelation[]>>

antonymsBySense(query, lang?, pos?)
  → GroupedLexemeResults<Record<string, SemanticRelation[]>>

relationsBySense(family, query, lang?, pos?)
  → GroupedLexemeResults<Record<string, SemanticRelation[]>>
```

The return type is keyed by sense ID. Each `SemanticRelation` includes `term`, `qualifier`, `source_evidence`, `confidence`, and `matched_sense_id`.

### `richEntry()` (enhanced)

The `relations_by_sense` field is now populated on `RichEntry` when sense-linked relations exist:

```typescript
const entry = await richEntry("bank", "en");
// entry.relations         → flat (unchanged)
// entry.relations_by_sense → { S1: { synonyms: [...] }, S2: { synonyms: [...] } }
```

---

## 9. Decoder enhancements

### `register-semantic-relations.ts`

The decoder now:

1. **Stamps evidence metadata at decode time** for template-based relations. When `id=` is present on `{{syn}}`, `{{ant}}`, `{{hyper}}`, or `{{hypo}}`, the item gets `source_evidence: "template_id"` and `confidence: "high"` immediately.

2. **Extracts parenthetical qualifiers from section bullet lines.** The new `parseSectionRelationItems()` function scans each line for patterns like `* (qualifier) {{l|…}}` and attaches the qualifier text to the relation item, with `source_evidence: "section_scope"` and `confidence: "medium"`.

This enhancement affects the raw `semantic_relations` data — items now carry richer metadata even before the linker runs.

---

## 10. Example output

### Input wikitext (simplified)

```wikitext
== English ==
=== Verb ===
{{en-verb}}
# To move quickly by foot.
# To operate a program.

{{syn|en|sprint|id=S1}}
{{syn|en|execute|id=S2}}

====Antonyms====
* (movement) {{l|en|walk}}
```

### Output (relevant fields)

```json
{
  "senses": [
    { "id": "S1", "gloss": "To move quickly by foot." },
    { "id": "S2", "gloss": "To operate a program." }
  ],
  "semantic_relations": {
    "synonyms": [
      {
        "term": "sprint",
        "sense_id": "S1",
        "source_evidence": "template_id",
        "confidence": "high",
        "matched_sense_id": "S1"
      },
      {
        "term": "execute",
        "sense_id": "S2",
        "source_evidence": "template_id",
        "confidence": "high",
        "matched_sense_id": "S2"
      }
    ],
    "antonyms": [
      {
        "term": "walk",
        "qualifier": "movement",
        "source_evidence": "section_scope",
        "confidence": "medium",
        "matched_sense_id": "S1"
      }
    ]
  },
  "semantic_relations_by_sense": {
    "S1": {
      "synonyms": [
        { "term": "sprint", "sense_id": "S1", "source_evidence": "template_id",
          "confidence": "high", "matched_sense_id": "S1" }
      ],
      "antonyms": [
        { "term": "walk", "qualifier": "movement", "source_evidence": "section_scope",
          "confidence": "medium", "matched_sense_id": "S1" }
      ]
    },
    "S2": {
      "synonyms": [
        { "term": "execute", "sense_id": "S2", "source_evidence": "template_id",
          "confidence": "high", "matched_sense_id": "S2" }
      ]
    }
  }
}
```

---

## 11. Known limitations and future work

| Limitation | Impact | Mitigation path |
|------------|--------|-----------------|
| **No `qualifier_match` evidence yet.** The `qualifier_match` variant (matching the relation's qualifier against a sense's qualifier, as opposed to its gloss) is defined in the enum but not produced by the current linker. | Moderate — some qualifier-based matches may score slightly lower. | Add qualifier-vs-qualifier scoring in a follow-up. |
| **Heuristic linking is best-effort.** Token overlap between a relation term and a sense gloss can produce false positives for very short glosses. | Low — threshold of 2 and stopword filtering mitigate most noise. | Optionally gate heuristic linking behind a flag if false positives appear in practice. |
| **Section-only families lack template-level sense anchors.** Families like `coordinate_terms`, `holonyms`, `meronyms`, etc. are only extracted from section headings, never from inline templates (unlike `{{syn}}`). | Medium — these families rely on qualifier or heuristic evidence. | Add decoders for `{{cot}}`, `{{hol}}`, `{{mer}}`, `{{tro}}` inline templates. |
| **Subsense matching.** The linker flattens subsenses into the candidate pool but does not prefer exact depth matches. | Low — IDs like `S1.1` still match correctly via `id=`. | Add depth-aware tie-breaking if needed. |
| **Single language (English).** Qualifier patterns like `* (gloss)` are English Wiktionary conventions. Other editions may differ. | Low — SDK targets en.wiktionary. | Parametrize qualifier extraction when multi-edition support is added. |

---

## 12. Code pointers

| Concern | Location |
|---------|----------|
| TypeScript model types | `src/model/relations.ts` |
| Lexeme field | `src/model/lexeme.ts` (`semantic_relations_by_sense`) |
| RichEntry field | `src/model/rich-entry.ts` (`relations_by_sense`) |
| Model barrel exports | `src/model/index.ts` |
| JSON Schema defs | `schema/src/defs/06-relations.yaml` |
| Lexeme schema | `schema/src/defs/91-lexeme.yaml` |
| RichEntry schema | `schema/src/defs/90-rich-entry.yaml` |
| Schema def registration | `tools/schema-def-modules.ts` |
| Decoder (evidence capture) | `src/decode/registry/register-semantic-relations.ts` |
| Sense-relation linker | `src/pipeline/sense-relation-linker.ts` |
| Pipeline integration | `src/pipeline/wiktionary-core.ts` |
| Convenience wrappers | `src/convenience/relations.ts` |
| RichEntry wrapper | `src/convenience/rich-entry.ts` |
| Tests | `test/sense-relation-linker.test.ts` |

---

*End of sense-level semantic relations documentation.*
