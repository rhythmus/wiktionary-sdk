# Staged implementation plan (remaining work only)

**Status:** This roadmap tracks only open work.  
**Source of truth for delivered work:** `CHANGELOG.md` (including roadmap history).

**Normative constraints:** `docs/wiktionary-sdk-spec.md` and `AGENTS.md` remain authoritative for behavior and contracts.

---

## Working rules

- Keep extraction source-faithful (no inference).
- Preserve cross-interface parity (`src/convenience/`, CLI, webapp, REST).
- For structural API/model changes: update schema/docs/tests in the same phase.
- Keep phases mergeable and testable (`npm run test:ci`, plus `webapp` build when touched).

---

## New phased sequence

### Phase A — Hardening leftovers (short-term)

**Goal:** close remaining correctness/operability gaps before new feature surfaces.

| # | Work item | Why now |
|---|-----------|---------|
| A.1 | Add bounded wait support in `mwFetchJson` (`timeoutMs` and/or caller `signal`) and document defaults by runtime. | Prevent indefinite hangs in CLI/server workflows. |
| A.2 | Finalize wrapper `.d.ts` honesty where `mapLexemes` is used (`GroupedLexemeResults<T>` parity sweep). | Avoid API/type mismatch for consumers. |
| A.3 | Confirm no undocumented module-cycle regressions (especially convenience -> barrel edges). | Keep refactors safe and tree-shaking predictable. |
| A.4 | Review REST/CLI parity matrix for new/changed knobs and document any intentional asymmetry. | Keep user-facing interfaces predictable. |

**Exit criteria (Phase A):**
- `mwFetchJson` has documented bounded-wait behavior.
- Wrapper return types are consistent with runtime grouped results.
- Parity expectations are explicit in docs/tests.

---

### Phase B — Lexicographic export formats (product track)

**Goal:** ship standard export formats beyond current Handlebars views.

| # | Work item | Deliverable |
|---|-----------|-------------|
| B.1 | Semantic HTML5 formatter style. | `semantic-html` style + tests/snapshots. |
| B.2 | TEI Lex-0 fragment serializer. | TEI output + mapping table in spec. |
| B.3 | ODXML (ODict) full serializer. | Schema-compliant ODXML + lossy-field policy docs. |
| B.4 | OntoLex-Lemon JSON-LD. | Graph serializer + fixture tests. |
| B.5 | LMF / XDXF follow-up. | Prioritized by demand after B.1-B.4. |

**Constraints:**
- Fragment-first where appropriate.
- No synthetic data beyond extractor guarantees.
- Maintain environment-agnostic template/asset bundling.

---

### Phase C — Platform expansion and long-horizon initiatives

**Goal:** expand scope without weakening core extraction guarantees.

| # | Work item | Scope boundary |
|---|-----------|----------------|
| C.1 | Alternative-form recursive resolution strategy. | Optional and bounded; cycle-safe. |
| C.2 | Non-`en.wiktionary` support research. | Site parameter + heading/template normalization strategy. |
| C.3 | Persistent cache adapters (SQLite/IndexedDB/Redis). | Adapter APIs + invalidation guidance. |
| C.4 | Ongoing decoder expansion from category coverage reports. | Fixture-backed evidence discipline. |
| C.5 | T2D Layer 2 (sense disambiguation/token->lemma/vector store). | Consumer-layer, not core extractor logic. |
| C.6 | SPARQL/Hybrid enrichment research. | Explicitly non-core until product asks. |

---

## Cross-reference (remaining only)

| Spec §15 topic | Roadmap phase |
|----------------|---------------|
| Non–en.wiktionary | Phase C.2 |
| Decoder expansion | Phase C.4 |
| Persistent cache adapters | Phase C.3 |
| Standard lexicographic exports | Phase B |
| Sense disambiguation layer (T2D) | Phase C.5 |

---

*End of remaining-work roadmap.*
