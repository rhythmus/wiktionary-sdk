import type {
    Sense,
    OnlyUsedIn,
    EtymologyLink,
    SectionWithLinks,
    TemplateCall,
} from "../types";
import { parseTemplates } from "../parser";
import { buildFormOfDisplayLabel } from "./form-of-display-label";
import { isFormOfTemplateName, isPerLangFormOfTemplate } from "./form-of-predicates";
import { stripWikiMarkup } from "./strip-wiki-markup";
import type { DecoderRegistry } from "./decoder-registry";
import { GENDER_MAP } from "./gender-map";
import {
    extractSectionByLevelHeaders,
    matchesSectionHeading,
    parseSectionLinkTemplates,
} from "./section-extract";
import { registerCoreAndPronunciation } from "./register-core-pronunciation";
import { registerHeadwordsElNlDe } from "./register-headwords-el-nl-de";
import { registerFormOfWikidata } from "./register-form-of-wikidata";
import { registerTranslations } from "./register-translations";

/**
 * Register all template/section decoders in **historical source order**.
 * Call once per {@link DecoderRegistry} instance (typically the package singleton).
 */
export function registerAllDecoders(reg: DecoderRegistry): void {
registerCoreAndPronunciation(reg);
registerHeadwordsElNlDe(reg);
registerFormOfWikidata(reg);
registerTranslations(reg);

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

reg.register({
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

reg.register({
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

reg.register({
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

reg.register({
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
