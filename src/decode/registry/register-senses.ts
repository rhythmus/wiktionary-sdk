import { parseTemplates } from "../../parse/parser";
import type { OnlyUsedIn, Sense, TemplateCall } from "../../model";
import { buildFormOfDisplayLabel } from "./form-of-display-label";
import { isFormOfTemplateName, isPerLangFormOfTemplate } from "./form-of-predicates";
import type { DecoderRegistry } from "./decoder-registry";
import { stripWikiMarkup } from "./strip-wiki-markup";

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
    const lb = tpls.find((t) => t.name === "lb" || t.name === "label");
    if (!lb) return { labels: [], topics: [] };
    const pos = lb.params.positional ?? [];
    // pos[0] is lang code, rest are labels
    const allLabels = pos.slice(1).filter(Boolean).map((l) => l.replace(/_/g, " "));
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
    if (n === "iso 639") {
        const part = (pos[0] ?? "").trim();
        const partLabel = part ? `ISO 639-${part}` : "ISO 639";
        return `${partLabel} language code`;
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
            const ux = tpls.find((t) =>
                ["ux", "usex", "quote", "quote-book", "quote-journal", "quote-web", "quote-video game"].includes(
                    t.name.toLowerCase(),
                ),
            );
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

                const example: {
                    text: string;
                    translation: string;
                    transliteration?: string;
                    author?: string;
                    year?: string;
                    source?: string;
                    raw: string;
                } = {
                    text: stripWikiMarkup(text).trim(),
                    translation: stripWikiMarkup(translation).trim(),
                    transliteration: named.tr || undefined,
                    author: named.author || undefined,
                    year: named.year || undefined,
                    source: named.source || named.title || undefined,
                    raw: ux.raw,
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

/** Sense pipeline: `#` definitions, subsenses, examples (historical registration order). */
export function registerSenses(reg: DecoderRegistry): void {
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
}
