import type { DecodeContext, TemplateDecoder, Sense, EtymologyLink, DecoderDebugEvent, SectionLinkItem, SectionWithLinks } from "./types";
import { deepMerge } from "./utils";
import { parseTemplates } from "./parser";

export class DecoderRegistry {
    private decoders: TemplateDecoder[] = [];
    constructor() { }
    register(decoder: TemplateDecoder) {
        this.decoders.push(decoder);
    }
    decodeAll(ctx: DecodeContext, options?: { debug?: boolean }): { patch: any; debug?: DecoderDebugEvent[] } {
        const patches: any[] = [];
        const debugEvents: DecoderDebugEvent[] = [];
        for (const d of this.decoders) {
            if (!d.matches(ctx)) continue;
            const patch = d.decode(ctx);
            patches.push(patch);
            if (options?.debug) {
                const entryPatch = patch?.entry ?? {};
                const fieldsProduced = Object.keys(entryPatch).filter((k) => k !== "templates");
                const matchedTemplates = ctx.templates
                    .filter((t) => decoderMatchesTemplate(d, t, ctx))
                    .map((t) => ({ raw: t.raw, name: t.name }));
                if (matchedTemplates.length > 0 || fieldsProduced.length > 0) {
                    debugEvents.push({
                        decoderId: d.id,
                        matchedTemplates,
                        fieldsProduced: fieldsProduced.length > 0 ? fieldsProduced : ["templates"],
                    });
                }
            }
        }
        const merged = mergePatches(patches);
        if (options?.debug) {
            return { patch: merged, debug: debugEvents };
        }
        return merged as any;
    }
    getDecoders(): TemplateDecoder[] {
        return [...this.decoders];
    }
    /** All template names declared as handled by registered decoders. */
    getHandledTemplates(): Set<string> {
        const out = new Set<string>();
        for (const d of this.decoders) {
            for (const t of d.handlesTemplates ?? []) {
                out.add(t);
            }
        }
        return out;
    }
}

function decoderMatchesTemplate(d: TemplateDecoder, t: { name: string }, ctx: DecodeContext): boolean {
    if (d.handlesTemplates) return d.handlesTemplates.includes(t.name);
    const singleTplCtx = { ...ctx, templates: [t as any], posBlockWikitext: ctx.posBlockWikitext };
    return d.matches(singleTplCtx);
}

function mergePatches(patches: any[]) {
    const out = {};
    for (const p of patches) {
        deepMerge(out, p);
    }
    return out;
}

export const FORM_OF_TEMPLATES = new Set([
    "infl of",
    "inflection of",
    "alternative form of",
    "alt form",
    "alt form of",
    "form of",
    "misspelling of",
    "abbreviation of",
    "short for",
    "clipping of",
    "diminutive of",
    "augmentative of",
]);

export const registry = new DecoderRegistry();

/** --- Core: store raw template calls (always) --- **/
registry.register({
    id: "store-raw-templates",
    handlesTemplates: [], // matches all via matches()
    matches: (_ctx) => true,
    decode: (ctx) => {
        const store: any = { entry: { templates: {} } };
        for (const t of ctx.templates) {
            if (!store.entry.templates[t.name]) store.entry.templates[t.name] = [];
            store.entry.templates[t.name].push({ params: t.params, raw: t.raw });
        }
        return store;
    },
});

/** --- Headword templates --- **/
registry.register({
    id: "ipa",
    handlesTemplates: ["IPA"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "IPA"),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => t.name === "IPA");
        const pos = t?.params?.positional ?? [];
        const ipa = pos.find((x) => x.startsWith("/")) ?? null;
        if (!ipa) return {};
        return { entry: { pronunciation: { IPA: ipa } } };
    },
});

registry.register({
    id: "hyphenation",
    handlesTemplates: ["hyphenation"],
    matches: (ctx) => ctx.lines.some((l) => /^\s*[*#]*\s*\{\{hyphenation\|/.test(l)),
    decode: (ctx) => {
        const line = ctx.lines.find((l) => /^\s*[*#]*\s*\{\{hyphenation\|/.test(l));
        if (!line) return {};
        const tpls = parseTemplates(line);
        const t = tpls.find((x) => x.name === "hyphenation");
        if (!t) return { entry: { hyphenation: { raw: line.trim() } } };
        const sylls = (t.params.positional || []).filter(Boolean).filter(s => s !== "el" && s !== "grc");
        if (sylls.length === 0) return { entry: { hyphenation: { raw: line.trim() } } };
        return { entry: { hyphenation: { syllables: sylls, raw: line.trim() } } };
    },
});

registry.register({
    id: "el-adj-head",
    handlesTemplates: ["el-adj"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-adj"),
    decode: (_ctx) => ({ entry: { part_of_speech: "adjective" } }),
});

registry.register({
    id: "el-noun-head",
    handlesTemplates: ["el-noun"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-noun"),
    decode: (_ctx) => ({ entry: { part_of_speech: "noun" } }),
});

registry.register({
    id: "el-verb-head",
    handlesTemplates: ["el-verb"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-verb"),
    decode: (_ctx) => ({ entry: { part_of_speech: "verb" } }),
});

registry.register({
    id: "el-pron-head",
    handlesTemplates: ["el-pron"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-pron"),
    decode: (_ctx) => ({ entry: { part_of_speech: "pronoun" } }),
});

registry.register({
    id: "el-numeral-head",
    handlesTemplates: ["el-numeral"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-numeral"),
    decode: (_ctx) => ({ entry: { part_of_speech: "numeral" } }),
});

registry.register({
    id: "el-participle-head",
    handlesTemplates: ["el-part"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-part"),
    decode: (_ctx) => ({ entry: { part_of_speech: "participle" } }),
});

registry.register({
    id: "el-adv-head",
    handlesTemplates: ["el-adv"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-adv"),
    decode: (_ctx) => ({ entry: { part_of_speech: "adverb" } }),
});

registry.register({
    id: "el-art-head",
    handlesTemplates: ["el-art", "el-art-def", "el-art-indef"],
    matches: (ctx) =>
        ctx.templates.some(
            (t) =>
                t.name === "el-art" ||
                t.name === "el-art-def" ||
                t.name === "el-art-indef"
        ),
    decode: (_ctx) => ({ entry: { part_of_speech: "article" } }),
});

/** --- Form-of / lemma resolution triggers --- **/
registry.register({
    id: "form-of",
    handlesTemplates: [...FORM_OF_TEMPLATES],
    matches: (ctx) => ctx.templates.some((t) => FORM_OF_TEMPLATES.has(t.name)),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => FORM_OF_TEMPLATES.has(t.name));
        if (!t) return {};
        const pos = t.params.positional ?? [];
        const lang = pos[0] ?? ctx.lang;
        const lemma = pos[1] ?? null;
        const tags = pos.slice(2).filter(Boolean);
        const named = t.params.named ?? {};
        return {
            entry: {
                type: "INFLECTED_FORM",
                form_of: { template: t.name, lemma, lang, tags, named },
            },
        };
    },
});

/** --- Translation parsing --- **/
function parseTranslationsFromBlock(wikitext: string) {
    const lines = wikitext.split("\n");
    const out: any = {};
    let currentSense: string | null = null;
    for (const line of lines) {
        const senseM = line.match(/^\*\s*\(([^)]+)\)\s*:/);
        if (senseM) currentSense = senseM[1].trim();
        if (!line.includes("{{t") && !line.includes("{{tt")) continue;

        const tpls = parseTemplates(line);
        for (const t of tpls) {
            if (
                !(
                    t.name === "t" ||
                    t.name === "t+" ||
                    t.name === "t-simple" ||
                    t.name === "tt" ||
                    t.name === "tt+"
                )
            )
                continue;
            const pos = t.params.positional || [];
            const named = t.params.named ?? {};
            // {{t|target_lang|source_lang|term|...}} — pos[1]=translation lang, pos[2]=term
            const lang = pos[1] ?? pos[0];
            const term = pos[2] ?? pos[1];
            if (!lang || !term) continue;
            if (!out[lang]) out[lang] = [];
            const gloss = named.t ?? named.gloss;
            out[lang].push({
                term,
                ...(gloss && { gloss }),
                ...(named.tr && { transliteration: named.tr }),
                ...(named.g && { gender: named.g }),
                ...(named.alt && { alt: named.alt }),
                sense: currentSense || null,
                template: t.name,
                raw: t.raw,
                params: t.params,
            });
        }
    }
    return out;
}

registry.register({
    id: "translations",
    handlesTemplates: ["t", "t+", "t-simple", "tt", "tt+"],
    matches: (ctx) => /==+\s*Translations\s*==+/i.test(ctx.posBlockWikitext),
    decode: (ctx) => {
        const parts = ctx.posBlockWikitext.split("\n");
        let inTr = false;
        const buf: string[] = [];
        for (const line of parts) {
            if (line.match(/^====\s*Translations\s*====\s*$/)) {
                inTr = true;
                continue;
            }
            if (inTr && line.match(/^====\s*[^=]/)) {
                break;
            }
            if (inTr) buf.push(line);
        }
        if (buf.length === 0) return {};
        const tr = parseTranslationsFromBlock(buf.join("\n"));
        if (Object.keys(tr).length === 0) return {};
        return { entry: { translations: tr } };
    },
});

/** --- Phase 2.1: Sense-level structuring --- **/

function parseSenses(lines: string[]): Sense[] {
    const senses: Sense[] = [];
    let counter = 0;

    for (const line of lines) {
        const defMatch = line.match(/^#\s+(.+)$/);
        if (defMatch) {
            counter++;
            const raw = defMatch[1];
            const gloss = stripWikiMarkup(raw);
            senses.push({ id: `S${counter}`, gloss, gloss_raw: raw });
            continue;
        }

        const subDefMatch = line.match(/^##\s+(.+)$/);
        if (subDefMatch && senses.length > 0) {
            const parent = senses[senses.length - 1];
            if (!parent.subsenses) parent.subsenses = [];
            const subId = `${parent.id}.${parent.subsenses.length + 1}`;
            const raw = subDefMatch[1];
            parent.subsenses.push({
                id: subId,
                gloss: stripWikiMarkup(raw),
                gloss_raw: raw,
            });
            continue;
        }

        const exMatch = line.match(/^#:\s*(.+)$/);
        if (exMatch && senses.length > 0) {
            const parent = senses[senses.length - 1];
            if (!parent.examples) parent.examples = [];
            parent.examples.push(stripWikiMarkup(exMatch[1]));
        }
    }

    return senses;
}

/**
 * Brace-aware wiki markup stripper. Handles nested [[links]], {{templates}},
 * '''bold''', ''italic'' without regex-induced duplication or mis-parsing.
 * [[link|display]] → display; [[link]] → link; {{...}} → removed.
 */
export function stripWikiMarkup(text: string): string {
    const out: string[] = [];
    let i = 0;
    while (i < text.length) {
        if (text.startsWith("[[", i)) {
            const end = findMatching(text, i + 2, "[[", "]]");
            if (end !== -1) {
                const inner = text.slice(i + 2, end);
                const pipeIdx = inner.indexOf("|");
                const display = pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : inner;
                out.push(stripWikiMarkup(display));
                i = end + 2;
                continue;
            }
        }
        if (text.startsWith("{{", i)) {
            const end = findMatching(text, i + 2, "{{", "}}");
            if (end !== -1) {
                // Special case for {{l}} or {{link}} inside senses, try to extract term
                if (text.startsWith("{{l|", i) || text.startsWith("{{link|", i)) {
                    const inner = text.slice(i + 2, end);
                    const parts = inner.split("|");
                    if (parts.length >= 3) out.push(parts[2]); // term
                }
                i = end + 2;
                continue;
            }
        }
        if (text.startsWith("'''", i)) {
            const end = text.indexOf("'''", i + 3);
            if (end !== -1) {
                out.push(text.slice(i + 3, end));
                i = end + 3;
                continue;
            }
        }
        if (text.startsWith("''", i) && !text.startsWith("'''", i)) {
            const end = text.indexOf("''", i + 2);
            if (end !== -1) {
                out.push(text.slice(i + 2, end));
                i = end + 2;
                continue;
            }
        }
        out.push(text[i]);
        i++;
    }
    return out.join("").trim();
}

function findMatching(text: string, start: number, open: string, close: string): number {
    let depth = 1;
    let j = start;
    while (j < text.length) {
        if (text.startsWith(open, j)) {
            depth++;
            j += open.length;
        } else if (text.startsWith(close, j)) {
            depth--;
            if (depth === 0) return j;
            j += close.length;
        } else {
            j++;
        }
    }
    return -1;
}

registry.register({
    id: "senses",
    handlesTemplates: [],
    matches: (ctx) => ctx.lines.some((l) => /^#\s+/.test(l)),
    decode: (ctx) => {
        const senses = parseSenses(ctx.lines);
        if (senses.length === 0) return {};
        return { entry: { senses } };
    },
});

/** --- Phase 2.2: Semantic relations --- **/

const RELATION_TEMPLATES: Record<string, keyof import("./types").SemanticRelations> = {
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
} as const;

registry.register({
    id: "semantic-relations",
    handlesTemplates: ["syn", "ant", "hyper", "hypo"],
    matches: (ctx) =>
        ctx.templates.some((t) => Object.keys(RELATION_TEMPLATES).includes(t.name)) ||
        Object.keys(RELATION_HEADERS).some(h => ctx.posBlockWikitext.includes(`==${h}==`)),
    decode: (ctx) => {
        const relations: import("./types").SemanticRelations = {};
        
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
                    if (!relations[field as keyof import("./types").SemanticRelations]) 
                        relations[field as keyof import("./types").SemanticRelations] = [];
                    for (const item of items) {
                        relations[field as keyof import("./types").SemanticRelations]!.push({ 
                            term: item.term, 
                            qualifier: item.gloss 
                        });
                    }
                }
            }
        }

        if (Object.keys(relations).length === 0) return {};
        return { entry: { semantic_relations: relations } };
    },
});

/** --- Phase 2.3: Structured etymology & cognates --- **/

const ETYMOLOGY_TEMPLATES = new Set(["inh", "der", "bor", "cog", "inherited", "derived", "borrowed", "cognate"]);

registry.register({
    id: "etymology",
    handlesTemplates: [...ETYMOLOGY_TEMPLATES],
    matches: (ctx) => ctx.templates.some((t) => ETYMOLOGY_TEMPLATES.has(t.name)),
    decode: (ctx) => {
        const links: EtymologyLink[] = [];
        for (const t of ctx.templates) {
            if (!ETYMOLOGY_TEMPLATES.has(t.name)) continue;
            const pos = t.params.positional ?? [];
            // {{inh|<target>|<source>|<term>}}, {{cog|<source>|<term>}}
            const isCog = t.name === "cog" || t.name === "cognate";
            const sourceLang = isCog ? (pos[0] ?? "") : (pos[1] ?? "");
            const term = isCog ? (pos[1] || undefined) : (pos[2] || undefined);
            const gloss = t.params.named?.["t"] || t.params.named?.["gloss"] || (isCog ? pos[2] : pos[3]) || undefined;
            links.push({
                template: t.name,
                source_lang: sourceLang,
                term,
                gloss,
                raw: t.raw,
            });
        }
        if (links.length === 0) return {};
        return { entry: { etymology: { links } } };
    },
});

/** --- Phase 2.4: Advanced pronunciation (el-IPA, audio) --- **/

registry.register({
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

registry.register({
    id: "audio",
    handlesTemplates: ["audio"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "audio"),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => t.name === "audio");
        if (!t) return {};
        const file = t.params.positional[1] || t.params.positional[0] || undefined;
        if (!file) return {};
        return { entry: { pronunciation: { audio: file } } };
    },
});

/** --- Phase 7.1: Section decoders for l/link (Derived/Related/Descendants) --- **/

const SECTION_LINK_HEADERS = ["Derived terms", "Related terms", "Descendants"] as const;
const SECTION_LINK_FIELDS = ["derived_terms", "related_terms", "descendants"] as const;

function extractSectionByLevelHeaders(wikitext: string, headerName: string): { raw: string } | null {
    const re = new RegExp(`^=+\\s*${headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=+.*$`, "im");
    const m = re.exec(wikitext);
    if (!m) return null;
    const start = m.index + m[0].length;
    const after = wikitext.slice(start);
    const next = after.search(/^=+/m);
    const raw = next === -1 ? after : after.slice(0, next);
    return { raw: raw.trim() };
}

function parseSectionLinkTemplates(wikitext: string): SectionLinkItem[] {
    const items: SectionLinkItem[] = [];
    const tpls = parseTemplates(wikitext);
    for (const t of tpls) {
        if (t.name !== "l" && t.name !== "link") continue;
        const pos = t.params.positional ?? [];
        const lang = pos[0];
        const term = pos[1];
        if (!lang || !term) continue;
        const named = t.params.named ?? {};
        const gloss = named.gloss ?? named.t ?? pos[3] ?? undefined;
        const alt = named.alt ?? pos[2] ?? undefined;
        items.push({ term, lang, gloss, alt, template: t.name, raw: t.raw });
    }
    return items;
}

registry.register({
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

/** --- Phase 2.5: Usage notes --- **/

registry.register({
    id: "usage-notes",
    handlesTemplates: [],
    matches: (ctx) => ctx.posBlockWikitext.includes("===Usage notes==="),
    decode: (ctx) => {
        const parts = ctx.posBlockWikitext.split("\n");
        let inNotes = false;
        const notes: string[] = [];
        for (const line of parts) {
            if (/^===+\s*Usage notes\s*===+\s*$/.test(line)) {
                inNotes = true;
                continue;
            }
            if (inNotes && /^===/.test(line)) break;
            if (inNotes) {
                const trimmed = line.replace(/^\*\s*/, "").trim();
                if (trimmed) notes.push(trimmed);
            }
        }
        if (notes.length === 0) return {};
        return { entry: { usage_notes: notes } };
    },
});
