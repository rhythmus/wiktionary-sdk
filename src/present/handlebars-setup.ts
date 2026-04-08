import type { Lexeme } from "../model";
import Handlebars from "handlebars";
import { etymSourceLangDisplayName } from "../parse/parser";
import { formOfMorphInlinePhrase, inflectionMorphDisplayLines } from "../form-of-display";
import {
    HTML_ENTRY_TEMPLATE,
    MD_ENTRY_TEMPLATE,
    ENTRY_CSS,
    HTML_LEXEME_HOMONYM_GROUP_TEMPLATE,
} from "./templates/templates";
import { smartQuotes } from "./smart-quotes";
export { smartQuotes } from "./smart-quotes";

// ---------------------------------------------------------
// HANDLEBARS SETUP
// ---------------------------------------------------------

// Register Helpers
Handlebars.registerHelper("join", (arr: string[] | undefined, sep: string) => {
    if (!arr) return "";
    return arr.join(sep);
});

Handlebars.registerHelper("or", (v1: any, v2: any) => {
    return v1 || v2;
});

Handlebars.registerHelper("addOne", (index: number) => {
    return index + 1;
});

Handlebars.registerHelper("toUpperCase", (str: string | undefined) => {
    return str ? str.toUpperCase() : "";
});

Handlebars.registerHelper("currentDate", () => {
    return new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
});

Handlebars.registerHelper("ifCond", function (this: any, v1: any, operator: string, v2: any, options: Handlebars.HelperOptions) {
    switch (operator) {
        case "==": return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case "===": return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case "!=": return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case "!==": return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case "<": return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case "<=": return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case ">": return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case ">=": return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case "&&": return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case "||": return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default: return options.inverse(this);
    }
});

/** Connector between etymology chain steps (default lineage edge; lemma→first step uses the same "<" in the template). */
Handlebars.registerHelper("etymSymbol", (relation: string) => {
    switch (relation) {
        case "alternative": return "~";
        case "borrowed": return "bor.";
        case "cognate": return "cog.";
        default:
            return "<";
    }
});

/** EtymologyLink: decoders set `source_lang`; optional `source_lang_name` wins, else code → human label. */
Handlebars.registerHelper("langLabel", (link: { source_lang_name?: string; source_lang?: string } | undefined) => {
    if (!link || typeof link !== "object") return "";
    const name = link.source_lang_name?.trim();
    if (name) return name;
    const code = link.source_lang?.trim();
    if (!code) return "";
    return etymSourceLangDisplayName(code);
});

/** Dictionary-style gender next to noun PoS (masc. / fem. / neut.). */
function formatGenderForPosLine(gender: string): string {
    const g = gender.toLowerCase().trim();
    if (g === "masculine" || g === "m") return "masc.";
    if (g === "feminine" || g === "f") return "fem.";
    if (g === "neuter" || g === "n") return "neut.";
    return gender;
}

/** PoS line: nouns (and proper nouns) append headword gender when present (dictionary convention). */
Handlebars.registerHelper("posLine", (entry: Record<string, unknown>) => {
    let raw = String(
        (entry?.pos ?? entry?.part_of_speech ?? entry?.lexicographic_section) ?? "",
    ).trim();
    if (!raw) raw = String(entry?.part_of_speech_heading ?? "").trim();
    if (!raw) return "(unknown)";
    const normalized = raw.toLowerCase().replace(/_/g, " ");
    const isNounLike =
        normalized === "noun" || normalized === "proper noun" || normalized === "proper_noun";
    const gender = (entry?.headword_morphology as { gender?: string } | undefined)?.gender;
    const display = raw.replace(/_/g, " ");
    if (isNounLike && gender) {
        return `${display}  ${formatGenderForPosLine(gender)}`;
    }
    return display;
});

/**
 * Apply typographic smart quotes to all prose text fields in a lexeme context
 * (glosses, usage notes, etymology glosses, definitions) before template rendering.
 * Leaves term/headword/label fields unchanged.
 */
export function applySmartQuotesToContext(ctx: Record<string, unknown>): Record<string, unknown> {
    const lang = typeof ctx.language === "string" ? ctx.language : undefined;
    if (Array.isArray(ctx.senses)) {
        ctx.senses = (ctx.senses as any[]).map((s) => applySqToSense(s, lang));
    }
    if (ctx.etymology && typeof ctx.etymology === "object") {
        const etym = ctx.etymology as Record<string, unknown>;
        if (Array.isArray(etym.chain)) {
            etym.chain = (etym.chain as any[]).map((step) =>
                step?.gloss ? { ...step, gloss: smartQuotes(step.gloss, lang) } : step
            );
        }
        if (Array.isArray(etym.cognates)) {
            etym.cognates = (etym.cognates as any[]).map((cog) =>
                cog?.gloss ? { ...cog, gloss: smartQuotes(cog.gloss, lang) } : cog
            );
        }
        ctx.etymology = etym;
    }
    return ctx;
}

function applySqToSense(sense: any, lang: string | undefined): any {
    const out = { ...sense };
    if (typeof out.gloss === "string") out.gloss = smartQuotes(out.gloss, lang);
    if (typeof out.definition === "string") out.definition = smartQuotes(out.definition, lang);
    if (Array.isArray(out.subsenses)) {
        out.subsenses = out.subsenses.map((ss: any) => applySqToSense(ss, lang));
    }
    return out;
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function applyInlineEmphasis(htmlEscapedText: string): string {
    return htmlEscapedText
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderUsageNoteWithRefLinks(note: string): Handlebars.SafeString {
    const m = note.match(/^(.*)\(\s*((?:\[\d+\]\s+.+?)*)\s*\)\s*$/);
    if (!m) return new Handlebars.SafeString(applyInlineEmphasis(escapeHtml(note)));

    const body = m[1].trim();
    const refsChunk = m[2] || "";
    const refMap = new Map<number, string>();
    const refRe = /\[(\d+)\]\s+(.+?)(?=(?:\s+\[\d+\]\s+)|$)/g;
    let r: RegExpExecArray | null;
    while ((r = refRe.exec(refsChunk)) !== null) {
        const idx = Number(r[1]);
        const val = r[2].trim();
        if (!Number.isFinite(idx) || !val) continue;
        const urlMatch = val.match(/https?:\/\/\S+/i);
        if (urlMatch) {
            const cleanUrl = urlMatch[0].replace(/[),.;]+$/g, "");
            refMap.set(idx, cleanUrl);
        }
    }

    const htmlWithRefs = escapeHtml(body).replace(/\[(\d+)\]/g, (_full, nRaw: string) => {
        const n = Number(nRaw);
        const href = refMap.get(n);
        if (!href) return `<sup class="usage-ref">ref</sup>`;
        const safeHref = escapeHtml(href);
        return `<sup class="usage-ref"><a href="${safeHref}" target="_blank" rel="noopener noreferrer">ref</a></sup>`;
    });

    return new Handlebars.SafeString(applyInlineEmphasis(htmlWithRefs));
}

function tryMergePersonMorphLines(lines: string[]): string | null {
    const tryHyphen = (): { person: string; rest: string }[] | null => {
        const re = /^(first|second|third)-person(\s.+)$/i;
        const parsed = lines.map((l) => {
            const m = l.trim().match(re);
            return m ? { person: m[1].toLowerCase(), rest: m[2].trim() } : null;
        });
        return parsed.every((p): p is NonNullable<typeof p> => p !== null) ? parsed : null;
    };
    /** English-style "first person …" (space, not first-person). */
    const trySpaced = (): { person: string; rest: string }[] | null => {
        const re = /^(first|second|third)\s+person(\s.+)$/i;
        const parsed = lines.map((l) => {
            const m = l.trim().match(re);
            return m ? { person: m[1].toLowerCase(), rest: m[2].trim() } : null;
        });
        return parsed.every((p): p is NonNullable<typeof p> => p !== null) ? parsed : null;
    };
    const hyphen = tryHyphen();
    const spaced = hyphen ? null : trySpaced();
    const parsed = hyphen ?? spaced;
    const joinWord = hyphen ? "and" : "or";
    if (!parsed) return null;
    const rest0 = parsed[0]!.rest;
    if (!parsed.every((p) => p.rest === rest0)) return null;
    const persons = parsed.map((p) => p.person);
    if (persons.length === 2) {
        const [p1, p2] = persons;
        if ((p1 === "first" && p2 === "third") || (p1 === "third" && p2 === "first")) {
            return `first ${joinWord} third person ${rest0}`;
        }
        return `${p1} or ${p2} person ${rest0}`;
    }
    if (persons.length > 2) return `${persons.join(", ")} person ${rest0}`;
    return null;
}

/**
 * Collapse multiple morph lines into one phrase (template mocks L-06, L-07).
 * Prefers person-merged wording; otherwise joins with " · ".
 */
export function formOfMorphMergedProseLine(entry: Lexeme): string {
    const lines = inflectionMorphDisplayLines(entry);
    if (lines.length < 2) return "";
    const norm = lines.map((l) => l.trim().replace(/\s+/g, " "));
    if (norm.length >= 3) {
        const head = tryMergePersonMorphLines(norm.slice(0, 2));
        if (head) return `${head} · ${norm.slice(2).join(" · ")}`;
    }
    const merged = tryMergePersonMorphLines(norm);
    if (merged) return merged;
    if (norm.length === 2 && /person/i.test(norm[0]) && /person/i.test(norm[1])) {
        return `${norm[0]} or ${norm[1]}`;
    }
    return norm.join(" · ");
}

/** Two or more morph lines → bullet list (fallback when merged phrase is empty — should not occur for 2+ prose lines). */
export function inflectionMorphBulletItems(entry: Lexeme): string[] {
    const lines = inflectionMorphDisplayLines(entry);
    if (lines.length < 2) return [];
    if (formOfMorphMergedProseLine(entry)) return [];
    return lines;
}

export function hasFormOfMorphBullets(entry: Lexeme): boolean {
    return inflectionMorphBulletItems(entry).length > 0;
}

/** Exactly one morph line → inline next to surface (e.g. "ing-form"), not a &lt;ul&gt;. */
export function formOfMorphSingleLinePhrase(entry: Lexeme): string {
    const lines = inflectionMorphDisplayLines(entry);
    return lines.length === 1 ? lines[0] : "";
}

/** Lowercase headline label ("Plural of" → "plural of") for compact form-of row. */
export function formOfLabelDisplayLower(entry: Lexeme): string {
    const raw = entry.form_of?.label?.trim();
    if (!raw) return "";
    return raw.toLowerCase();
}

/**
 * Single-line inflected card (mock L-05): surface + label + lemma + one gloss, no `→` row.
 */
export function formOfUltraCompactEligible(entry: Lexeme): boolean {
    if (!entry.form_of) return false;
    if (entry.type === "FORM_OF") return false;
    if (formOfMorphInlinePhrase(entry)) return false;
    if (formOfMorphSingleLinePhrase(entry)) return false;
    if (hasFormOfMorphBullets(entry)) return false;
    if (inflectionMorphDisplayLines(entry).length > 1) return false;
    const s = entry.senses;
    if (!s || s.length !== 1) return false;
    if (s[0].subsenses && s[0].subsenses.length > 0) return false;
    const g = (s[0].gloss ?? "").trim();
    return Boolean(g);
}

/** e.g. `plural of:` / `inflected form of:` — avoids `plural of of:` when label already ends with “of”. */
export function formOfUltraCompactLabel(entry: Lexeme): string {
    const l = formOfLabelDisplayLower(entry);
    if (!l) return "inflected form of:";
    const trimmed = l.replace(/:\s*$/, "").trim();
    if (/\bof$/.test(trimmed)) return `${trimmed}:`;
    return `${trimmed} of:`;
}

/**
 * Minimal HTML for the inflected-form headline (surface + optional morph bullets + "of:"),
 * matching entry.html.hbs. Pair with a nested full lemma fragment (→ lemma body).
 */
export function formatInflectedFormHeadline(entry: Lexeme): string {
    if (!entry.form_of) return "";
    const surface = (entry as Lexeme & { headword?: string }).headword ?? entry.form;
    const headword = escapeHtml(String(surface || "").trim());
    const inlinePhrase = formOfMorphInlinePhrase(entry);
    const bullets = inflectionMorphBulletItems(entry);
    const single = formOfMorphSingleLinePhrase(entry);
    const labelLower = escapeHtml(formOfLabelDisplayLower(entry));
    const sub = entry.form_of.subclass ? escapeHtml(entry.form_of.subclass) : "";
    const ofCompact = `<span class="form-of-of-inline"> of:</span>`;
    const surf = `<span class="form-of-surface${sub ? ` ${sub}` : ""}">${headword}</span>`;

    if (inlinePhrase) {
        const q = escapeHtml(inlinePhrase);
        return `<div class="wiktionary-entry is-redirect is-form-headline"><div class="entry-body"><div class="form-of-head-stack"><span class="entry-line entry-line-head form-of-compact-line form-of-inline-morph">${surf}<strong class="form-of-morph-inline"> ${q}</strong>${ofCompact}</span></div></div></div>`;
    }

    const merged = formOfMorphMergedProseLine(entry);
    if (merged) {
        const q = escapeHtml(merged);
        return `<div class="wiktionary-entry is-redirect is-form-headline"><div class="entry-body"><div class="form-of-head-stack form-of-merged-morph"><span class="entry-line entry-line-head form-of-compact-line form-of-merged-morph-line">${surf}<strong class="form-of-morph-inline"> ${q}</strong>${ofCompact}</span></div></div></div>`;
    }

    if (bullets.length >= 2) {
        const ul = `<ul class="form-of-morph-lines">${bullets.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
        const ofSolo = `<div class="form-of-of-line-solo"><span class="inline-sep">of:</span></div>`;
        return `<div class="wiktionary-entry is-redirect is-form-headline"><div class="entry-body"><div class="form-of-head-stack form-of-multiline-morph"><span class="entry-line entry-line-head form-of-surface-alone">${surf}</span>${ul}${ofSolo}</div></div></div>`;
    }

    if (single) {
        const q = escapeHtml(single);
        return `<div class="wiktionary-entry is-redirect is-form-headline"><div class="entry-body"><div class="form-of-head-stack"><span class="entry-line entry-line-head form-of-compact-line">${surf}<strong class="form-of-morph-inline"> ${q}</strong>${ofCompact}</span></div></div></div>`;
    }

    const kind = labelLower ? `<span class="form-of-kind-inline inflection-label">${labelLower}</span>` : "";
    return `<div class="wiktionary-entry is-redirect is-form-headline"><div class="entry-body"><div class="form-of-head-stack"><span class="entry-line entry-line-head form-of-compact-line">${surf}${kind ? ` ${kind}` : ""}${ofCompact}</span></div></div></div>`;
}

/** Subexpression helpers for form-of Handlebars branches */
Handlebars.registerHelper("formOfMorphBulletItems", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return [];
    return inflectionMorphBulletItems(entry);
});
Handlebars.registerHelper("hasFormOfMorphBullets", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return false;
    return hasFormOfMorphBullets(entry);
});
Handlebars.registerHelper("formOfMorphSingleLinePhrase", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return "";
    return formOfMorphSingleLinePhrase(entry);
});
Handlebars.registerHelper("formOfLabelLower", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return "";
    return formOfLabelDisplayLower(entry);
});
Handlebars.registerHelper("formOfMorphInlinePhrase", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return "";
    return formOfMorphInlinePhrase(entry);
});
Handlebars.registerHelper("formOfMorphMergedProseLine", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return "";
    return formOfMorphMergedProseLine(entry);
});
Handlebars.registerHelper("formOfUltraCompactEligible", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return false;
    return formOfUltraCompactEligible(entry);
});
Handlebars.registerHelper("formOfUltraCompactLabel", (entry: Lexeme | undefined) => {
    if (!entry || typeof entry !== "object") return "";
    return formOfUltraCompactLabel(entry);
});

export const htmlEntryTemplate = Handlebars.compile(HTML_ENTRY_TEMPLATE);
export const htmlHomonymGroupTemplate = Handlebars.compile(HTML_LEXEME_HOMONYM_GROUP_TEMPLATE);
export const mdEntryTemplate = Handlebars.compile(MD_ENTRY_TEMPLATE);
export const entryCss = ENTRY_CSS;
