# WiktionaryFetch: Exhaustive Implementation Roadmap

This document outlines the detailed, staged evolution of the WiktionaryFetch engine, transitioning from a v1.0 Alpha to a production-grade, 100% coverage extraction ecosystem for Greek lexicographic data.

---

## 🏛️ Phase 1: DX, Quality & Observability [COMPLETED]
**Goal**: Stabilize the existing engine and provide developers with tools to debug and verify extraction logic deterministically.

### 1.1 Developer Inspector UI
- **Status**: **DONE** (Implemented as a premium React dashboard in `/webapp`).
- **Details**: Real-time inspection of matched decoders, extracted fields, and raw wikitext.

### 1.2 Library Modularization
- **Status**: **DONE** (Core logic extracted into `/src`).
- **Details**: Tree-shakeable TypeScript modules for API, Parser, Registry, and Utils.

---

## 🧠 Phase 2: Semantic & Linguistic Depth
**Goal**: Extract deeper structural meaning from entries without crossing into linguistic inference.

### 2.1 Sense-Level Structuring
- **Task**: Parse numbered definition lines (`#`) into structured `Sense` objects.
- **Details**: Identify glosses, nested definitions (`##`), and distinguish from examples (`#: `).
- **Output**: Each sense becomes a node with its own unique ID.

### 2.2 Semantic Relations
- **Task**: Decode `{{syn}}`, `{{ant}}`, `{{hyper}}`, and `{{hypo}}` templates.
- **Details**: Map synonyms, antonyms, hypernyms, and hyponyms to specific senses where possible.

### 2.3 Structured Etymology & Cognates
- **Task**: Deeply decode relationship templates (`{{inh}}`, `{{der}}`, `{{bor}}`, `{{cog}}`).
- **Details**: Capture source language, target lemma, and raw parameters to build a local etymological graph.

### 2.4 Advanced Pronunciation (IPA/Audio)
- **Task**: Exhaustive decoding of `{{el-IPA}}` and `{{audio}}`.
- **Details**: Extract multiple variants (e.g., standard vs. dialectal pronunciation) and map to CDN-ready Commons URLs.

### 2.5 Usage Notes & Inflection Notes
- **Task**: Extract text from `===Usage notes===` and template-specific footers.
- **Details**: Capture register (e.g., informal, archaic) and specific constraints on form usage.

---

## 🚀 Phase 3: Total Coverage & Scalability
**Goal**: Move from selective template support to exhaustive coverage and production reliability.

### 3.1 Template Introspection Engine (Auto-Discovery)
- **Task**: Build a crawler that explores the "Greek template categories" on Wiktionary.
- **Goal**: 100% support for `Category:Greek headword-line templates` and `Category:Greek inflection-table templates`.
- **Feature**: A "Missing Decoder Report" that alerts developers when a new template appears in the wild.

### 3.2 Production Caching Layer
- **Task**: Implement a sophisticated multi-tier cache.
- **Details**: 
    - L1: In-memory (transient).
    - L2: Persistent (IndexedDB for Web / SQLite for Node).
    - L3: Shared (Redis if deployed as a service).

### 3.3 Rate Limiting & Proxy Management
- **Task**: Implement robust MediaWiki API etiquette.
- **Details**: Custom User-Agents, request throttling, and optional proxy rotation for high-volume batch processing.

---

## 🌐 Phase 4: Multi-Client & Distribution
**Goal**: Broaden the reach of the engine through diverse consumption patterns.

### 4.1 CLI Tool (`cli/`)
- **Task**: Create a standalone Node.js CLI tool.
- **Features**: `wiktionary-fetch <term> --lang=el --format=yaml`. Support for batch CSV/JSON processing.

### 4.2 NPM Package Distribution
- **Task**: Publish the core engine to an registry (e.g., `@woutersoudan/wiktionary-fetch`).
- **Details**: Dual ESM/CJS build pipeline with automated versioning (semantic-release).

### 4.3 Containerization
- **Task**: Provide a Docker-ready microservice version.
- **Details**: A lightweight Express/Fastify API wrapper for the engine.

---

## ⚖️ Phase 5: Quality & Engineering Excellence
**Goal**: Ensure the library is robust, documented, and easy to maintain.

### 5.1 Gold Standard Test Suite
- **Task**: Regression testing against 100+ canonical "complex" entries.
- **Technology**: Vitest / Playwright for end-to-end extraction verification.

### 5.2 Automated API Documentation
- **Task**: Generate TypeDoc outputs for the core library.
- **Details**: Host a searchable documentation site for library consumers.

### 5.3 Benchmarking & Optimization
- **Task**: Performance audit of the brace-aware parser.
- **Goal**: Ensure sub-10ms parsing time for large entries (e.g., high-frequency verbs).

---

## 🎨 Phase 6: Webapp Polish & Evolution
**Goal**: Make the visual verification tool more powerful for linguistic research.

### 6.1 Interactive Template Inspector
- **Task**: Allow users to click on any part of the YAML output to highlight the source wikitext in the left pane.
- **Feature**: "Debugger Mode" to see exactly which decoder rule matched which template.

### 6.2 Comparison View
- **Task**: Compare the same word across different languages or etymology blocks side-by-side.

---

## 📜 Instructions for Developers

### Core Principles
- **No Scraped HTML**: If the data isn't in the Wikitext/API, it doesn't exist for this engine.
- **No Linguistic Inference**: We extract *what is there*, not what *should be there*.
- **Traceability**: Every field in the `NormalizedEntry` must lead back to a source line or template.

### For AI Agents
- **Decoder Registry**: Always check `registry.ts` before adding new mapping logic. Keep decoders atomic.
- **Strict Typing**: Update `types.ts` before implementing new features to ensure contract consistency.
