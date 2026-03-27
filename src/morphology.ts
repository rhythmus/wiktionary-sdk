import { parse } from 'node-html-parser';
import { lemma } from './library';
import { wiktionary } from './index';
import { mwFetchJson } from './api';
import { parseTemplates } from './parser';
import type { WikiLang } from './types';

export interface ConjugateCriteria {
    person?: "1" | "2" | "3";
    number?: "singular" | "plural";
    voice?: "active" | "passive";
    mood?: "indicative" | "subjunctive" | "imperative";
    tense?: "present" | "past" | "future" | "perfect" | "pluperfect" | "future perfect";
    aspect?: "imperfective" | "perfective";
}

export interface DeclineCriteria {
    case?: "nominative" | "genitive" | "accusative" | "vocative";
    number?: "singular" | "plural";
    gender?: "masculine" | "feminine" | "neuter";
}

export interface GrammarTraits extends ConjugateCriteria, DeclineCriteria {}

/**
 * Cleans extracted text from Wiktionary HTML, resolving parenthetical variants
 * e.g., "γράφουν(ε)" -> ["γράφουν", "γράφουνε"]
 */
function cleanCellText(text: string): string[] {
    const parts = text.split(/[,/]/).map(p => p.trim()).filter(Boolean);
    const results: string[] = [];
    
    for (let p of parts) {
        p = p.replace(/[\[\]]/g, ''); // ignore silent brackets
        
        const m = p.match(/^(.*?)\((.*?)\)(.*?)$/);
        if (m) {
            results.push((m[1] + m[3]).trim());
            results.push((m[1] + m[2] + m[3]).trim());
        } else {
            if (p !== "—" && p !== "…") {
                results.push(p);
            }
        }
    }
    return results;
}

/**
 * Maps Wiktionary shorthand morphological tags to GrammarTraits dimensions
 */
export function parseMorphologyTags(tags: string[]): Partial<GrammarTraits> {
    const result: Partial<GrammarTraits> = {};
    for (const tag of tags) {
        if (tag === "1s" || tag === "1sg") { result.person = "1"; result.number = "singular"; }
        else if (tag === "2s" || tag === "2sg") { result.person = "2"; result.number = "singular"; }
        else if (tag === "3s" || tag === "3sg") { result.person = "3"; result.number = "singular"; }
        else if (tag === "1p" || tag === "1pl") { result.person = "1"; result.number = "plural"; }
        else if (tag === "2p" || tag === "2pl") { result.person = "2"; result.number = "plural"; }
        else if (tag === "3p" || tag === "3pl") { result.person = "3"; result.number = "plural"; }
        else if (tag === "1") result.person = "1";
        else if (tag === "2") result.person = "2";
        else if (tag === "3") result.person = "3";
        else if (tag === "s" || tag === "sg") result.number = "singular";
        else if (tag === "p" || tag === "pl") result.number = "plural";
        
        else if (tag === "pres") { result.tense = "present"; result.aspect = "imperfective"; }
        else if (tag === "impf" || tag === "ipf") { result.tense = "past"; result.aspect = "imperfective"; }
        else if (tag === "spast" || tag === "aor") { result.tense = "past"; result.aspect = "perfective"; }
        else if (tag === "fut") { result.tense = "future"; }
        else if (tag === "perf") result.tense = "perfect";
        else if (tag === "plup") result.tense = "pluperfect";
        
        else if (tag === "ind" || tag === "indc") result.mood = "indicative";
        else if (tag === "sub" || tag === "subj") result.mood = "subjunctive";
        else if (tag === "imp" || tag === "impr") result.mood = "imperative";
        
        else if (tag === "act" || tag === "actv") result.voice = "active";
        else if (tag === "pass" || tag === "psv" || tag === "mid" || tag === "m-p" || tag === "mpsv") result.voice = "passive";
        
        else if (tag === "nom") result.case = "nominative";
        else if (tag === "gen") result.case = "genitive";
        else if (tag === "acc") result.case = "accusative";
        else if (tag === "voc") result.case = "vocative";
        
        else if (tag === "m") result.gender = "masculine";
        else if (tag === "f") result.gender = "feminine";
        else if (tag === "n") result.gender = "neuter";
    }
    return result;
}

/**
 * Extracts and decodes grammatical traits intrinsically assigned to a query string by Wiktionary.
 */
export async function morphology(query: string, sourceLang: WikiLang = "el"): Promise<Partial<GrammarTraits>> {
    const result = await wiktionary({ query, lang: sourceLang });
    if (!result.entries || result.entries.length === 0) return {};

    let criteria: Partial<GrammarTraits> = {};
    const exact = result.entries.find(e => e.form === query);
    
    if (exact?.type === "INFLECTED_FORM" && exact.form_of?.tags) {
        const decoded = parseMorphologyTags(exact.form_of.tags);
        if (exact.form_of.lemma && exact.form_of.lemma.endsWith("μαι")) criteria.voice = "passive";
        criteria = { ...criteria, ...decoded };
    } else if (exact?.type === "LEXEME") {
        if (query.endsWith("μαι")) criteria.voice = "passive";
    }

    return criteria;
}

/**
 * High-level function resolving conjugated Verb forms via DOM scraping on the MediaWiki API.
 */
export async function conjugate(query: string, criteria: Partial<ConjugateCriteria> = {}, sourceLang: WikiLang = "el"): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    if (!result.rawLanguageBlock) return [];

    const inherentGrammar = await morphology(query, sourceLang);
    
    const person = criteria.person || inherentGrammar.person || "1";
    const number = criteria.number || inherentGrammar.number || "singular";
    const voice = criteria.voice || inherentGrammar.voice || "active";
    // Default missing properties based on inferred grammar and standard lookup fallbacks
    const tense = criteria.tense || inherentGrammar.tense || "present";
    const aspect = criteria.aspect || inherentGrammar.aspect || "imperfective";

    const templates = parseTemplates(result.rawLanguageBlock);
    const conjug = templates.find(t => t.name.startsWith("el-conjug-") || t.name.startsWith("el-verb-"));
    if (!conjug) return [];

    const apiResult = await mwFetchJson("https://en.wiktionary.org/w/api.php", {
        action: "parse", format: "json", origin: "*", text: conjug.raw, prop: "text", contentmodel: "wikitext"
    });

    if (!apiResult.parse || !apiResult.parse.text) return [];
    const html = apiResult.parse.text["*"];
    const root = parse(html);

    const isPast = (tense === "past" || tense === "pluperfect");
    const isPerfective = (aspect === "perfective");
    const isActive = (voice === "active");

    const mappedTenseTitle = isPast ? "Past tenses" : "Non-past tenses";
    const rows = root.querySelectorAll('tr');
    
    let insideTargetGroup = false;
    let foundTokens: string[] = [];

    for (const row of rows) {
        const text = row.text.replace(/\s+/g, ' ').trim();
        if (text.includes("Non-past tenses")) { insideTargetGroup = mappedTenseTitle === "Non-past tenses"; }
        else if (text.includes("Past tenses")) { insideTargetGroup = mappedTenseTitle === "Past tenses"; }
        else if (text.includes("Future tenses") || text.includes("Perfect aspect")) { insideTargetGroup = false; }
        
        if (!insideTargetGroup) continue;

        const rowHeader = row.querySelector('td:first-child') || row.querySelector('th');
        if (!rowHeader) continue;
        
        const ht = rowHeader.text.replace(/\s+/g, ' ').trim();
        if (ht.startsWith(person) && ht.includes(number === "singular" ? "sg" : "pl")) {
            const cells = row.querySelectorAll('td');
            // Check mapping relative to structure: Action (Active Impr, Perf... Passive Impr, Perf...)
            let colIdx = isActive ? (isPerfective ? 2 : 1) : (isPerfective ? 4 : 3);
            if (cells.length < 5 && !isActive) colIdx = isPerfective ? 2 : 1; // Pure passive tables shift columns
            
            const targetCell = cells[colIdx];
            if (targetCell) foundTokens = cleanCellText(targetCell.text);
            break;
        }
    }

    if (foundTokens.length === 0) return [];
    if (tense === "future") return foundTokens.map(t => "θα " + t);
    if (tense === "perfect" || tense === "pluperfect" || tense === "future perfect") {
        return foundTokens.map(t => (tense === "perfect" ? "έχω " : "είχα ") + t); 
    }
    return Array.from(new Set(foundTokens));
}

/**
 * High-level function resolving Nominal (Noun/Adjective) forms via DOM scraping on the MediaWiki API.
 */
export async function decline(query: string, criteria: Partial<DeclineCriteria> = {}, sourceLang: WikiLang = "el"): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    if (!result.rawLanguageBlock) return [];

    const inherentGrammar = await morphology(query, sourceLang);
    
    const targetCase = criteria.case || inherentGrammar.case || "nominative";
    const number = criteria.number || inherentGrammar.number || "singular";
    const gender = criteria.gender || inherentGrammar.gender || "masculine"; // Defaults 

    const templates = parseTemplates(result.rawLanguageBlock);
    const nominalTpl = templates.find(t => 
        t.name.startsWith("el-noun-") || t.name.startsWith("el-adj-") || 
        t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-") || 
        t.name.startsWith("el-nN-") || t.name.startsWith("el-decl-")
    );
    if (!nominalTpl) return [];

    const apiResult = await mwFetchJson("https://en.wiktionary.org/w/api.php", {
        action: "parse", format: "json", origin: "*", text: nominalTpl.raw, prop: "text", contentmodel: "wikitext"
    });

    if (!apiResult.parse || !apiResult.parse.text) return [];
    const html = apiResult.parse.text["*"];
    const root = parse(html);

    const rows = root.querySelectorAll('tr');
    let foundTokens: string[] = [];

    for (const row of rows) {
        const rowHeader = row.querySelector('th');
        if (!rowHeader) continue;
        
        const ht = rowHeader.text.trim().toLowerCase();
        if (ht === targetCase) {
            const cells = row.querySelectorAll('td');
            let colIdx = 0; // Default: singular explicit column 1
            
            if (cells.length >= 6) {
                // Adjective Table
                const plOffset = number === "plural" ? 3 : 0;
                const genOffset = gender === "feminine" ? 1 : (gender === "neuter" ? 2 : 0);
                colIdx = plOffset + genOffset;
            } else if (cells.length >= 2) {
                // Noun Table
                colIdx = number === "plural" ? 1 : 0;
            } else {
                // Singular-only or plural-only noun fallback
                colIdx = 0;
            }
            
            const targetCell = cells[colIdx];
            if (targetCell) foundTokens = cleanCellText(targetCell.text);
            break;
        }
    }

    return Array.from(new Set(foundTokens));
}
