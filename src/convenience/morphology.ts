import { parse } from "node-html-parser";
import { mwFetchJson } from "../ingress/api";
import { wiktionary } from "../pipeline/wiktionary-core";
import type { Lexeme, WikiLang } from "../model";
import { mapLexemes, type GroupedLexemeResults } from "./grouped-results";
import { warnDecline, warnMorphologyTraits, withExtractionSupport } from "./extraction-support";
import { lemma } from "./lemma-translate";

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

function cleanCellText(text: string): string[] {
    const parts = text.split(/[,/]/).map(p => p.trim()).filter(Boolean);
    const results: string[] = [];
    
    for (let p of parts) {
        p = p.replace(/[\[\]]/g, '');
        
        const m = p.match(/^(.*?)\((.*?)\)(.*?)$/);
        if (m) {
            results.push((m[1] + m[3]).trim());
            results.push((m[1] + m[2] + m[3]).trim());
        } else {
            if (p !== "—" && p !== "…") {
                const cleaned = p.replace(/\s+[A-Za-z][A-Za-z.'-]*$/u, "").trim();
                results.push(cleaned || p);
            }
        }
    }
    return Array.from(new Set(results.filter(Boolean)));
}

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

function extractMorphologyFromLexeme(lexeme: Lexeme, query: string): Partial<GrammarTraits> {
    let criteria: Partial<GrammarTraits> = {};
    const qLower = query.toLowerCase();

    if (lexeme.form.toLowerCase() !== qLower) return {};

    if (lexeme.type === "INFLECTED_FORM" && lexeme.form_of?.tags) {
        const decoded = parseMorphologyTags(lexeme.form_of.tags);
        if (lexeme.form_of.lemma && lexeme.form_of.lemma.toLowerCase().endsWith("μαι")) criteria.voice = "passive";
        criteria = { ...criteria, ...decoded };
    } else if (lexeme.type === "LEXEME") {
        const pos = (
            lexeme.part_of_speech ||
            lexeme.lexicographic_section ||
            lexeme.part_of_speech_heading ||
            ""
        ).toLowerCase();
        const posNorm = pos.replace(/[_-]/g, " ").trim();
        const isGreek = String(lexeme.language) === "el" || String(lexeme.language) === "grc";
        if ((posNorm === "verb") && isGreek) {
            criteria.mood = "indicative";
            criteria.tense = "present";
            const form = lexeme.form.toLowerCase();
            criteria.voice = form.endsWith("μαι") || form.endsWith("ται") ? "passive" : "active";
            criteria.person = "1";
            criteria.number = "singular";
        } else if ((posNorm === "noun" || posNorm === "adjective" || posNorm.startsWith("adj")) && isGreek) {
            criteria.case = "nominative";
            criteria.number = "singular";
        }
    }

    return criteria;
}

/**
 * Extracts and decodes grammatical traits for each lexeme.
 */
export async function morphology(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<Partial<GrammarTraits>>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const traits = extractMorphologyFromLexeme(lexeme, query);
        return withExtractionSupport(traits, warnMorphologyTraits(lexeme, traits as Record<string, unknown>));
    });
}

function findConjugationTemplate(lexeme: Lexeme): { name: string; raw: string; params: any } | null {
    const templates = lexeme.templates_all || [];
    return templates.find((t: any) =>
        t.name.startsWith("el-conjug-") || t.name.startsWith("el-verb-") || t.name.startsWith("el-conj-")
    ) as any || null;
}

function findDeclensionTemplate(lexeme: Lexeme): { name: string; raw: string; params: any } | null {
    const templates = lexeme.templates_all || [];
    return templates.find((t: any) =>
        t.name.startsWith("el-noun-") || t.name.startsWith("el-adj-") ||
        t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-") ||
        t.name.startsWith("el-nN-") || t.name.startsWith("el-decl-") ||
        t.name.startsWith("el-proper-noun-")
    ) as any || null;
}

async function conjugateSingleLexeme(
    lexeme: Lexeme,
    query: string,
    criteria: Partial<ConjugateCriteria>,
    _sourceLang: WikiLang
): Promise<string[] | Record<string, any> | null> {
    const conjug = findConjugationTemplate(lexeme);
    if (!conjug) {
        if (lexeme.headword_morphology?.principal_parts) {
            return lexeme.headword_morphology.principal_parts;
        }
        return null;
    }

    const apiResult = await mwFetchJson("https://en.wiktionary.org/w/api.php", {
        action: "parse", format: "json", origin: "*", text: conjug.raw, prop: "text", contentmodel: "wikitext"
    });

    if (!apiResult.parse || !apiResult.parse.text) return null;
    const html = apiResult.parse.text["*"];
    
    if (Object.keys(criteria).length === 0) {
        return scrapeFullConjugationTable(html);
    }

    const inherent = extractMorphologyFromLexeme(lexeme, query);
    const person = criteria.person || inherent.person || "1";
    const number = criteria.number || inherent.number || "singular";
    const voice = criteria.voice || inherent.voice || "active";
    const tense = criteria.tense || inherent.tense || "present";
    const aspect = criteria.aspect || inherent.aspect || "imperfective";

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
        if (ht.match(new RegExp(`^${person}(?:st|nd|rd)?\\s*${number === "singular" ? "sg" : "pl"}`, "i"))) {
            const cells = row.querySelectorAll('td');
            let colIdx = isActive ? (isPerfective ? 2 : 1) : (isPerfective ? 4 : 3);
            if (cells.length < 5 && !isActive) colIdx = isPerfective ? 2 : 1;
            
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
 * Conjugates a verb based on criteria, returning results tagged per lexeme.
 */
export async function conjugate(query: string, criteria: Partial<ConjugateCriteria> = {}, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<string[] | Record<string, any> | null>> {
    const lStr = await lemma(query, sourceLang, "verb");
    const result = await wiktionary({ query: lStr, lang: sourceLang, pos: "verb" });

    const byId = new Map<string, string[] | Record<string, any> | null>();
    for (const lexeme of result.lexemes) {
        const value = await conjugateSingleLexeme(lexeme, query, criteria, sourceLang);
        byId.set(lexeme.id, value);
    }
    return mapLexemes(result, (lexeme) => byId.get(lexeme.id) ?? null);
}

async function declineSingleLexeme(
    lexeme: Lexeme,
    query: string,
    criteria: Partial<DeclineCriteria>,
    _sourceLang: WikiLang
): Promise<string[] | Record<string, any> | null> {
    const nominalTpl = findDeclensionTemplate(lexeme);
    if (!nominalTpl) {
        if (lexeme.headword_morphology?.principal_parts?.stem) {
            return { singular: { nominative: [lexeme.headword_morphology.principal_parts.stem] } };
        }
        return null;
    }

    const apiResult = await mwFetchJson("https://en.wiktionary.org/w/api.php", {
        action: "parse", format: "json", origin: "*", text: nominalTpl.raw, prop: "text", contentmodel: "wikitext"
    });

    if (!apiResult.parse || !apiResult.parse.text) return null;
    const html = apiResult.parse.text["*"];
    
    if (Object.keys(criteria).length === 0) {
        return scrapeFullDeclensionTable(html);
    }

    const inherent = extractMorphologyFromLexeme(lexeme, query);
    const targetCase = criteria.case || inherent.case || "nominative";
    const number = criteria.number || inherent.number || "singular";
    const gender = criteria.gender || inherent.gender || "masculine";

    const root = parse(html);
    const rows = root.querySelectorAll('tr');
    let foundTokens: string[] = [];

    for (const row of rows) {
        const rowHeader = row.querySelector('th');
        if (!rowHeader) continue;
        
        const ht = rowHeader.text.trim().toLowerCase();
        if (ht === targetCase) {
            const cells = row.querySelectorAll('td');
            let colIdx = 0;
            if (cells.length >= 6) {
                const plOffset = number === "plural" ? 3 : 0;
                const genOffset = gender === "feminine" ? 1 : (gender === "neuter" ? 2 : 0);
                colIdx = plOffset + genOffset;
            } else if (cells.length >= 2) {
                colIdx = number === "plural" ? 1 : 0;
            }
            
            const targetCell = cells[colIdx];
            if (targetCell) foundTokens = cleanCellText(targetCell.text);
            break;
        }
    }

    return Array.from(new Set(foundTokens));
}

/**
 * Declines a nominal based on criteria, returning results tagged per lexeme.
 */
export async function decline(query: string, criteria: Partial<DeclineCriteria> = {}, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<string[] | Record<string, any> | null>> {
    const lStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lStr, lang: sourceLang });

    const byId = new Map<string, string[] | Record<string, any> | null>();
    for (const lexeme of result.lexemes) {
        const value = await declineSingleLexeme(lexeme, query, criteria, sourceLang);
        byId.set(lexeme.id, value);
    }
    return mapLexemes(result, (lexeme) => {
        const value = byId.get(lexeme.id) ?? null;
        return withExtractionSupport(value, warnDecline(lexeme, value));
    });
}

function scrapeFullConjugationTable(html: string): Record<string, any> {
    const root = parse(html);
    const table: any = {
        active: { indicative: { present: {}, past: {} } },
        passive: { indicative: { present: {}, past: {} } }
    };

    const rows = root.querySelectorAll('tr');
    let group: string | null = null;

    for (const row of rows) {
        const text = row.text.replace(/\s+/g, ' ').trim();
        if (text.includes("Non-past tenses") || text.includes("Present")) group = "present";
        else if (text.includes("Past tenses") || text.includes("Imperfect")) group = "past";
        else if (text.includes("Future tenses") || text.includes("Imperative") || text.includes("Non-finite")) group = null;

        if (!group) continue;
        
        const rowHeader = row.querySelector('td:first-child') || row.querySelector('th');
        if (!rowHeader) continue;
        
        const ht = rowHeader.text.replace(/\s+/g, ' ').trim();
        const m = ht.match(/^(\d)(?:st|nd|rd)?\s*(sg|pl)/i);
        if (m) {
            const person = m[1];
            const num = m[2].toLowerCase();
            const key = `${person}${num}`;
            
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
                table.active.indicative[group][key] = cleanCellText(cells[1].text);
                table.passive.indicative[group][key] = cleanCellText(cells[3].text);
            } else if (cells.length >= 2) {
                table.active.indicative[group][key] = cleanCellText(cells[1].text);
            }
        }
    }
    return table;
}

function scrapeFullDeclensionTable(html: string): Record<string, any> {
    const root = parse(html);
    const table: Record<string, any> = { singular: {}, plural: {} };
    const rows = root.querySelectorAll('tr');

    for (const row of rows) {
        const th = row.querySelector('th');
        if (!th) continue;
        const caseName = th.text.trim().toLowerCase();
        if (["nominative", "genitive", "accusative", "vocative"].includes(caseName)) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                table.singular[caseName] = cleanCellText(cells[0].text);
                table.plural[caseName] = cleanCellText(cells[1].text);
            } else if (cells.length >= 1) {
                table.singular[caseName] = cleanCellText(cells[0].text);
            }
        }
    }
    return table;
}
