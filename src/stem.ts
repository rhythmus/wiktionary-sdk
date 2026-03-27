import { lemma } from './library';
import { wiktionary } from './index';
import { parseTemplates } from './parser';
import type { WikiLang } from './types';

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
    aliases: string[]; // Flat, unique array of all extracted stem strings
}

/**
 * Validates if a string chunk primarily represents a Greek alphabetical base.
 * Prevents numerical meta-flags like `1` or `note=...` from slipping into nominal stems.
 */
function isGreekStem(str: string): boolean {
    if (!str || str.length === 0) return false;
    // Allow Greek characters, accents, and hyphens (sometimes used for prefixes)
    const greekRegex = /^[-α-ωΑ-Ωά-ώΆ-Ώϊϋΐΰ]+$/i;
    return greekRegex.test(str.trim());
}

/**
 * Extracts morphologically critical stem boundaries natively codified inside Wiktionary's conjugation 
 * and declension definition templates. Adheres to "Extraction, Not Inference" by strictly pulling
 * parameters rather than computing linguistic suffixes heuristic algorithms.
 */
export async function stem(query: string, sourceLang: WikiLang = "el"): Promise<WordStems> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    
    if (!result.rawLanguageBlock) return { aliases: [] };
    
    const templates = parseTemplates(result.rawLanguageBlock);
    
    // We target nominal, verb, and adjectival layout templates dynamically generating paradigms
    const paradigmTemplates = templates.filter(t => 
        t.name.startsWith("el-conjug-") || 
        t.name.startsWith("el-verb-") ||
        t.name.startsWith("el-noun-") || 
        t.name.startsWith("el-nM-") || 
        t.name.startsWith("el-nF-") || 
        t.name.startsWith("el-nN-") || 
        t.name.startsWith("el-adj-") ||
        t.name.startsWith("el-decl-")
    );

    const out: WordStems = { aliases: [] };
    const aliasesSet = new Set<string>();

    for (const t of paradigmTemplates) {
        const isVerb = t.name.startsWith("el-conjug-") || t.name.startsWith("el-verb-");
        
        if (isVerb) {
            out.verb = out.verb || {};
            const named = t.params.named || {};
            
            const extractToVerbAlias = (key: string, targetProp: keyof VerbStems) => {
                const val = named[key];
                if (val && isGreekStem(val)) {
                    if (!out.verb![targetProp]) out.verb![targetProp] = [];
                    out.verb![targetProp]!.push(val.trim());
                    aliasesSet.add(val.trim());
                }
            };
            
            // Map explicit known properties
            extractToVerbAlias("present", "present");
            extractToVerbAlias("a-imperfect", "imperfect");
            extractToVerbAlias("a-dependent", "dependent");
            extractToVerbAlias("a-simplepast", "simple_past");
            
            extractToVerbAlias("p-imperfect", "passive_imperfect");
            extractToVerbAlias("p-dependent", "passive_dependent");
            extractToVerbAlias("p-dependent-2", "passive_dependent"); // Alternative forms
            extractToVerbAlias("p-simplepast", "passive_simple_past");
            extractToVerbAlias("p-simplepast-2", "passive_simple_past");

        } else {
            // Processing Nominal / Adjectival stems
            out.nominals = out.nominals || [];
            
            // Most Greek nominals store their stem in positional templates: {{el-nM-ος-οι-1|στάδι|σταδί}}
            const posStems = (t.params.positional || [])
                .filter(s => isGreekStem(s))
                .map(s => s.trim());
                
            // Sometimes it's passed as a named arg like `stem=καλ`
            const namedStem = t.params.named?.stem;
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
