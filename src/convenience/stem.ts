import { wiktionary } from "../pipeline/wiktionary-core";
import type { Lexeme, WikiLang } from "../model";
import { mapLexemes, type GroupedLexemeResults } from "./grouped-results";
import { withExtractionSupport } from "./extraction-support";
import { lemma } from "./lemma-translate";

export interface VerbStems {
    present?: string[];
    dependent?: string[];
    imperfect?: string[];
    simple_past?: string[];
    passive_imperfect?: string[];
    passive_dependent?: string[];
    passive_simple_past?: string[];
    /** `grc-conj|fut*` — future active/middle and optional passive stems. */
    future?: string[];
    /** `grc-conj|perf*` — perfect stems (often reduplicated). */
    perfect?: string[];
    /** `grc-conj|plup*` — pluperfect stems. */
    pluperfect?: string[];
    /** `grc-conj|futp*` — future perfect stem(s). */
    future_perfect?: string[];
}

export interface WordStems {
    verb?: VerbStems;
    nominals?: string[];
    aliases: string[];
    /**
     * When `aliases` is empty for a lexeme that normally carries inflection paradigms,
     * explains whether the gap is due to **SDK template coverage** (not decoded families),
     * missing captured templates, or extraction rules—so callers do not confuse “no stems”
     * with “no data in Wiktionary”.
     */
    support_warning?: string;
}

/** Human-readable list of paradigm template families `extractStemsFromLexeme` reads (for messages and docs). */
export const STEM_PARADIGM_TEMPLATE_FAMILY_SUMMARY =
    "el-conjug-*, el-verb-*, el-noun-*, el-nM-*, el-nF-*, el-nN-*, el-adj-*, el-decl-*, grc-conj, grc-decl";

/** Greek script used in paradigm stem slots (Modern + Ancient / polytonic blocks). */
function isGreekStem(str: string): boolean {
    if (!str || str.length === 0) return false;
    // Greek & Coptic + Greek Extended (breve ᾰ/ῐ/ῠ, polytonic precomposed, etc.)
    return /^[-\u0370-\u03FF\u1F00-\u1FFF]+$/u.test(str.trim());
}

function isLexemeStemRelevant(lexeme: Lexeme): boolean {
    const p = lexeme.part_of_speech;
    if (p) {
        if (p === "noun" || p === "proper_noun" || p === "adjective" || p === "numeral" || p === "participle")
            return true;
        if (p.endsWith("_verb")) return true;
        if (/^v\d/.test(p)) return true;
    }
    const h = (lexeme.part_of_speech_heading || "").toLowerCase();
    return (
        /\bverb\b/.test(h) ||
        /\bnoun\b/.test(h) ||
        /\badj(?:ective)?\b/.test(h) ||
        /\bparticiple\b/.test(h) ||
        /\bnumeral\b/.test(h)
    );
}

function explainEmptyStemExtraction(
    lexeme: Lexeme,
    allTemplates: Array<{ name?: string }>,
    paradigmTemplates: Array<{ name?: string }>,
    hasAliases: boolean,
): string | undefined {
    if (hasAliases) return undefined;
    if (!isLexemeStemRelevant(lexeme)) return undefined;

    if (allTemplates.length === 0) {
        return `No wikitext templates were captured on this lexeme row. stem() takes stems only from explicit paradigm templates (${STEM_PARADIGM_TEMPLATE_FAMILY_SUMMARY} on en.wiktionary); it does not infer stems from prose or guess morphology.`;
    }
    if (paradigmTemplates.length === 0) {
        const allNames = [
            ...new Set(allTemplates.map((t) => String(t.name || "").trim()).filter(Boolean)),
        ];
        const names = allNames.slice(0, 8);
        const list = names.length ? names.join(", ") : "(unnamed)";
        const more = allNames.length > 8 ? " …" : "";
        return `This lexeme uses template families that stem extraction does not read yet (${list}${more}). An empty stem list here reflects SDK template coverage, not proof that the entry lacks stems. Supported families: ${STEM_PARADIGM_TEMPLATE_FAMILY_SUMMARY}.`;
    }
    const pnames = paradigmTemplates.map((t) => t.name).join(", ");
    return `Recognized paradigm template(s) (${pnames}) are present but no stems were extracted—check for unmapped parameters, characters outside allowed Greek stem scripts, or an unhandled grc-conj tense tag.`;
}

function isParadigmTemplate(name: string): boolean {
    return (
        name === "grc-conj" ||
        name === "grc-decl" ||
        name.startsWith("el-conjug-") ||
        name.startsWith("el-verb-") ||
        name.startsWith("el-noun-") ||
        name.startsWith("el-nM-") ||
        name.startsWith("el-nF-") ||
        name.startsWith("el-nN-") ||
        name.startsWith("el-adj-") ||
        name.startsWith("el-decl-")
    );
}

function addVerbStems(
    verb: VerbStems,
    slot: keyof VerbStems,
    values: string[],
    aliasesSet: Set<string>,
): void {
    if (values.length === 0) return;
    const prev = (verb as any)[slot] as string[] | undefined;
    (verb as any)[slot] = prev ? [...prev, ...values] : [...values];
    for (const v of values) aliasesSet.add(v);
}

/**
 * Ancient Greek `{{grc-conj|tense|stem…}}` per [[Template:grc-conj/documentation]].
 * First positional = tense code; further positionals = stems (length varies by tense).
 */
function extractGrcConjStems(
    tenseRaw: string,
    stemStrings: string[],
    out: WordStems,
    aliasesSet: Set<string>,
): void {
    const tense = tenseRaw.trim();
    if (!tense || stemStrings.length === 0) return;
    out.verb = out.verb || {};
    const v = out.verb;

    if (tense === "futp" || tense.startsWith("futp-")) {
        addVerbStems(v, "future_perfect", stemStrings, aliasesSet);
        return;
    }
    if (tense === "fut" || (tense.startsWith("fut-") && !tense.startsWith("futp"))) {
        addVerbStems(v, "future", stemStrings, aliasesSet);
        return;
    }
    if (tense === "pres" || tense.startsWith("pres-")) {
        addVerbStems(v, "present", stemStrings, aliasesSet);
        return;
    }
    if (tense === "imperf" || tense.startsWith("imperf-")) {
        addVerbStems(v, "imperfect", stemStrings, aliasesSet);
        return;
    }
    if (tense.startsWith("aor")) {
        if (stemStrings.length >= 4) {
            addVerbStems(v, "simple_past", [stemStrings[0], stemStrings[1]], aliasesSet);
            addVerbStems(v, "passive_simple_past", [stemStrings[2], stemStrings[3]], aliasesSet);
        } else {
            addVerbStems(v, "simple_past", stemStrings, aliasesSet);
        }
        return;
    }
    if (tense === "perf" || tense.startsWith("perf-")) {
        addVerbStems(v, "perfect", stemStrings, aliasesSet);
        return;
    }
    if (tense === "plup" || tense.startsWith("plup-")) {
        addVerbStems(v, "pluperfect", stemStrings, aliasesSet);
        return;
    }
    for (const s of stemStrings) aliasesSet.add(s);
}

/**
 * Pure extraction of stems from a lexeme's template data.
 * Operates on `templates_all` (which carries parsed params) so it
 * works per-lexeme without needing the raw language block.
 */
export function extractStemsFromLexeme(lexeme: Lexeme): WordStems {
    const templates = lexeme.templates_all || [];
    const paradigmTemplates = templates.filter((t: any) => isParadigmTemplate(t.name));

    const out: WordStems = { aliases: [] };
    const aliasesSet = new Set<string>();

    for (const t of paradigmTemplates) {
        const params: any = t.params || {};
        const named: Record<string, string> = params.named || {};
        const positional: string[] = params.positional || [];

        if (t.name === "grc-conj") {
            const tenseTag = positional[0] ?? "";
            const stemStrings = positional
                .slice(1)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0 && isGreekStem(s));
            extractGrcConjStems(tenseTag, stemStrings, out, aliasesSet);
            continue;
        }

        if (t.name === "grc-decl") {
            const p0 = positional[0]?.trim() ?? "";
            const p1 = positional[1]?.trim() ?? "";
            if (p0 === "indecl" || p0 === "irreg") {
                if (p1 && isGreekStem(p1)) {
                    out.nominals = out.nominals || [];
                    if (!out.nominals.includes(p1)) out.nominals.push(p1);
                    aliasesSet.add(p1);
                }
            } else {
                out.nominals = out.nominals || [];
                for (const s of [p0, p1]) {
                    if (s && isGreekStem(s) && !out.nominals.includes(s)) {
                        out.nominals.push(s);
                        aliasesSet.add(s);
                    }
                }
            }
            continue;
        }

        const isVerb = t.name.startsWith("el-conjug-") || t.name.startsWith("el-verb-");

        if (isVerb) {
            out.verb = out.verb || {};

            const extractToVerbAlias = (key: string, targetProp: keyof VerbStems) => {
                const val = named[key];
                if (val && isGreekStem(val)) {
                    if (!out.verb![targetProp]) out.verb![targetProp] = [];
                    out.verb![targetProp]!.push(val.trim());
                    aliasesSet.add(val.trim());
                }
            };

            extractToVerbAlias("present", "present");
            extractToVerbAlias("a-imperfect", "imperfect");
            extractToVerbAlias("a-dependent", "dependent");
            extractToVerbAlias("a-simplepast", "simple_past");

            extractToVerbAlias("p-imperfect", "passive_imperfect");
            extractToVerbAlias("p-dependent", "passive_dependent");
            extractToVerbAlias("p-dependent-2", "passive_dependent");
            extractToVerbAlias("p-simplepast", "passive_simple_past");
            extractToVerbAlias("p-simplepast-2", "passive_simple_past");

        } else {
            out.nominals = out.nominals || [];

            const posStems = positional
                .filter((s: string) => isGreekStem(s))
                .map((s: string) => s.trim());

            const namedStem = named.stem;
            if (namedStem && isGreekStem(namedStem)) posStems.push(namedStem.trim());

            for (const s of posStems) {
                if (!out.nominals.includes(s)) out.nominals.push(s);
                aliasesSet.add(s);
            }
        }
    }

    out.aliases = Array.from(aliasesSet);
    const warn = explainEmptyStemExtraction(lexeme, templates, paradigmTemplates, out.aliases.length > 0);
    if (warn) out.support_warning = warn;
    return out;
}

/**
 * Extracts morphologically critical stem boundaries from Wiktionary's conjugation
 * and declension templates, returning results tagged per lexeme (including
 * {@link WordStems.support_warning} when stems are empty for coverage reasons).
 */
export async function stem(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<WordStems>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const w = extractStemsFromLexeme(lexeme);
        const { support_warning, ...rest } = w;
        return withExtractionSupport(rest as WordStems, support_warning);
    });
}

/** Alias of {@link stem} (same return type). */
export async function stemByLexeme(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<WordStems>> {
    return stem(query, sourceLang, pos);
}
