# Wiktionary SDK: Implementation Roadmap (post-v1.0)

This roadmap proposes the next implementation stages for the
`wiktionary-sdk` ecosystem.

## Principles (non-negotiable)

- **Extraction, not inference**: only extract what is explicitly present in
  Wikitext/template parameters.
- **Traceability**: every structured field must be traceable to a source
  template, line, or section; store verbatim raw text alongside decoded data
  when practical.
- **Registry-first**: mapping/decoding logic lives in `src/registry.ts`, not in
  the parser or orchestration layer.

---

**All planned stages (0–8) are complete.** This document is retained for
reference. Future work can be added here as new stages.
