import { lemma, mapLexemes } from './library';
import type { GroupedLexemeResults } from './library';
import { wiktionary } from './index';
import type { WikiLang, Lexeme } from './types';

export interface VerbStems {
    present?: string[];
    dependent?: string[];
    imperfect?: string[];
    simple_past?: string[];
    passive_imperfect?: string[];
    passive_dependent?: string[];
    passive_simple_past?: string[];
}

export interface WordStems {
    verb?: VerbStems;
    nominals?: string[];
    aliases: string[];
}

function isGreekStem(str: string): boolean {
    if (!str || str.length === 0) return false;
    const greekRegex = /^[-α-ωΑ-Ωά-ώΆ-Ώϊϋΐΰ]+$/i;
    return greekRegex.test(str.trim());
}

function isParadigmTemplate(name: string): boolean {
    return name.startsWith("el-conjug-") ||
        name.startsWith("el-verb-") ||
        name.startsWith("el-noun-") ||
        name.startsWith("el-nM-") ||
        name.startsWith("el-nF-") ||
        name.startsWith("el-nN-") ||
        name.startsWith("el-adj-") ||
        name.startsWith("el-decl-");
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
        const isVerb = t.name.startsWith("el-conjug-") || t.name.startsWith("el-verb-");
        const params: any = t.params || {};
        const named: Record<string, string> = params.named || {};
        const positional: string[] = params.positional || [];

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
    return out;
}

/**
 * Extracts morphologically critical stem boundaries from Wiktionary's conjugation
 * and declension templates, returning results tagged per lexeme.
 */
export async function stemByLexeme(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<WordStems>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, extractStemsFromLexeme);
}

/**
 * Convenience wrapper:
 * returns per-lexeme stem aliases in grouped output form.
 */
export async function stem(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => extractStemsFromLexeme(lexeme).aliases);
}
