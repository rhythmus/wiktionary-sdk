import { parseTemplates } from "../../parse/parser";
import type { SectionWithLinks } from "../../model";
import type { DecoderRegistry } from "./decoder-registry";
import { formatUsageNoteLine } from "./format-usage-note-line";
import { extractSectionByLevelHeaders, parseSectionLinkTemplates } from "./section-extract";
import { stripWikiMarkup } from "./strip-wiki-markup";

/** Derived/related/descendants, alternative forms, see-also, anagrams, usage notes, references. */
export function registerSections(reg: DecoderRegistry): void {
    const SECTION_LINK_HEADERS = ["Derived terms", "Related terms", "Descendants"] as const;
    const SECTION_LINK_FIELDS = ["derived_terms", "related_terms", "descendants"] as const;

    reg.register({
        id: "section-links",
        handlesTemplates: ["l", "link"],
        matches: (ctx) => {
            const txt = ctx.posBlockWikitext;
            return SECTION_LINK_HEADERS.some((h) => new RegExp(`^=+\\s*${h}\\s*=+`, "im").test(txt));
        },
        decode: (ctx) => {
            const patch: { entry: Record<string, SectionWithLinks> } = { entry: {} };
            for (let i = 0; i < SECTION_LINK_HEADERS.length; i++) {
                const header = SECTION_LINK_HEADERS[i];
                const field = SECTION_LINK_FIELDS[i];
                const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, header);
                if (!section || !section.raw) continue;
                const items = parseSectionLinkTemplates(section.raw);
                if (items.length === 0) continue;
                patch.entry[field] = { raw_text: section.raw, items };
            }
            if (Object.keys(patch.entry).length === 0) return {};
            return patch;
        },
    });

    reg.register({
        id: "alternative-forms",
        handlesTemplates: [],
        matches: (ctx) => /^=+\s*Alternative forms\s*=+/im.test(ctx.posBlockWikitext),
        decode: (ctx) => {
            const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "Alternative forms");
            if (!section) return {};
            const items: Array<{ term: string; qualifier?: string; raw: string }> = [];
            for (const line of section.raw.split("\n")) {
                const trimmed = line.replace(/^\*\s*/, "").trim();
                if (!trimmed) continue;
                const tpls = parseTemplates(trimmed);
                const lTpl = tpls.find((t) => t.name === "l" || t.name === "link" || t.name === "alt");
                if (lTpl) {
                    const pos = lTpl.params.positional ?? [];
                    const term = lTpl.name === "alt" ? (pos[1] ?? "") : (pos[1] ?? "");
                    const qualifier = lTpl.params.named?.["qual"] || lTpl.params.named?.["q"] || undefined;
                    if (term) items.push({ term, qualifier, raw: trimmed });
                } else {
                    const m = trimmed.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
                    if (m) items.push({ term: m[1].trim(), raw: trimmed });
                }
            }
            if (items.length === 0) return {};
            return { entry: { alternative_forms: items } };
        },
    });

    reg.register({
        id: "see-also",
        handlesTemplates: [],
        matches: (ctx) => /^=+\s*See also\s*=+/im.test(ctx.posBlockWikitext),
        decode: (ctx) => {
            const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "See also");
            if (!section) return {};
            const terms: string[] = [];
            for (const line of section.raw.split("\n")) {
                const trimmed = line.replace(/^\*\s*/, "").trim();
                if (!trimmed) continue;
                const tpls = parseTemplates(trimmed);
                for (const t of tpls) {
                    if (t.name === "l" || t.name === "link") {
                        const term = t.params.positional?.[1];
                        if (term) terms.push(term);
                    }
                }
                const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
                let m;
                while ((m = re.exec(trimmed)) !== null) {
                    if (!terms.includes(m[1].trim())) terms.push(m[1].trim());
                }
            }
            if (terms.length === 0) return {};
            return { entry: { see_also: terms } };
        },
    });

    reg.register({
        id: "anagrams",
        handlesTemplates: [],
        matches: (ctx) => /^=+\s*Anagrams\s*=+/im.test(ctx.posBlockWikitext),
        decode: (ctx) => {
            const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "Anagrams");
            if (!section) return {};
            const anagrams: string[] = [];
            for (const line of section.raw.split("\n")) {
                const trimmed = line.replace(/^\*\s*/, "").trim();
                if (!trimmed) continue;
                const tpls = parseTemplates(trimmed);
                for (const t of tpls) {
                    if (t.name === "l" || t.name === "link") {
                        const term = t.params.positional?.[1];
                        if (term) anagrams.push(term);
                    }
                }
                if (anagrams.length === 0 || !tpls.some((t) => t.name === "l" || t.name === "link")) {
                    const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
                    let m;
                    while ((m = re.exec(trimmed)) !== null) {
                        const term = m[1].trim();
                        if (!anagrams.includes(term)) anagrams.push(term);
                    }
                }
                if (!trimmed.includes("{{") && !trimmed.includes("[[") && trimmed.match(/^[\w\s,]+$/)) {
                    for (const word of trimmed.split(",").map((s) => s.trim()).filter(Boolean)) {
                        if (!anagrams.includes(word)) anagrams.push(word);
                    }
                }
            }
            if (anagrams.length === 0) return {};
            return { entry: { anagrams } };
        },
    });

    reg.register({
        id: "usage-notes",
        handlesTemplates: [],
        matches: (ctx) => /^=+\s*(Usage notes|Notes)\s*=+/im.test(ctx.posBlockWikitext),
        decode: (ctx) => {
            let section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "Usage notes");
            if (!section) section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "Notes");
            if (!section) return {};
            const notes = section.raw.split("\n").map(formatUsageNoteLine).filter(Boolean);
            if (notes.length === 0) return {};
            return { entry: { usage_notes: notes } };
        },
    });

    reg.register({
        id: "references",
        handlesTemplates: [],
        matches: (ctx) => /^=+\s*References\s*=+/im.test(ctx.posBlockWikitext),
        decode: (ctx) => {
            const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "References");
            if (!section) return {};
            const refs = section.raw.split("\n").map((l) => stripWikiMarkup(l).trim()).filter(Boolean);
            if (refs.length === 0) return {};
            return { entry: { references: refs } };
        },
    });
}
