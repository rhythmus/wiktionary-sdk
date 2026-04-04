import type { EtymologyLink, SectionWithLinks, TemplateCall } from "../types";
import { parseTemplates } from "../parser";
import { stripWikiMarkup } from "./strip-wiki-markup";
import { formatUsageNoteLine } from "./format-usage-note-line";
import type { DecoderRegistry } from "./decoder-registry";
import {
    extractSectionByLevelHeaders,
    matchesSectionHeading,
    parseSectionLinkTemplates,
} from "./section-extract";
import { registerCoreAndPronunciation } from "./register-core-pronunciation";
import { registerHeadwordsElNlDe } from "./register-headwords-el-nl-de";
import { registerFormOfWikidata } from "./register-form-of-wikidata";
import { registerTranslations } from "./register-translations";
import { registerSenses } from "./register-senses";
import { registerMorphologyLa } from "./register-morphology-la";

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

/** --- Phase 2.2: Semantic relations --- **/

const RELATION_TEMPLATES: Record<string, keyof import("../types").SemanticRelations> = {
    syn: "synonyms",
    ant: "antonyms",
    hyper: "hypernyms",
    hypo: "hyponyms",
};

const RELATION_HEADERS = {
    "Synonyms": "synonyms",
    "Antonyms": "antonyms",
    "Hypernyms": "hypernyms",
    "Hyponyms": "hyponyms",
    "Coordinate terms": "coordinate_terms",
    "Holonyms": "holonyms",
    "Meronyms": "meronyms",
    "Troponyms": "troponyms",
} as const;

reg.register({
    id: "semantic-relations",
    handlesTemplates: ["syn", "ant", "hyper", "hypo"],
    matches: (ctx) =>
        ctx.templates.some((t) => Object.keys(RELATION_TEMPLATES).includes(t.name)) ||
        Object.keys(RELATION_HEADERS).some((h) => matchesSectionHeading(ctx.posBlockWikitext, h)),
    decode: (ctx) => {
        const relations: import("../types").SemanticRelations = {};
        
        // 1. Template-based relations
        for (const t of ctx.templates) {
            const key = RELATION_TEMPLATES[t.name];
            if (!key) continue;
            const pos = t.params.positional ?? [];
            const lang = pos[0];
            if (!lang) continue;
            const terms = pos.slice(1).filter(Boolean);
            const qualifier = t.params.named?.["q"] || undefined;
            const senseId = t.params.named?.["id"] || undefined;
            if (!relations[key]) relations[key] = [];
            for (const term of terms) {
                relations[key]!.push({ term, sense_id: senseId, qualifier });
            }
        }

        // 2. Section-based relations (====Synonyms====)
        for (const [header, field] of Object.entries(RELATION_HEADERS)) {
            const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, header);
            if (section) {
                const items = parseSectionLinkTemplates(section.raw);
                if (items.length > 0) {
                    if (!relations[field as keyof import("../types").SemanticRelations]) 
                        relations[field as keyof import("../types").SemanticRelations] = [];
                    for (const item of items) {
                        relations[field as keyof import("../types").SemanticRelations]!.push({ 
                            term: item.term, 
                            qualifier: item.gloss 
                        });
                    }
                }
            }
        }

        if (Object.keys(relations).length === 0) return {};
        for (const key of Object.keys(relations) as Array<keyof import("../types").SemanticRelations>) {
            const values = relations[key];
            if (!values || values.length === 0) continue;
            const seen = new Set<string>();
            relations[key] = values.filter(v => {
                const sig = `${v.term}::${v.sense_id || ""}::${v.qualifier || ""}`;
                if (seen.has(sig)) return false;
                seen.add(sig);
                return true;
            });
        }
        return { entry: { semantic_relations: relations } };
    },
});

/** --- Phase 2.3: Structured etymology & cognates (v2) --- **/

const ETYMOLOGY_ANCESTOR_TEMPLATES = new Set([
    "inh", "inherited", "der", "derived", "bor", "borrowed",
    "back-formation", "clipping", "short for", "abbreviation",
    "affix", "compound", "prefix", "suffix", "confix", "blend"
]);
const ETYMOLOGY_COGNATE_TEMPLATES = new Set(["cog", "cognate", "noncognate", "nc"]);
const ALL_ETYMOLOGY_TEMPLATES = new Set([...ETYMOLOGY_ANCESTOR_TEMPLATES, ...ETYMOLOGY_COGNATE_TEMPLATES]);

const TEMPLATE_RELATION_MAP: Record<string, string> = {
    inh: "inherited", inherited: "inherited",
    der: "derived",  derived: "derived",
    bor: "borrowed", borrowed: "borrowed",
    "back-formation": "back-formation",
    clipping: "clipping",
    "short for": "clipping",
    abbreviation: "clipping",
    affix: "affix",
    compound: "compound",
    prefix: "prefix",
    suffix: "suffix",
    confix: "confix",
    blend: "blend",
    cog: "cognate", cognate: "cognate", noncognate: "cognate", nc: "cognate",
    // These might appear in etymology sections too
    "alternative form of": "alternative",
    "alt form": "alternative",
    "alt form of": "alternative",
};

/** Strip [[links]], {{templates}}, etc. from etymology fields; resolve |alt= when term slot is empty (Template:derived). */
function normalizeEtymologyFields(
    t: TemplateCall,
    isCog: boolean
): { source_lang: string; term?: string; gloss?: string } {
    const pos = t.params.positional ?? [];
    const named = t.params.named ?? {};
    const sourceRaw = isCog ? (pos[0] ?? "") : (pos[1] ?? "");
    let termRaw = isCog ? (pos[1] || undefined) : (pos[2] || undefined);
    let glossRaw = named["t"] || named["gloss"] || (isCog ? pos[2] : pos[3]) || undefined;
    if (!termRaw?.trim() && !isCog) {
        termRaw = named["alt"] || undefined;
    }
    const source_lang = stripWikiMarkup(sourceRaw.trim()).trim() || sourceRaw.trim();
    const term = termRaw ? stripWikiMarkup(termRaw).trim() || undefined : undefined;
    const gloss = glossRaw ? stripWikiMarkup(glossRaw).trim() || undefined : undefined;
    return { source_lang, term, gloss };
}

reg.register({
    id: "etymology",
    handlesTemplates: [...ALL_ETYMOLOGY_TEMPLATES],
    matches: (ctx) => ctx.templates.some((t) => ALL_ETYMOLOGY_TEMPLATES.has(t.name)),
    decode: (ctx) => {
        const chain: EtymologyLink[] = [];
        const cognates: EtymologyLink[] = [];

        for (const t of ctx.templates) {
            if (!ALL_ETYMOLOGY_TEMPLATES.has(t.name)) continue;
            const isCog = ETYMOLOGY_COGNATE_TEMPLATES.has(t.name);
            const { source_lang, term, gloss } = normalizeEtymologyFields(t, isCog);
            const relation = TEMPLATE_RELATION_MAP[t.name] ?? "derived";
            const link: EtymologyLink = {
                template: t.name,
                relation,
                source_lang,
                term,
                gloss,
                raw: t.raw,
            };
            if (isCog) {
                cognates.push(link);
            } else {
                chain.push(link);
            }
        }

        // Keep the preamble verbatim; stripping template markup can erase terms.
        const raw_text = (ctx.etymology.etymology_raw_text ?? "").trim() || undefined;

        if (chain.length === 0 && cognates.length === 0 && !raw_text) return {};
        return {
            entry: {
                etymology: {
                    ...(chain.length > 0 && { chain }),
                    ...(cognates.length > 0 && { cognates }),
                    ...(raw_text && { raw_text }),
                },
            },
        };
    },
});

/** --- Phase 2.4: Advanced pronunciation (el-IPA, audio) --- **/

reg.register({
    id: "el-ipa",
    handlesTemplates: ["el-IPA"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-IPA"),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => t.name === "el-IPA");
        if (!t) return {};
        const ipa = t.params.positional[0] || undefined;
        if (!ipa) return {};
        return { entry: { pronunciation: { IPA: ipa } } };
    },
});

reg.register({
    id: "audio",
    handlesTemplates: ["audio"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "audio"),
    decode: (ctx) => {
        const audioTpls = ctx.templates.filter((t) => t.name === "audio");
        if (audioTpls.length === 0) return {};

        const audio_details: Array<{ url: string; label?: string; filename: string }> = [];
        let firstAudio: string | undefined;
        let firstAudioUrl: string | undefined;
        let firstRomanization: string | undefined;

        for (const t of audioTpls) {
            const file = t.params.positional[1] || t.params.positional[0] || undefined;
            if (!file) continue;
            const normalizedName = file.replace(/ /g, "_");
            const audio_url = `https://upload.wikimedia.org/wikipedia/commons/${normalizedName}`;
            const label = t.params.positional[2] || t.params.named?.label || t.params.named?.p || undefined;
            
            if (!firstAudio) {
                firstAudio = file;
                firstAudioUrl = audio_url;
                firstRomanization = t.params.named?.tr;
            }
            audio_details.push({ url: audio_url, label, filename: file });
        }

        if (audio_details.length === 0) return {};

        return { 
            entry: { 
                pronunciation: { 
                    audio: firstAudio, 
                    audio_url: firstAudioUrl, 
                    audio_details, 
                    ...(firstRomanization && { romanization: firstRomanization }) 
                } 
            } 
        };
    },
});

reg.register({
    id: "romanization",
    handlesTemplates: [],
    matches: (ctx) => {
        const allowed = new Set(["head", "el-verb", "el-noun", "el-adj", "grc-noun", "grc-verb", "fr-verb", "de-noun"]);
        return ctx.templates.some(t => allowed.has(t.name) && !!t.params.named?.tr);
    },
    decode: (ctx) => {
        const allowed = new Set(["head", "el-verb", "el-noun", "el-adj", "grc-noun", "grc-verb", "fr-verb", "de-noun"]);
        const t = ctx.templates.find(t => allowed.has(t.name) && !!t.params.named?.tr);
        if (!t) return {};
        return { entry: { pronunciation: { romanization: t.params.named.tr } } };
    },
});

/** --- Rhymes and Homophones --- **/
reg.register({
    id: "rhymes",
    handlesTemplates: ["rhymes"],
    matches: (ctx) => ctx.templates.some(t => t.name === "rhymes"),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name === "rhymes");
        if (!t) return {};
        const pos = t.params.positional ?? [];
        // pos[0] is lang, rest are rhymes
        const rhymes = pos.slice(1).filter(Boolean);
        if (rhymes.length === 0) return {};
        return { entry: { pronunciation: { rhymes } } };
    },
});

reg.register({
    id: "homophones",
    handlesTemplates: ["homophones"],
    matches: (ctx) => ctx.templates.some(t => t.name === "homophones"),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name === "homophones");
        if (!t) return {};
        const pos = t.params.positional ?? [];
        // pos[0] is lang, rest are homophones
        const homophones = pos.slice(1).filter(Boolean);
        if (homophones.length === 0) return {};
        return { entry: { pronunciation: { homophones } } };
    },
});

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
