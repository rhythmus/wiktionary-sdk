import { parseMorphologyTags } from "./morphology";
import type { Lexeme } from "./types";

/**
 * Expand en.wiktionary "first/third-person singular …" style lines into two explicit lines.
 */
export function expandDualPersonInflectionLine(line: string): string[] {
    const t = line.trim();
    if (!t) return [];
    const m = t.match(/^(first|second|third)\/(first|second|third)-person(\s+.+\s*)$/i);
    if (m) {
        const rest = m[3].trim();
        const a = m[1].toLowerCase();
        const b = m[2].toLowerCase();
        return [`${a}-person ${rest}`, `${b}-person ${rest}`];
    }
    return [t];
}

/** Known short codes in form-of template positionals (en.wiktionary); excludes gender (shown with PoS). */
const MORPH_ABBREV_TOKEN = new Set([
    "1", "2", "3", "s", "sg", "p", "pl", "nom", "gen", "acc", "voc",
    "pres", "impf", "ipf", "spast", "aor", "fut", "perf", "plup",
    "ind", "indc", "sub", "subj", "imp", "impr",
    "act", "actv", "pass", "psv", "mid", "m-p", "mpsv",
    "1s", "2s", "3s", "1p", "2p", "3p", "1sg", "2sg", "3sg", "1pl", "2pl", "3pl",
]);

function isMorphAbbrevToken(s: string): boolean {
    const t = s.trim().toLowerCase();
    if (!t) return false;
    if (t === "m" || t === "f" || t === "n") return true;
    if (MORPH_ABBREV_TOKEN.has(t)) return true;
    if (/^[1-3](?:s|sg|p|pl)$/i.test(t)) return true;
    return false;
}

function formOfMorphCandidateLines(entry: Lexeme): string[] {
    const sense0 = entry.senses?.[0];
    const fromSubs = sense0?.subsenses?.map((s) => String(s.gloss ?? "").trim()).filter(Boolean) ?? [];
    if (fromSubs.length > 0) return fromSubs;
    return (entry.form_of?.tags ?? []).map((x) => String(x).trim()).filter(Boolean);
}

/** Human phrase from abbrev tags (gender omitted; shown via posLine / headword_morphology). */
export function inflectionPhraseFromMorphTags(tags: string[]): string {
    const tr = parseMorphologyTags(tags);
    const parts: string[] = [];

    if (tr.case) {
        parts.push(tr.case);
        if (tr.number) parts.push(tr.number === "singular" ? "singular" : "plural");
        return parts.join(" ");
    }

    if (tr.person) {
        const ord = tr.person === "1" ? "first" : tr.person === "2" ? "second" : "third";
        parts.push(`${ord}-person`);
    }
    if (tr.number) parts.push(tr.number === "singular" ? "singular" : "plural");
    if (tr.tense) parts.push(tr.tense);
    if (tr.mood && (tr.mood !== "indicative" || tr.tense || tr.person)) parts.push(tr.mood);
    if (tr.voice && tr.voice !== "active") parts.push(tr.voice);

    return parts.join(" ");
}

/**
 * True when every gloss/tag line is a short inflection code (e.g. la-participle `voc|m|s`),
 * not a prose definition sub-bullet — those stay as a bullet list.
 */
export function formOfMorphLinesAreAbbrevTokensOnly(entry: Lexeme): boolean {
    const lines = formOfMorphCandidateLines(entry);
    if (lines.length === 0) return false;
    if (!lines.every(isMorphAbbrevToken)) return false;
    return inflectionPhraseFromMorphTags(lines).length > 0;
}

/** Inline qualifiers before "of:" when tags are abbrev-only (e.g. "vocative singular"). */
export function formOfMorphInlinePhrase(entry: Lexeme): string {
    if (!formOfMorphLinesAreAbbrevTokensOnly(entry)) return "";
    const lines = formOfMorphCandidateLines(entry);
    return inflectionPhraseFromMorphTags(lines);
}

/**
 * Morphology lines for an inflected/form-of lexeme: prefer ===Definition=== subbullets (##),
 * else positional tags from the form-of template (each tag may expand for first/third-person).
 * Abbrev-only tag runs (e.g. voc|m|s) do not produce bullets — use {@link formOfMorphInlinePhrase}.
 */
export function inflectionMorphDisplayLines(entry: Lexeme): string[] {
    if (formOfMorphLinesAreAbbrevTokensOnly(entry)) return [];

    const sense0 = entry.senses?.[0];
    const fromSubs = sense0?.subsenses?.map((s) => String(s.gloss ?? "").trim()).filter(Boolean) ?? [];
    if (fromSubs.length > 0) {
        return fromSubs.flatMap((s) => expandDualPersonInflectionLine(s));
    }
    const fromParse = entry.form_of?.display_morph_lines;
    if (fromParse && fromParse.length > 0) {
        return fromParse.flatMap((s) => expandDualPersonInflectionLine(s));
    }
    const tags = entry.form_of?.tags ?? [];
    const out: string[] = [];
    for (const tag of tags) {
        const tt = String(tag).trim();
        if (!tt) continue;
        out.push(...expandDualPersonInflectionLine(tt));
    }
    return out;
}
