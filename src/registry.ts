import type {
    DecodeContext,
    TemplateDecoder,
    Sense,
    OnlyUsedIn,
    EtymologyLink,
    DecoderDebugEvent,
    SectionLinkItem,
    SectionWithLinks,
    TemplateCall,
} from "./types";
import { parseTemplates } from "./parser";
import { mergePatches } from "./registry/merge-patches";
import {
    isPerLangFormOfTemplate,
    isFormOfTemplateName,
    isVariantFormOfTemplateName,
} from "./registry/form-of-predicates";
import { stripWikiMarkup } from "./registry/strip-wiki-markup";

export * from "./registry/form-of-predicates";
export { stripWikiMarkup };

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
        // First look for something with /.../ if possible
        let ipa = pos.find((x) => x.startsWith("/") || x.startsWith("[")) ?? null;
        // Fallback: first candidate that resembles IPA, not a language code.
        if (!ipa) {
            ipa = pos.find((x) => x.length > 3 || /[/\[\]ˈˌ]/.test(x)) ?? null;
        }
        if (!ipa) return {};
        return { entry: { pronunciation: { IPA: ipa } } };
    },
});

/** First positional is often a language code (|el|, |grk-ita|); otherwise all positionals are syllables. */
function hyphenationSyllablesFromPositionals(positional: string[] | undefined): string[] {
    const pos = (positional || []).map((p) => p.trim()).filter(Boolean);
    if (pos.length === 0) return [];
    // First token already in target script → no leading lang (e.g. {{hyphenation|γρά|φω}}). Must run before the
    // "second is non-ASCII" branch, or Greek|Greek would be misread as lang|syllables.
    if (/[^\x00-\x7F]/.test(pos[0])) {
        return pos;
    }
    // Second token in non-Latin script while first is ASCII → first is a lang code (e.g. {{hyphenation|el|γρά|φω}}).
    if (pos.length >= 2 && /[^\x00-\x7F]/.test(pos[1])) {
        return pos.slice(1);
    }
    // All ASCII: leading token may be a language code (|el|bank|, |el|foo|bar|) or a syllable (|foo|bar|).
    const first = pos[0].toLowerCase();
    const shortLang = /^[a-z]{2,3}$/i.test(first);
    const skipFirst =
        pos.length >= 2 &&
        (HYPHENATION_COMPOUND_LANG_PREFIXES.has(first) ||
            (shortLang && HYPHENATION_LEADING_LANG_CODES.has(first)));
    return skipFirst ? pos.slice(1) : pos;
}

/** Wiktionary-specific hyphenation language tags (not ISO 639-1 single tokens). */
const HYPHENATION_COMPOUND_LANG_PREFIXES = new Set(["grk-ita", "grk-bgr"]);

/** ISO 639-1-style codes commonly used as first param on en.wiktionary {{hyphenation|…}} (closed list; excludes ba to reduce syllable false positives). */
const HYPHENATION_LEADING_LANG_CODES = new Set(
    (
        "aa ab ae af ak am an ar as av ay az be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee " +
        "el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu " +
        "ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my " +
        "na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw " +
        "ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu " +
        "grc grk mul und got tr nl pl fi sv no da cs hu ro bg sr hr sk sl uk be he ar fa zh ja ko hi vi id ms tl sw wo ha yo zu xh st tn ne ng bm bi so om si my km lo th jv su ceb haw mi sm to fy af co br oc an sc rm wa li vo eo io ie ia jbo tok pih dz ch ay qu gn ht lv lt et ast nah rap ab cv"
    )
        .split(/\s+/)
        .filter(Boolean)
);

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
        const sylls = hyphenationSyllablesFromPositionals(t.params.positional);
        if (sylls.length === 0) return { entry: { hyphenation: { raw: line.trim() } } };
        return { entry: { hyphenation: { syllables: sylls, raw: line.trim() } } };
    },
});

/** --- Alternative forms section --- **/
registry.register({
    id: "alternative-forms-section",
    handlesTemplates: [],
    matches: (ctx) => /^=+\s*Alternative forms\s*=+/im.test(ctx.posBlockWikitext),
    decode: (ctx) => {
        const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "Alternative forms");
        if (!section) return {};
        
        const lines = section.raw.split("\n").filter(l => l.includes("{{") || l.includes("[["));
        const alternative_forms: Array<{ term: string; qualifier?: string; raw: string; type?: string; labels?: string[] }> = [];
        
        for (const line of lines) {
            const tpls = parseTemplates(line);
            
            // 1. Handle {{alt form of}}, {{polytonic form of}}, etc.
            const variantTpl = tpls.find(t => 
                t.name.includes("form of") || t.name === "alt form" || t.name === "polytonic variant"
            );
            
            if (variantTpl) {
                const pos = variantTpl.params.positional ?? [];
                const term = pos[1] || pos[0] || "";
                if (!term) continue;
                
                const type = variantTpl.name.replace(" form of", "").replace(" variant", "").trim();
                const labels = variantTpl.params.named?.["q"] ? [variantTpl.params.named["q"]] : [];
                
                alternative_forms.push({
                    term,
                    raw: line.trim(),
                    type,
                    labels: labels.length > 0 ? labels : undefined
                });
                continue;
            }
            
            // 2. Handle generic list items with [[links]]
            const linkMatch = line.match(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/);
            if (linkMatch) {
                const term = linkMatch[1];
                const qualifierMatch = line.match(/\(([^)]+)\)/);
                alternative_forms.push({
                    term,
                    raw: line.trim(),
                    qualifier: qualifierMatch ? qualifierMatch[1] : undefined
                });
            }
        }
        
        if (alternative_forms.length === 0) return {};
        return { entry: { alternative_forms } };
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

/** --- Dutch (NL) Headword Decoders --- **/

registry.register({
    id: "nl-adj-head",
    handlesTemplates: ["nl-adj"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "nl-adj"),
    decode: (_ctx) => ({ entry: { part_of_speech: "adjective" } }),
});

registry.register({
    id: "nl-noun-head",
    handlesTemplates: ["nl-noun", "nl-noun-dim", "nl-noun-dim-tant"],
    matches: (ctx) => ctx.templates.some((t) => ["nl-noun", "nl-noun-dim", "nl-noun-dim-tant"].includes(t.name)),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => ["nl-noun", "nl-noun-dim", "nl-noun-dim-tant"].includes(t.name));
        if (!t) return {};
        const pos = t.params.positional ?? [];
        const rawGender = t.params.named?.g || pos[0] || "";
        const gender = GENDER_MAP[rawGender.toLowerCase()] || (rawGender.toLowerCase() === "c" ? "common" : null);
        return {
            entry: {
                part_of_speech: "noun",
                ...(gender !== null && { headword_morphology: { gender } }),
            },
        };
    },
});

registry.register({
    id: "nl-verb-head",
    handlesTemplates: ["nl-verb"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "nl-verb"),
    decode: (_ctx) => ({ entry: { part_of_speech: "verb" } }),
});

/** --- German (DE) Headword Decoders --- **/

registry.register({
    id: "de-adj-head",
    handlesTemplates: ["de-adj"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "de-adj"),
    decode: (_ctx) => ({ entry: { part_of_speech: "adjective" } }),
});

registry.register({
    id: "de-noun-head",
    handlesTemplates: ["de-noun", "de-proper noun"],
    matches: (ctx) => ctx.templates.some((t) => ["de-noun", "de-proper noun"].includes(t.name)),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => ["de-noun", "de-proper noun"].includes(t.name));
        if (!t) return {};
        const pos = t.params.positional ?? [];
        // de-noun|gender,genitive,plural
        const fullParam = pos[0] || "";
        const rawGender = fullParam.split(",")[0] || "";
        const gender = GENDER_MAP[rawGender.toLowerCase()] || null;
        return {
            entry: {
                part_of_speech: "noun",
                ...(gender !== null && { headword_morphology: { gender } }),
            },
        };
    },
});

registry.register({
    id: "de-verb-head",
    handlesTemplates: ["de-verb"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "de-verb"),
    decode: (_ctx) => ({ entry: { part_of_speech: "verb" } }),
});

/** --- Form-of / lemma resolution triggers --- **/

/** Maps morph tag shortcodes → English words for human-readable labels. */
const TAG_LABEL_MAP: Record<string, string> = {
    "1": "1st pers.", "2": "2nd pers.", "3": "3rd pers.",
    "s": "singular", "sg": "singular", "p": "plural", "pl": "plural",
    "perf": "perfective", "impf": "imperfective", "pres": "present",
    "past": "past", "fut": "future", "aor": "aorist",
    "actv": "active", "pasv": "passive", "mp": "mediopassive", "mid": "middle",
    "indc": "indicative", "subj": "subjunctive", "impr": "imperative", "opt": "optative", "cond": "conditional",
    "inf": "infinitive", "ptcp": "participle", "ger": "gerund",
    "m": "masculine", "f": "feminine", "n": "neuter", "c": "common",
    "nom": "nominative", "gen": "genitive", "acc": "accusative", "voc": "vocative", "dat": "dative", "inst": "instrumental", "loc": "locative",
    "def": "definite", "indef": "indefinite",
    "pos": "positive", "comp": "comparative", "sup": "superlative",
};

function tagsToLabel(tags: string[]): string {
    return tags
        .map(t => TAG_LABEL_MAP[t] || t)
        .filter(t => t && t.length > 1) // skip single char tags that didn't map
        .join(" ");
}

/** Human-readable kind from the form-of template name when tags alone are empty. */
function defaultFormOfKindLabel(templateName: string): string {
    const key = templateName.trim().toLowerCase();
    const FORM_OF_KIND_LABELS: Record<string, string> = {
        "inflection of": "Inflection",
        "infl of": "Inflection",
        "plural of": "Plural",
        "noun form of": "Noun form",
        "verb form of": "Verb form",
        "adj form of": "Adjective form",
        "participle of": "Participle",
        "past tense of": "Past tense",
        "past participle of": "Past participle",
        "present participle of": "Present participle",
        "gerund of": "Gerund",
        "command of": "Command",
        "imperative of": "Imperative",
        "alternative form of": "Alternative form",
        "alt form": "Alternative form",
        "alt form of": "Alternative form",
        "form of": "Alternative form",
        "misspelling of": "Misspelling",
        "abbreviation of": "Abbreviation",
        "short for": "Short for",
        "clipping of": "Clipping",
        "diminutive of": "Diminutive",
        "augmentative of": "Augmentative",
    };
    if (FORM_OF_KIND_LABELS[key]) return FORM_OF_KIND_LABELS[key];
    if (/^[a-z]{2,3}-verb\s+form\s+of$/i.test(key)) return "Verb form";
    if (/^[a-z]{2,3}-noun\s+form\s+of$/i.test(key)) return "Noun form";
    if (/^[a-z]{2,3}-adj\s+form\s+of$/i.test(key)) return "Adjective form";
    const stripped = key.replace(/\s+of$/i, "").trim();
    if (!stripped) return "Form";
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** Display label: template kind + optional morphological tag phrase from positional args. */
function buildFormOfDisplayLabel(templateName: string, tags: string[]): string {
    const morph = tagsToLabel(tags);
    const kind = defaultFormOfKindLabel(templateName);
    if (morph) return `${kind} (${morph})`;
    return kind;
}

registry.register({
    id: "form-of",
    /** Dynamic: any template matching isFormOfTemplateName (Category:Form-of templates + core set). */
    handlesTemplates: [],
    matches: (ctx) => ctx.templates.some((t) => isFormOfTemplateName(t.name)),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => isFormOfTemplateName(t.name));
        if (!t) return {};
        const pos = t.params.positional ?? [];
        const perLang = isPerLangFormOfTemplate(t.name);
        const langPrefix = perLang ? t.name.match(/^([a-z]{2,3})-/i)?.[1]?.toLowerCase() : undefined;
        const lang = perLang ? (langPrefix ?? ctx.lang) : (pos[0] ?? ctx.lang);
        const lemma = perLang ? (pos[0] ?? null) : (pos[1] ?? null);
        const tags = perLang ? pos.slice(1).filter(Boolean) : pos.slice(2).filter(Boolean);
        const named = t.params.named ?? {};
        const label = buildFormOfDisplayLabel(t.name, tags);
        const isVariant = isVariantFormOfTemplateName(t.name);

        // Subclass: strip trailing " of" (e.g. "misspelling of" -> "misspelling")
        const subclass = t.name.replace(/\s+of$/i, "").replace(/\s+form$/i, "").trim().toLowerCase();

        return {
            entry: {
                type: isVariant ? "FORM_OF" : "INFLECTED_FORM",
                form_of: { template: t.name, lemma, lang, tags, named, subclass, label },
            },
        };
    },
});

/** --- Wikidata P31 Instance Of --- **/
registry.register({
    id: "wikidata-p31",
    handlesTemplates: [],
    matches: (ctx) => !!ctx.page.pageprops?.wikibase_item,
    decode: (_ctx) => {
        return {};
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

/** Known topic-domain labels from {{lb}} that map to structured topics. */
const LB_TOPIC_LABELS = new Set([
    "law", "legal", "medicine", "medical", "music", "art", "computing",
    "math", "mathematics", "physics", "chemistry", "biology", "botany", "mycology",
    "zoology", "linguistics", "grammar", "sports", "cooking", "culinary", "religion",
    "politics", "philosophy", "theater", "architecture", "history", "archaeology",
    "military", "nautical", "geometry", "economics", "finance", "logic", "astronomy",
    "geography", "geology", "meteorology", "psychology", "sociology", "literature",
    "archaic", "dialectal", "poetic", "rare", "colloquial", "slang", "figurative",
    "polytonic", "monotonic", "katharevousa", "demotic", "informal", "formal",
]);

/** Extracts labels and topics from a {{lb|lang|label1|label2|...}} template. */
function parseLbTemplate(raw: string): { labels: string[]; topics: string[] } {
    const tpls = parseTemplates(raw);
    const lb = tpls.find(t => t.name === "lb" || t.name === "label");
    if (!lb) return { labels: [], topics: [] };
    const pos = lb.params.positional ?? [];
    // pos[0] is lang code, rest are labels
    const allLabels = pos.slice(1).filter(Boolean).map(l => l.replace(/_/g, " "));
    const topics: string[] = [];
    const labels: string[] = [];
    for (const l of allLabels) {
        if (LB_TOPIC_LABELS.has(l.toLowerCase())) {
            topics.push(l.toLowerCase());
        } else {
            labels.push(l);
        }
    }
    return { labels, topics };
}

/** Strips {{lb|...}} templates from the raw gloss string. */
function stripLbTemplates(raw: string): string {
    return raw.replace(/\{\{(?:lb|label)\|[^}]*\}\}/g, "").trim();
}

/** Extracts a trailing parenthetical qualifier from a clean gloss. */
function extractQualifier(gloss: string): { clean: string; qualifier?: string } {
    const m = gloss.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m && m[2] && m[2].length < 80) {
        return { clean: m[1].trim(), qualifier: m[2].trim() };
    }
    return { clean: gloss };
}

function normalizeTemplateNameForMatch(name: string): string {
    return name.replace(/_/g, " ").trim().toLowerCase();
}

/** Parse {{only used in|lang|term}} from a definition line (after {{lb}} stripped). */
function decodeOnlyUsedInFromRaw(text: string): OnlyUsedIn | null {
    const tpls = parseTemplates(text);
    const t = tpls.find((x) => normalizeTemplateNameForMatch(x.name) === "only used in");
    if (!t) return null;
    const pos = t.params.positional ?? [];
    const named = t.params.named ?? {};
    const lang = (pos[0] ?? named.lang ?? "").trim();
    const termField = (pos[1] ?? "").trim();
    if (!lang || !termField) return null;
    const terms = termField
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (terms.length === 0) return null;
    const t_glossRaw = named.t ?? named.gloss ?? pos[3] ?? "";
    const t_gloss = String(t_glossRaw).trim() || undefined;
    return {
        lang,
        terms,
        ...(t_gloss && { t_gloss }),
        raw: t.raw,
    };
}

/** Plain gloss for Markdown/CLI (matches Wiktionary non-English phrase style). */
function formatOnlyUsedInPlain(oui: OnlyUsedIn): string {
    const joined = oui.terms.length > 1 ? oui.terms.join(" and ") : oui.terms[0];
    let s = `only used in ${joined}`;
    if (oui.t_gloss) s += ` (${oui.t_gloss})`;
    return s;
}

/** Plain-English gloss for a form-of template on a definition line (same param rules as form-of decoder). */
function glossFromFormOfTemplateCall(t: TemplateCall): string | null {
    const name = t.name;
    if (!isFormOfTemplateName(name)) return null;
    const pos = t.params.positional ?? [];
    const perLang = isPerLangFormOfTemplate(name);
    const lemma = perLang ? (pos[0] ?? null) : (pos[1] ?? null);
    const tags = perLang ? pos.slice(1).filter(Boolean) : pos.slice(2).filter(Boolean);
    if (!lemma) return null;
    const label = buildFormOfDisplayLabel(t.name, tags);
    return `${label} of ${lemma}`;
}

/** Other common definition-only templates (not full form_of lexeme typing). */
function glossFromAuxDefinitionTemplate(t: TemplateCall): string | null {
    const n = normalizeTemplateNameForMatch(t.name);
    const pos = t.params.positional ?? [];
    if (n === "construed with") {
        const term = (pos[1] ?? "").trim();
        if (term) return `construed with ${stripWikiMarkup(term).trim() || term}`;
    }
    return null;
}

function glossFromDefinitionLine(
    rawClean: string,
    gloss: string,
    _ctxLang: string,
): {
    displayGloss: string;
    only_used_in?: OnlyUsedIn;
} {
    const trimmed = gloss.trim();
    if (trimmed) return { displayGloss: trimmed };
    const oui = decodeOnlyUsedInFromRaw(rawClean);
    if (oui) {
        return { displayGloss: formatOnlyUsedInPlain(oui), only_used_in: oui };
    }
    const tpls = parseTemplates(rawClean);
    for (const t of tpls) {
        const fog = glossFromFormOfTemplateCall(t);
        if (fog) return { displayGloss: fog };
        const aux = glossFromAuxDefinitionTemplate(t);
        if (aux) return { displayGloss: aux };
    }
    return { displayGloss: rawClean.trim() };
}

function parseSenses(lines: string[], ctxLang: string): Sense[] {
    const senses: Sense[] = [];
    let counter = 0;
    let pendingLabels: string[] = [];
    let pendingTopics: string[] = [];

    for (const line of lines) {
        const defMatch = line.match(/^#\s+(.+)$/);
        if (defMatch) {
            const raw = defMatch[1];

            // 1. Extract {{lb|...}} labels/topics and strip from raw
            const { labels, topics } = parseLbTemplate(raw);
            const rawClean = stripLbTemplates(raw);

            // 2. Strip wiki markup to get plain gloss
            const glossFull = stripWikiMarkup(rawClean);

            // 3. Extract trailing parenthetical qualifier
            const { clean: gloss, qualifier } = extractQualifier(glossFull);
            const fromDef = glossFromDefinitionLine(rawClean, gloss, ctxLang);
            const displayGloss = fromDef.displayGloss;

            // Some entries use a label-only line before the actual definition.
            // Keep those labels/topics and apply them to the next non-empty gloss.
            if (!displayGloss) {
                if (labels.length > 0) pendingLabels = [...new Set([...pendingLabels, ...labels])];
                if (topics.length > 0) pendingTopics = [...new Set([...pendingTopics, ...topics])];
                continue;
            }

            counter++;

            const sense: Sense = {
                id: `S${counter}`,
                gloss: displayGloss,
                gloss_raw: raw,
            };
            if (fromDef.only_used_in) sense.only_used_in = fromDef.only_used_in;
            if (qualifier) sense.qualifier = qualifier;
            const allLabels = [...new Set([...pendingLabels, ...labels])];
            const allTopics = [...new Set([...pendingTopics, ...topics])];
            if (allLabels.length > 0) sense.labels = allLabels;
            if (allTopics.length > 0) sense.topics = allTopics;
            pendingLabels = [];
            pendingTopics = [];

            senses.push(sense);
            continue;
        }

        const subDefMatch = line.match(/^##\s+(.+)$/);
        if (subDefMatch && senses.length > 0) {
            const parent = senses[senses.length - 1];
            if (!parent.subsenses) parent.subsenses = [];
            const subId = `${parent.id}.${parent.subsenses.length + 1}`;
            const raw = subDefMatch[1];
            
            const { labels, topics } = parseLbTemplate(raw);
            const rawClean = stripLbTemplates(raw);
            const glossFull = stripWikiMarkup(rawClean);
            const { clean: gloss, qualifier } = extractQualifier(glossFull);
            const fromDef = glossFromDefinitionLine(rawClean, gloss, ctxLang);
            const displayGloss = fromDef.displayGloss;
            if (!displayGloss.trim()) continue;
            
            const sub: Sense = { id: subId, gloss: displayGloss, gloss_raw: raw };
            if (fromDef.only_used_in) sub.only_used_in = fromDef.only_used_in;
            if (qualifier) sub.qualifier = qualifier;
            if (labels.length > 0) sub.labels = labels;
            if (topics.length > 0) sub.topics = topics;
            
            parent.subsenses.push(sub);
            continue;
        }

        const exMatch = line.match(/^#[:*]+\s*(.+)$/);
        if (exMatch && senses.length > 0) {
            const parent = senses[senses.length - 1];
            if (!parent.examples) parent.examples = [];
            const raw = exMatch[1];
            
            // Check for structured example templates
            const tpls = parseTemplates(raw);
            const ux = tpls.find(t => ["ux", "usex", "quote", "quote-book", "quote-journal", "quote-web", "quote-video game"].includes(t.name.toLowerCase()));
            if (ux) {
                const pos = ux.params.positional ?? [];
                const named = ux.params.named ?? {};
                
                let text = "";
                let translation = "";
                
                if (ux.name.toLowerCase().includes("quote")) {
                    text = named.text || named.passage || pos[2] || pos[1] || "";
                    translation = named.translation || named.t || pos[3] || "";
                } else {
                    // ux / usex: pos[0]=lang, pos[1]=text, pos[2]=translation
                    text = named.text || pos[1] || "";
                    translation = named.translation || named.t || pos[2] || "";
                }

                const example: any = {
                    text: stripWikiMarkup(text).trim(),
                    translation: stripWikiMarkup(translation).trim(),
                    transliteration: named.tr || undefined,
                    author: named.author || undefined,
                    year: named.year || undefined,
                    source: named.source || named.title || undefined,
                    raw: ux.raw
                };
                
                if (example.text) {
                    parent.examples.push(example);
                } else {
                    parent.examples.push(stripWikiMarkup(raw));
                }
            } else {
                parent.examples.push(stripWikiMarkup(raw));
            }
        }
    }

    return senses;
}

function formatUsageNoteLine(rawLine: string): string {
    const refs: string[] = [];
    const withMarkers = rawLine
        .replace(/<ref\b[^>]*>([\s\S]*?)<\/ref>/gi, (_m, inner: string) => {
            const cleaned = stripWikiMarkup(inner, { preserveEmphasis: true }).trim();
            if (!cleaned) return "";
            refs.push(cleaned);
            return ` [${refs.length}]`;
        })
        .replace(/<ref\b[^>]*\/>/gi, "");

    const base = stripWikiMarkup(withMarkers, { preserveEmphasis: true }).trim();
    if (!base) return "";
    if (refs.length === 0) return base;

    const footnotes = refs.map((r, idx) => `[${idx + 1}] ${r}`).join(" ");
    return `${base} (${footnotes})`;
}

registry.register({
    id: "senses",
    handlesTemplates: [],
    matches: (ctx) => ctx.lines.some((l) => /^#\s+/.test(l)),
    decode: (ctx) => {
        const lang = String(ctx.lang ?? "en");
        const senses = parseSenses(ctx.lines, lang);
        if (senses.length === 0) return {};
        return { entry: { senses } };
    },
});

/** --- Headword morphology decoders (el-verb, el-noun) --- **/

/** Maps param key pairs to transitivity value. */
function decodeTransitivity(named: Record<string, string>): "transitive" | "intransitive" | "both" | null {
    const hasTr = named["tr"] === "yes" || named["tr"] === "1" || named["type"] === "tr";
    const hasIntr = named["intr"] === "yes" || named["intr"] === "1" || named["type"] === "intr" || named["intrans"] === "yes";
    if (hasTr && hasIntr) return "both";
    if (hasTr) return "transitive";
    if (hasIntr) return "intransitive";
    return null;
}

/** Maps {{el-verb}} principal-parts param names to slot names. */
const VERB_PART_PARAMS: Array<[string, string]> = [
    ["past", "simple_past"],
    ["past2", "simple_past_alt"],
    ["pres_pass", "present_passive"],
    ["perf_pass", "perfect_passive"],
    ["fut", "future_active"],
    ["fut_pass", "future_passive"],
];

registry.register({
    id: "el-verb-morphology",
    handlesTemplates: ["el-verb"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-verb"),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => t.name === "el-verb");
        if (!t) return {};
        const named = t.params.named ?? {};
        const transitivity = decodeTransitivity(named);
        const principal_parts: Record<string, string> = {};
        for (const [param, slot] of VERB_PART_PARAMS) {
            if (named[param]) principal_parts[slot] = named[param];
        }
        const aspect = named["asp"] === "perf" ? "perfective" : (named["asp"] === "impf" ? "imperfective" : null);
        const voice = named["voice"] === "act" ? "active" : (named["voice"] === "pass" ? "passive" : (named["voice"] === "mp" ? "mediopassive" : null));
        return {
            entry: {
                part_of_speech: "verb",
                headword_morphology: {
                    ...(transitivity !== null && { transitivity }),
                    ...(aspect !== null && { aspect }),
                    ...(voice !== null && { voice }),
                    ...(Object.keys(principal_parts).length > 0 && { principal_parts }),
                },
            },
        };
    },
});

const GENDER_MAP: Record<string, "masculine" | "feminine" | "neuter" | "common"> = {
    m: "masculine", masc: "masculine", masculine: "masculine",
    f: "feminine", fem: "feminine", feminine: "feminine",
    n: "neuter", neut: "neuter", neuter: "neuter",
    c: "common", common: "common",
};

registry.register({
    id: "el-noun-gender",
    handlesTemplates: ["el-noun"],
    matches: (ctx) => ctx.templates.some((t) => t.name === "el-noun"),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => t.name === "el-noun");
        if (!t) return {};
        const named = t.params.named ?? {};
        const pos = t.params.positional ?? [];
        // Gender is usually the first positional param or the `g=` named param
        const rawGender = named["g"] || named["gender"] || pos[0] || "";
        const gender = GENDER_MAP[rawGender.toLowerCase()] || null;
        return {
            entry: {
                part_of_speech: "noun",
                ...(gender !== null && { headword_morphology: { gender } }),
            },
        };
    },
});

/** Latin {{la-noun}} / {{la-proper noun}}: |g= / |g2= or .M/.F/.N in |1= subtype (see Template:la-noun). */
function decodeLaNounGenderFromTemplate(t: TemplateCall): "masculine" | "feminine" | "neuter" | null {
    const named = t.params.named ?? {};
    const pos = t.params.positional ?? [];
    const rawNamed = (named["g"] || named["g2"] || "").toString().trim();
    if (rawNamed) {
        const first = rawNamed.split(/[,|]/)[0].trim().charAt(0).toLowerCase();
        const g = GENDER_MAP[first];
        if (g && g !== "common") return g;
    }
    const p1 = pos[0] || "";
    const m = p1.match(/\.([MFN])(?:>|$|\s)/i);
    if (m) {
        const L = m[1].toUpperCase();
        if (L === "M") return "masculine";
        if (L === "F") return "feminine";
        if (L === "N") return "neuter";
    }
    return null;
}

registry.register({
    id: "la-noun-head",
    handlesTemplates: ["la-noun", "la-proper noun"],
    matches: (ctx) =>
        ctx.templates.some((t) => t.name === "la-noun" || t.name === "la-proper noun"),
    decode: (ctx) => {
        const t = ctx.templates.find((t) => t.name === "la-noun" || t.name === "la-proper noun");
        if (!t) return {};
        const gender = decodeLaNounGenderFromTemplate(t);
        return {
            entry: {
                part_of_speech: "noun",
                ...(gender !== null && { headword_morphology: { gender } }),
            },
        };
    },
});

/** --- Phase 2.2: Semantic relations --- **/

/** True if `wikitext` contains a section heading for `headerName` (any `=` run, spacing-tolerant). */
function matchesSectionHeading(wikitext: string, headerName: string): boolean {
    const re = new RegExp(
        `^=+\\s*${headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=+.*$`,
        "im",
    );
    return re.test(wikitext);
}

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
    "Coordinate terms": "coordinate_terms",
    "Holonyms": "holonyms",
    "Meronyms": "meronyms",
    "Troponyms": "troponyms",
} as const;

registry.register({
    id: "semantic-relations",
    handlesTemplates: ["syn", "ant", "hyper", "hypo"],
    matches: (ctx) =>
        ctx.templates.some((t) => Object.keys(RELATION_TEMPLATES).includes(t.name)) ||
        Object.keys(RELATION_HEADERS).some((h) => matchesSectionHeading(ctx.posBlockWikitext, h)),
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
        for (const key of Object.keys(relations) as Array<keyof import("./types").SemanticRelations>) {
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

registry.register({
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

registry.register({
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
registry.register({
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

registry.register({
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

/** --- Alternative forms section --- **/
registry.register({
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
            const lTpl = tpls.find(t => t.name === "l" || t.name === "link" || t.name === "alt");
            if (lTpl) {
                const pos = lTpl.params.positional ?? [];
                const term = lTpl.name === "alt" ? (pos[1] ?? "") : (pos[1] ?? "");
                const qualifier = lTpl.params.named?.["qual"] || lTpl.params.named?.["q"] || undefined;
                if (term) items.push({ term, qualifier, raw: trimmed });
            } else {
                // Plain wikilink fallback: [[term]]
                const m = trimmed.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
                if (m) items.push({ term: m[1].trim(), raw: trimmed });
            }
        }
        if (items.length === 0) return {};
        return { entry: { alternative_forms: items } };
    },
});

/** --- See also section --- **/
registry.register({
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
            // Wikilink fallback
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

/** --- Anagrams section --- **/
registry.register({
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
            // Try {{l}} template first
            const tpls = parseTemplates(trimmed);
            for (const t of tpls) {
                if (t.name === "l" || t.name === "link") {
                    const term = t.params.positional?.[1];
                    if (term) anagrams.push(term);
                }
            }
            // Plain wikilink fallback
            if (anagrams.length === 0 || !tpls.some(t => t.name === "l" || t.name === "link")) {
                const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
                let m;
                while ((m = re.exec(trimmed)) !== null) {
                    const term = m[1].trim();
                    if (!anagrams.includes(term)) anagrams.push(term);
                }
            }
            // Plain comma-separated words fallback (no templates or links)
            if (!trimmed.includes("{{") && !trimmed.includes("[[") && trimmed.match(/^[\w\s,]+$/)) {
                for (const word of trimmed.split(",").map(s => s.trim()).filter(Boolean)) {
                    if (!anagrams.includes(word)) anagrams.push(word);
                }
            }
        }
        if (anagrams.length === 0) return {};
        return { entry: { anagrams } };
    },
});

/** --- Usage notes (===Usage notes=== or ===Notes===); single decoder — formatUsageNoteLine handles refs/templates --- **/
registry.register({
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

/** --- References section --- **/
registry.register({
    id: "references",
    handlesTemplates: [],
    matches: (ctx) => /^=+\s*References\s*=+/im.test(ctx.posBlockWikitext),
    decode: (ctx) => {
        const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "References");
        if (!section) return {};
        const refs = section.raw.split("\n").map(l => stripWikiMarkup(l).trim()).filter(Boolean);
        if (refs.length === 0) return {};
        return { entry: { references: refs } };
    },
});

/** --- Inflection Table Reference --- **/
registry.register({
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
registry.register({
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

registry.register({
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
