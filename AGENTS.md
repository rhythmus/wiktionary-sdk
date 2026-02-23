# AI Agent Onboarding & Technical Constraints

This document provides specialized context for AI coding assistants working on the `wiktionary-fetch` project.

---

## 🎯 Core Mission
**Source-faithful extraction over linguistic inference.**
We extract what is *explicitly* in the Wikitext. We do not guess stems, complete paradigms, or infer data not found in template parameters.

---

## 🏗️ Architectural Anchors

### 1. Registry-Based Decoders (`src/registry.ts`)
The engine is a decentralized registry of pure functions (`TemplateDecoder`). 
- **Pattern**: If a template exists in the wild, create a decoder for it.
- **Strict Rule**: Do not add mapping logic to the parser or orchestrator. Keep it in `registry.ts`.

### 2. Brace-Aware Parser (`src/parser.ts`)
A custom parser handles nested `{{...}}` structures. 
- **Context**: Standard regex is insufficient for Wikitext. Always use the provided parser to extract `TemplateCall` objects.

### 3. Entry Types (`src/types.ts`)
- `LEXEME`: A lemma (e.g., γράφω).
- `INFLECTED_FORM`: A specific form (e.g., έγραψε) that maps to a lemma.

---

## ⚖️ Rigid Constraints & "No Heuristics" Policy

1.  **No Scraping**: Never attempt to scrape the rendered Wiktionary HTML. Always use the MediaWiki API provided in `api.ts`.
2.  **No linguistic "Guessing"**: If a stem or gender is missing from a headword template, do not attempt to calculate it. Leave the field undefined.
3.  **Traceability**: Every field added to a `NormalizedEntry` must be traceable to a source line or template parameter.
4.  **Verbatim Storage**: All template calls must be stored verbatim in `entry.templates` for forensic verification.

---

## 🛠️ How to Add Support for a New Template

1.  **Identify**: Find the template on Wiktionary (e.g., `{{el-noun-m-ος-2}}`).
2.  **Define**: Update `types.ts` if a new PoS-specific interface is needed.
3.  **Implement**: Create a new `TemplateDecoder` in `registry.ts`.
4.  **Verify**: Run a search for a word using that template in the `/webapp` and inspect the YAML output.

---

## 📚 Essential Reading
- [Wiktionary-Fetch Spec](file:///Users/woutersoudan/Desktop/wiktionary-fetch/docs/wiktionary-fetch-spec.md) (Ground Truth)
- [Roadmap](file:///Users/woutersoudan/Desktop/wiktionary-fetch/docs/ROADMAP.md) (Context for Phase 2-6)
