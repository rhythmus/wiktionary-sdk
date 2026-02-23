import type { DecodeContext, TemplateDecoder, Sense, SemanticRelation, EtymologyLink } from "./types";
import { deepMerge } from "./utils";
import { parseTemplates } from "./parser";

export class DecoderRegistry {
    private decoders: TemplateDecoder[] = [];
    constructor() { }
    register(decoder: TemplateDecoder) {
        this.decoders.push(decoder);
    }
    decodeAll(ctx: DecodeContext) {
        const patches: any[] = [];
        for (const d of this.decoders) {
            if (d.matches(ctx)) patches.push(d.decode(ctx));
        }
        return mergePatches(patches);
    }
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
    matches: (ctx) => ctx.lines.some((l) => l.trim().startsWith("{{hyphenation|")),
    decode: (ctx) => {
        const line = ctx.lines.find((l) => l.trim().startsWith("{{hyphenation|"));
        if (!line) return {};
        const tpls = parseTemplates(line);
        const t = tpls.find((x) => x.name === "hyphenation");
        if (!t) return { entry: { hyphenation: { raw: line.trim() } } };
        const sylls = (t.params.positional || []).filter(Boolean);
        if (sylls.length === 0) return { entry: { hyphenation: { raw: line.trim() } } };
        return { entry: { hyphenation: { syllables: sylls, raw: line.trim() } } };
    },
});

registry.register({
    id: "el-adj-head",
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-adj"),
    decode: (_ctx) => ({ entry: { part_of_speech: "adjective" } }),
});

registry.register({
    id: "el-noun-head",
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-noun"),
    decode: (_ctx) => ({ entry: { part_of_speech: "noun" } }),
});

registry.register({
    id: "el-verb-head",
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-verb"),
    decode: (_ctx) => ({ entry: { part_of_speech: "verb" } }),
});

registry.register({
    id: "el-pron-head",
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-pron"),
    decode: (_ctx) => ({ entry: { part_of_speech: "pronoun" } }),
});

registry.register({
    id: "el-numeral-head",
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-numeral"),
    decode: (_ctx) => ({ entry: { part_of_speech: "numeral" } }),
});

registry.register({
    id: "el-participle-head",
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-part"),
    decode: (_ctx) => ({ entry: { part_of_speech: "participle" } }),
});

registry.register({
    id: "el-adv-head",
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-adv"),
    decode: (_ctx) => ({ entry: { part_of_speech: "adverb" } }),
});

registry.register({
    id: "el-art-head",
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
            const lang = pos[0];
            const gloss = pos[1];
            if (!lang || !gloss) continue;
            if (!out[lang]) out[lang] = [];
            out[lang].push({
                gloss,
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
    matches: (ctx) => ctx.posBlockWikitext.includes("==Translations=="),
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
            const gloss = stripWikiMarkup(defMatch[1]);
            senses.push({ id: `S${counter}`, gloss });
            continue;
        }

        const subDefMatch = line.match(/^##\s+(.+)$/);
        if (subDefMatch && senses.length > 0) {
            const parent = senses[senses.length - 1];
            if (!parent.subsenses) parent.subsenses = [];
            const subId = `${parent.id}.${parent.subsenses.length + 1}`;
            parent.subsenses.push({
                id: subId,
                gloss: stripWikiMarkup(subDefMatch[1]),
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

function stripWikiMarkup(text: string): string {
    return text
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
        .replace(/'''([^']+)'''/g, "$1")
        .replace(/''([^']+)''/g, "$1")
        .replace(/\{\{[^}]*\}\}/g, "")
        .trim();
}

registry.register({
    id: "senses",
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

registry.register({
    id: "semantic-relations",
    matches: (ctx) =>
        ctx.templates.some((t) => Object.keys(RELATION_TEMPLATES).includes(t.name)),
    decode: (ctx) => {
        const relations: import("./types").SemanticRelations = {};
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
        if (
            !relations.synonyms?.length &&
            !relations.antonyms?.length &&
            !relations.hypernyms?.length &&
            !relations.hyponyms?.length
        )
            return {};
        return { entry: { semantic_relations: relations } };
    },
});

/** --- Phase 2.3: Structured etymology & cognates --- **/

const ETYMOLOGY_TEMPLATES = new Set(["inh", "der", "bor", "cog", "inherited", "derived", "borrowed", "cognate"]);

registry.register({
    id: "etymology",
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
    matches: (ctx) => ctx.templates.some((t) => t.name === "audio"),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => t.name === "audio");
        if (!t) return {};
        const file = t.params.positional[1] || t.params.positional[0] || undefined;
        if (!file) return {};
        return { entry: { pronunciation: { audio: file } } };
    },
});

/** --- Phase 2.5: Usage notes --- **/

registry.register({
    id: "usage-notes",
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
