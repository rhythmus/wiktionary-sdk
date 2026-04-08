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
| C.5 | T2D Layer 2 (sense disambiguation/token→lemma/vector store). **Partial delivery:** Wikidata disambiguation resolution (score >= 4 winner promotion to `wikidata.qid` and `sense.wikidata_qid`, `Q4167410` filtering, rendering suppression, webapp deduplication/hoisting) — see CHANGELOG `[Unreleased]`. Remaining: broader consumer-layer sense disambiguation beyond Wikidata page-type matching. | Consumer-layer, not core extractor logic. |
| C.6 | SPARQL/Hybrid enrichment research. | Explicitly non-core until product asks. |

---

### Phase D — Multilingual translation dictionary (product track)

**Goal:** evolve the webapp from a monolingual dictionary viewer into a bilingual/multilingual translation dictionary, and provide the SDK infrastructure for consumers to build translation-oriented applications.

**Context:** The SDK already has substantial translation infrastructure that is underutilized. `translate(query, sourceLang, targetLang, options)` supports `mode: "gloss"` (structured `{{t}}`/`{{t+}}` data from en.wiktionary Translation sections) and `mode: "senses"` (native-language definitions scraped from `${targetLang}.wiktionary.org` via `getNativeSenses`). The webapp now exposes a source/target language pair in the search bar (source defaults to "All languages", target defaults to English), but the target language is not yet wired into the rendering pipeline. `langlinks` (interwiki) data is fetched on every `wiktionary()` call but never used to drive cross-wiki title resolution.

| # | Work item | Description | Depends on |
|---|-----------|-------------|------------|
| D.1 | **Wire `targetLang` into dictionary card rendering.** | Pass `targetLang` from webapp state through block components to `format()`. In `prepareLexemeHtmlContext` (`format-core.ts`), inject `target_translations` from `lexeme.translations[targetLang]` when a target is selected. Add a `{{#if target_translations}}` block to `entry.html.hbs` and `lexeme-homonym-group.html.hbs`. When `targetLang` is empty, omit entirely (backward-compatible). Style translations with distinct visual treatment (indented, different weight, target-language flag label). | — |
| D.2 | **Bilingual dictionary card layout.** | New `FormatMode` option (`"bilingual-html-fragment"`) producing a two-column or stacked bilingual layout. Source senses rendered normally; each sense followed by its sense-keyed translations (using the `sense` field on `TranslationItem` to align translations with specific glosses from `{{trans-top|…}}`). Headword line gains target-language equivalent(s) as a subtitle (e.g., **γράφω** → *to write*). Flat fallback list when sense matching fails. | D.1 |
| D.3 | **Improve `getNativeSenses` and expose as public API.** | Expand the `langHeaders` map beyond the current 5 languages. Use `langlinks` data to resolve the correct target-wiki title (which may differ from the en.wiktionary title — e.g., en `"write"` → nl `"schrijven"`). New public convenience function `nativeSenses(query, sourceLang, targetLang)` combining langlinks resolution + foreign-wiki definition scraping. Cache foreign-wiki responses through `TieredCache` with a separate key prefix (`native:${targetLang}:${title}`). | D.1 |
| D.4 | **Webapp auto-fetch of native senses.** | When `targetLang` is set and is not English, auto-call `nativeSenses()` after the primary fetch and display foreign-language definitions in the bilingual card alongside (or instead of) English glosses. Respect rate limiting and show loading states for the secondary fetch. | D.2, D.3 |
| D.5 | **UI localization / i18n framework (webapp chrome).** | Add a lightweight i18n layer (custom JSON locale map + React context, or `react-i18next` if appropriate). Extract ~50-80 distinct UI strings from `App.tsx` and Handlebars helpers into locale files (`webapp/src/locales/{en,el,nl,...}.json`). Add a `sectionLabel` Handlebars helper that maps canonical keys (`"etymology"`, `"pronunciation"`, etc.) to localized heading strings. Locale selection derived from `targetLang` or a separate UI language picker. | — (parallel) |
| D.6 | **Full cross-wiki extraction pipeline.** | Run the full decoder pipeline against non-en.wiktionary editions, producing normalized `Lexeme` objects from el.wiktionary.org, nl.wiktionary.org, etc. Requires: `WikiEdition` config type specifying heading patterns and template families; edition-specific decoder registration or edition-aware dispatch; `wiktionary({ query, site: "el.wiktionary.org" })` parameter; separate test fixtures per edition. | C.2 |

**Key design decisions:**
- **Sense-level translation alignment (D.2):** `TranslationItem.sense` (the `{{trans-top|…}}` gloss) is matched to `Sense.gloss` via fuzzy token overlap. When matching fails, translations fall through to a flat list at the bottom of the entry.
- **Title resolution for foreign wikis (D.3):** Use `langlinks[targetLang].title` as the preferred lookup title for `getNativeSenses`, falling back to the source lemma string when langlinks data is absent.
- **UI locale vs content locale (D.5):** These are independent axes. Content is already multilingual (Wiktionary provides it); UI chrome localization is a separate concern. D.5 can proceed independently of D.1-D.4.
- **Cross-wiki pipeline scope (D.6):** This is a multi-month effort that fundamentally changes the SDK's scope. D.1-D.4 provide a compelling bilingual experience without it, using `getNativeSenses` + `langlinks` title resolution. D.6 is deferred until the product need is clear.

**Exit criteria (Phase D, minimal):**
- D.1 delivered: target-language translations visible in dictionary cards when a target is selected.
- D.2 delivered: bilingual layout with sense-aligned translations.
- D.3 delivered: `nativeSenses()` as a public API with langlinks title resolution and expanded language coverage.

---

## Cross-reference (remaining only)

| Spec §15 topic | Roadmap phase |
|----------------|---------------|
| Non–en.wiktionary | Phase C.2, Phase D.6 |
| Decoder expansion | Phase C.4 |
| Persistent cache adapters | Phase C.3 |
| Standard lexicographic exports | Phase B |
| Sense disambiguation layer (T2D) | Phase C.5 |
| Multilingual translation dictionary | Phase D |

---

*End of remaining-work roadmap.*
