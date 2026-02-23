# WiktionaryFetch: Staged Implementation Roadmap

This document outlines the detailed, staged evolution of the WiktionaryFetch engine, transitioning from a v0.9 prototype to a production-grade, 100% coverage extraction service for Greek lexicographic data.

---

## 🏛️ Phase 1: DX, Quality & Observability [COMPLETED]
**Goal**: Stabilize the existing engine and provide developers with the tools to debug and verify extraction logic deterministically.

### 1.1 Developer Inspector UI
- **Status**: **DONE** (Implemented as a premium React dashboard with live preview and YAML highlighting).
- **Details**: The new web client provides a real-time inspection of matched decoders and extracted fields.


### 1.2 JSON Schema & Versioning
- **Task**: Formalize the `NormalizedEntry` output using JSON Schema.
- **Details**: Define strict types for POS, features (person, number, etc.), and source metadata. Implement semantic versioning for the output format.
- **AI Instruction**: Generate TypeScript interfaces directly from the JSON Schema to ensure a single source of truth.

### 1.3 Gold Standard Test Suite
- **Task**: Create a regression suite containing canonical Greek test cases (e.g., *γράφω*, *έγραψα*, *καλός*, *άνθρωπος*).
- **Details**: Ensure no future change reintroduces heuristics or breaks existing template mapping.

---

## 🧠 Phase 2: Semantic Depth
**Goal**: Extract deeper structural meaning from entries without crossing into linguistic inference.

### 2.1 Sense-Level Structuring
- **Task**: Parse numbered definition lines (`#`) into structured `Sense` objects.
- **Details**: Each sense should have an index, gloss, and optional example sentences.
- **AI Instruction**: Use regex or a line-based parser to identify `#` markers within PoS blocks.

### 2.2 Structured Etymology
- **Task**: Decode relationship templates (`{{inh}}`, `{{der}}`, `{{bor}}`) inside etymology sections.
- **Details**: Capture source language, target lemma, and raw parameters.
- **Human Instruction**: Prioritize Greek-to-Ancient-Greek and Greek-to-PIE mappings.

### 2.3 Pronunciation & Media Expansion
- **Task**: Capture `{{audio}}` templates and map them to Wikimedia Commons URLs.
- **Details**: Include syllabification if present in the `{{el-IPA}}` or dedicated templates.

### 2.4 Homonym Disambiguation
- **Task**: Implement stable addressing for terms with multiple etymologies or PoS (e.g., `el:γράφω#1`).
- **Details**: Ensure the `id` field is deterministic and persists across fetches.

---

## 🚀 Phase 3: Scalability & Coverage
**Goal**: Move from selective template support to exhaustive coverage and production reliability.

### 3.1 Template Introspection Engine
- **Task**: Build a crawler that explores the "Greek template categories" on Wiktionary.
- **Details**: Dynamically discover new inflection and headword templates via the MediaWiki API (`categorymembers`).
- **AI Instruction**: Implement a "Registry Generator" that can output a report of uncovered templates found in the wild.

### 3.2 Production Caching & Rate Limiting
- **Task**: Implement a client-side caching layer (IndexedDB) with Time-To-Live (TTL).
- **Details**: Add request throttling for Wikidata and MediaWiki APIs to avoid 429 errors.

---

## 🌐 Phase 4: Ecosystem Integration
**Goal**: Prepare WiktionaryFetch to be the foundation for higher-level linguistic services.

### 4.1 "Layer 2" Handover (Morphology Engine)
- **Task**: Ensure the Normalized YAML contains all "invariants" (stems, class markers) required for a separate Morphology Engine to generate paradigms.
- **Note**: **STRICT SCOPE GUARD**: No generation logic should be added to WiktionaryFetch itself.

---

## 📜 Instructions for Developers

### For Human Developers
- **Audit Decoders**: Periodically review the "Ignored Parameters" in the Inspector UI. If a parameter carries consistent linguistic value, add it to the decoder.
- **No Heuristics**: If you find yourself writing a regex to "guess" a stem from a string, stop. The stem must come from a template parameter or be left to the Layer 2 engine.

### For AI Agents
- **Traceability First**: Every `NormalizedEntry` field should ideally have a `source` property pointing to the specific template or line it was derived from.
- **Modular Decoders**: Follow the `TemplateDecoder` interface strictly. Keep decoders pure and side-effect free.
- **Defensive Parsing**: Wikitext structure can vary. Always provide fallbacks and handle missing template parameters gracefully without throwing errors.
