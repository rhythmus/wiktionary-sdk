import type { SectionWithLinks } from "../types";
import { parseTemplates } from "../parser";
import { stripWikiMarkup } from "./strip-wiki-markup";
import { formatUsageNoteLine } from "./format-usage-note-line";
import type { DecoderRegistry } from "./decoder-registry";
import { extractSectionByLevelHeaders, parseSectionLinkTemplates } from "./section-extract";
import { registerCoreAndPronunciation } from "./register-core-pronunciation";
import { registerHeadwordsElNlDe } from "./register-headwords-el-nl-de";
import { registerFormOfWikidata } from "./register-form-of-wikidata";
import { registerTranslations } from "./register-translations";
import { registerSenses } from "./register-senses";
import { registerMorphologyLa } from "./register-morphology-la";
import { registerSemanticRelations } from "./register-semantic-relations";
import { registerEtymology } from "./register-etymology";
import { registerPronunciationExtra } from "./register-pronunciation-extra";

/**
 * Register all template/section decoders in **historical source order**.
 * Call once per {@link DecoderRegistry} instance (typically the package singleton).
 */
export function registerAllDecoders(reg: DecoderRegistry): void {
registerCoreAndPronunciation(reg);
registerHeadwordsElNlDe(reg);
registerFormOfWikidata(reg);
registerTranslations(reg);
registerSenses(reg);
registerMorphologyLa(reg);
registerSemanticRelations(reg);
registerEtymology(reg);
registerPronunciationExtra(reg);

/** Section / citation decoders (Derived terms … References); nested to close over {@link formatUsageNoteLine}. */
function registerSectionsAndCitationDecoders(): void {
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
            const patch: any = { entry: {} };
            for (let i = 0; i < SECTION_LINK_HEADERS.length; i++) {
                const header = SECTION_LINK_HEADERS[i];
                const field = SECTION_LINK_FIELDS[i];
                const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, header);
                if (!section || !section.raw) continue;
                const items = parseSectionLinkTemplates(section.raw);
                if (items.length === 0) continue;
                patch.entry[field] = { raw_text: section.raw, items } as SectionWithLinks;
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
registerSectionsAndCitationDecoders();

function registerInflectionTableAndStems(): void {
reg.register({
    id: "inflection-table-ref",
    handlesTemplates: [],
    matches: (ctx) => ctx.templates.some(t => t.name.startsWith("el-conj-") || t.name.startsWith("el-decl-") || t.name.startsWith("el-conjug-") || t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-")),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name.startsWith("el-conj-") || t.name.startsWith("el-decl-") || t.name.startsWith("el-conjug-") || t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-"));
        if (!t) return {};
        return {
            entry: {
                inflection_table_ref: {
                    template_name: t.name,
                    raw: t.raw,
                },
            },
        };
    },
});

/** --- High-Fidelity Greek Inflection Stems --- **/
reg.register({
    id: "el-verb-stems",
    handlesTemplates: ["el-conjug-1st", "el-conjug-2nd", "el-conjug-passive-1st", "el-conjug-passive-2nd"],
    matches: (ctx) => ctx.templates.some(t => t.name.startsWith("el-conjug-")),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name.startsWith("el-conjug-"));
        if (!t) return {};
        const named = t.params.named ?? {};
        const principal_parts: Record<string, string> = {};
        
        // Map stems to principal parts
        if (named.present) principal_parts["present"] = named.present + "ω";
        if (named["a-simplepast"]) principal_parts["aorist_active"] = named["a-simplepast"] + "α";
        if (named["p-simplepast"]) principal_parts["aorist_passive"] = named["p-simplepast"] + "α";
        if (named["p-perf-part"]) principal_parts["perfect_passive_participle"] = named["p-perf-part"] + "μένος";
        if (named["a-dependent"]) principal_parts["dependent_active"] = named["a-dependent"] + "ω";
        if (named["p-dependent"]) principal_parts["dependent_passive"] = named["p-dependent"] + "ω";
        
        return {
            entry: {
                headword_morphology: {
                    principal_parts: Object.keys(principal_parts).length > 0 ? principal_parts : undefined
                }
            }
        };
    }
});

reg.register({
    id: "el-noun-stems",
    handlesTemplates: [],
    matches: (ctx) => ctx.templates.some(t => t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-")),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-"));
        if (!t) return {};
        const stem = t.params.positional?.[0] || "";
        if (!stem) return {};
        
        const gender = t.name.startsWith("el-nM-") ? "masculine" : (t.name.startsWith("el-nF-") ? "feminine" : (t.name.startsWith("el-nN-") ? "neuter" : undefined));
        return {
            entry: {
                headword_morphology: {
                    ...(gender ? { gender } : {}),
                    principal_parts: {
                        "stem": stem
                    }
                }
            }
        };
    }
});
}
registerInflectionTableAndStems();
}
