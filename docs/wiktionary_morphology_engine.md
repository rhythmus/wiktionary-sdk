# Wiktionary Morphological Engine: Lua, Scribunto, and Server-Side Extraction

## Overview
Wiktionary is not merely a collection of static text entries; it is a sophisticated **linguistic computation platform**. Behind the human-readable tables of conjugations and declensions lies a massive codebase of Lua scripts that dynamically generate morphological paradigms based on various input parameters.

This document provides a deep-dive into the technical internals of how Wiktionary’s morphological engine operates and how the **Wiktionary SDK** leverages this infrastructure.

---

## 1. The Technology Stack: Scribunto & Lua

### Scribunto Runtime
[Scribunto](https://www.mediawiki.org/wiki/Extension:Scribunto) is a MediaWiki extension that allows editors to embed scripting languages directly into wiki pages. While MediaWiki originally relied on complex, nested "Parser Functions", Scribunto introduced **Lua** as the primary language for heavy-duty data processing.

### Execution Environment & Limits
Scribunto Lua modules run in a highly restricted sandbox designed for extreme scalability. On `en.wiktionary.org`, these limits are strictly enforced:
- **CPU Time Limit**: 10 seconds of processing time per page request.
- **Memory Limit**: 50MB per page request.
- **Execution Engine**: `luasandbox` (a specialized PHP extension for direct Lua execution).

### The `mw.loadData()` Pattern
To stay within memory limits, Wiktionary uses `mw.loadData()` for high-volume lexical data (e.g., large lists of declension types or irregular roots). 
- **Efficiency**: Unlike `require()`, `mw.loadData()` parses the data module only once per page request, sharing the result across all `#invoke` calls.
- **Constraint**: The returned data must be a pure, static table and is strictly **read-only**.

---

## 2. Infrastructure: Modules vs. Templates

Wiktionary organizes its morphological logic into two layers:

### The `Module:` Namespace (The "Kernel")
This is where the actual Lua code resides.
- **Example**: [Module:fi-verbs](https://en.wiktionary.org/wiki/Module:fi-verbs) on English Wiktionary.
- These scripts contain the "grammar rules" of the language. They handle complex stem changes, consonant gradation, and ending attachments.
- **Tracing**: Every field returned by the `inflect()` function in this project can be traced back to the logic in these modules (or the Wikitext templates they populate).

### The `Template:` Namespace (The "API")
Templates act as the UI/API for editors. Instead of writing Lua directly, an editor writes:
```wikitext
{{el-conjug-1st|present=γράφ|a-simplepast=έγραψ|...}}
```
Behind the scenes, the template might perform a `#invoke` call:
```wikitext
{{#invoke:fi-verbs|show|...}}
```
This passes the parameters to a Lua module, which computes the table and returns a blob of HTML. 
*(Note: Some languages, like Modern Greek on en.wikt, still use nested Wikitext templates for this logic, but the **Wiktionary SDK** handles both identically.)*

---

## 3. How Wiktionary SDK Extracts Morphology

The core challenge is that **stems and inflections are not stored as text**. They are generated on-the-fly. To remain "source-faithful", Wiktionary SDK uses **Morphology through Execution**.

### Why `action=parse` over `expandtemplates`?
- **`action=expandtemplates`**: Returns expanded Wikitext. This would require the SDK to maintain its own "Wikitext to HTML" renderer.
- **`action=parse`**: Returns browser-ready HTML. This allows the SDK to use `node-html-parser` to structurally dissect the final DOM, reflecting exactly what a human sees on the site.

### The Pipeline:
1.  **Brace-Aware Capture**: The SDK uses a recursive parser to isolate the morphology template. Standard Regex is insufficient for capturing nested templates: `{{template|{{nested}}}}`.
2.  **API Call**: The raw text of the template call is sent to the `/w/api.php?action=parse` endpoint.
3.  **DOM Dissection**:
    *   The SDK scans for the `.inflection-table` or `.nav-view` CSS classes.
    *   It locates "Anchor Cells" (e.g., `<th>` cells with text like "singular", "aorist").
    *   It maps the intersecting `<td>` values back to the internal JSON schema.

---

## 4. Linguistic Deep-Dives: Module Minutiae

### Finnish (`Module:fi-verbs`)
Finnish has one of the most complex morphological engines due to **Consonant Gradation** (e.g., `kk` -> `k`, `p` -> `v`).
- **Type Number System**: Finnish templates use a "Type" number (1 to 100) which the Lua module uses as a key into a massive gradation matrix.
- **Recursion**: The module performs multi-stage transformations where a stem is graded, a vowel harmonized, and then an ending appended.

### Ancient Greek (`Module:grc-conj`)
Ancient Greek verbs are defined by **6 Principal Parts**.
- **The Engine**: The Lua logic manages "Vowel Augments" (prefixing *ε-*) and "Reduplication" (prefixing a repeated consonant for the perfect tense).
- **Variation**: The module handles dialectal variations (Attic vs. Ionic) via flag parameters.

---

## 5. Documentation & Open Source Status

### Where is it documented?
- **Technical Docs**: The [Extension:Scribunto](https://www.mediawiki.org/wiki/Extension:Scribunto/Lua_reference_manual) manual on MediaWiki.
- **Linguistic Docs**: Each language community maintains its own conventions (e.g., [Wiktionary:Greek_verbs](https://en.wiktionary.org/wiki/Wiktionary:Greek_verbs)).
- **Module Code**: Documentation is often embedded within the modules themselves or on their `/doc` subpages (e.g., `Module:fi-verbs/doc`).

### Is it Open Source?
- **Code License**: All Lua modules on Wiktionary are licensed under **Creative Commons Attribution-ShareAlike (CC BY-SA)** and the **GNU Free Documentation License (GFDL)**.
- **Portability**: While the code is open, it is highly dependent on the MediaWiki environment (the `mw` global object). Running these scripts locally requires a mocked MediaWiki API.

---

## 6. Language Coverage & Maturity

| Language Family | Maturity | Representative Modules | Details |
| :--- | :--- | :--- | :--- |
| **Hellenic** (Greek) | **High** | `Template:el-conjug-1st` | Implemented via complex Wikitext templates on `en.wikt` (Lua used on `el.wikt`). |
| **Germanic** (German, Dutch) | **High** | `Module:de-verb`, `Module:nl-verbs` | Fully automated declensions for strong/weak verbs and adjectives. |
| **Italic** (Latin, French) | **High** | `Module:la-verb`, `Module:fr-verb` | Highly regularized. Often uses a "principal parts" system. |
| **Slavic** (Russian, Polish) | **Medium** | `Module:ru-verb` | Very complex due to aspectual pairs; coverage is vast. |
| **Finno-Ugric** (Finnish) | **Very High** | `Module:fi-verbs` | Computational linguistics masterpiece; handles 100+ forms per lexeme. |

---

## 7. Performance & Verification

### L1 Memory Caching
The SDK maintains a persistent memory cache to deduplicate network requests. If multiple forms require the same morphological expansion, only one API call is fired.

### Forensic Verification
All captured template calls are stored in `entry.templates` verbatim. This allowed developers to see the exact raw "source" that generated any inflected form, ensuring full traceability.

### Debugging & Error Handling
- **Lua Errors**: If a script crashes (e.g., memory limit), the SDK identifies the specific error string within the HTML and surfaces it as a validation error.
- **Manual Verification**: Developers can inspect the `.inflection-table` class in the browser developer tools (F12) to verify the selectors used by the SDK.

---

## 8. Summary of Benefits
By piggybacking on the Wiktionary REST API for server-side expansion, **Wiktionary SDK** gains:
- **Instant Updates**: Community fixes to Lua scripts are reflected immediately.
- **No Linguistic Debt**: No need to maintain separate conjugation logic for every language.
- **Source Truth**: Parity with the exact forms considered correct by the Wiktionary project.
