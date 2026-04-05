import { mwFetchJson } from "../ingress/api";
import { stripWikiMarkup } from "../decode/registry";
import { wiktionary } from "../pipeline/wiktionary-core";
import type { FetchResult, Lexeme, WikiLang } from "../model";
import { groupRows, mapLexemes, type GroupedLexemeResults } from "./grouped-results";
import { warnSensesList, warnTranslateGloss, withExtractionSupport } from "./extraction-support";

/**
 * Helper to find the primary lexeme of a word result.
 * Kept as a public utility for callers who explicitly want single-lexeme shortcutting.
 */
export function getMainLexeme(result: FetchResult): Lexeme | null {
    if (!result.lexemes || result.lexemes.length === 0) return null;

    const posLexeme = result.lexemes.find((e) => e.part_of_speech !== undefined && e.part_of_speech !== null);
    if (posLexeme) return posLexeme;

    const metaHeadings = ["pronunciation", "etymology", "references", "anagrams"];
    const mainLexeme = result.lexemes.find(
        (e) =>
            e.type === "LEXEME" && !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase()),
    );
    if (mainLexeme) return mainLexeme;

    return result.lexemes.find((e) => e.type === "LEXEME") || result.lexemes[0] || null;
}

/**
 * Returns the canonical dictionary form (lemma) of an inflected word.
 * Stays scalar — this is a form-resolution utility, not a data-extraction wrapper.
 */
export async function lemma(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<string> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    const normalizeTerm = (v: string) => v.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
    const queryNorm = normalizeTerm(query);

    const metaHeadings = ["pronunciation", "etymology", "references", "anagrams", "alternative forms"];
    const highPriorityLexeme = result.lexemes.find(
        (e) =>
            e.type === "LEXEME" &&
            e.form === query &&
            (e.language === "el" || e.language === "grc" || e.language === "en") &&
            !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase()),
    );
    if (highPriorityLexeme) return query;

    const anyLexeme = result.lexemes.find(
        (e) =>
            e.type === "LEXEME" &&
            e.form === query &&
            !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase()),
    );
    if (anyLexeme) return query;

    const diacriticInsensitiveLexeme = result.lexemes.find(
        (e) =>
            e.type === "LEXEME" &&
            normalizeTerm(e.form) === queryNorm &&
            !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase()),
    );
    if (diacriticInsensitiveLexeme) return query;

    const inflected = result.lexemes.find((e) => e.type === "INFLECTED_FORM" && e.form === query);
    if (inflected && inflected.form_of?.lemma) return inflected.form_of.lemma;

    return query;
}

export interface TranslationOptions {
    /**
     * "gloss" -> Returns mapped equivalents from en.wiktionary's Translations table (default).
     * "senses" -> Returns full prose definitions by hitting the target's native Wiktionary domain.
     */
    mode?: "gloss" | "senses";
}

/**
 * Retrieves translations for a term in a specific target language.
 */
export async function translate(
    query: string,
    sourceLang: WikiLang = "Auto",
    targetLang: string = "en",
    options: TranslationOptions = { mode: "gloss" },
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);

    if (options.mode === "senses") {
        if (targetLang === "en") {
            const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
            return mapLexemes(result, (lexeme) => {
                const glosses = (lexeme.senses?.map((s: any) => s.gloss).filter((g: any) => g && String(g).trim()) ||
                    []) as string[];
                return withExtractionSupport(glosses, warnSensesList(lexeme, glosses, "Senses"));
            });
        } else {
            const senses = await getNativeSenses(lemmaStr, sourceLang, targetLang);
            return groupRows([
                {
                    lexeme_id: "native-senses",
                    language: sourceLang,
                    pos: "unknown",
                    etymology_index: 0,
                    value: senses,
                    ...(senses.length === 0
                        ? {
                              support_warning:
                                  "Native senses scrape returned no definition lines for the target wiki (missing language section, redirects, or unsupported layout).",
                          }
                        : {}),
                },
            ]);
        }
    }

    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const targetTranslations = lexeme.translations?.[targetLang] || [];
        const terms = targetTranslations.map((tr: any) => tr.term);
        return withExtractionSupport(terms, warnTranslateGloss(lexeme, targetLang, terms));
    });
}

async function getNativeSenses(query: string, sourceLang: WikiLang, targetLang: string): Promise<string[]> {
    try {
        const origin = `https://${targetLang}.wiktionary.org/w/api.php`;
        const j = await mwFetchJson(origin, {
            action: "query",
            format: "json",
            formatversion: "2",
            origin: "*",
            prop: "revisions",
            rvprop: "content",
            rvslots: "main",
            redirects: "1",
            titles: query,
        });
        const page = j?.query?.pages?.[0];
        if (page?.missing) return [];
        const wikitext = page?.revisions?.[0]?.slots?.main?.content ?? "";
        if (!wikitext) return [];
        let inSection = false;
        const out: string[] = [];
        const langHeaders: Record<string, string[]> = {
            fr: ["== {{langue|el}} ==", "== Grec ==", "== Grec ancien =="],
            nl: ["{{=ell=}}", "{{=grc=}}"],
            de: ["== Griechisch ==", "== Altgriechisch =="],
            es: ["== {{inflect.es|el}} ==", "== Griego =="],
            it: ["== {{-el-}} ==", "== Greco =="],
        };
        const headers = langHeaders[targetLang] || [`== ${sourceLang} ==`];
        const lines = wikitext.split("\n");
        for (const line of lines) {
            if (headers.some((h: string) => line.trim().startsWith(h))) {
                inSection = true;
                continue;
            }
            if (inSection && /^(==|{{=).+/.test(line.trim()) && !/^===/.test(line.trim())) break;
            if (inSection && line.trim().startsWith("#") && !line.trim().startsWith("#:")) {
                const raw = line.replace(/^#+\s*/, "").trim();
                const stripped = stripWikiMarkup(raw);
                if (stripped) {
                    let s = stripped.trim().replace(/[.\s]+$/, "");
                    if (targetLang !== "de" && s.length > 0) s = s.charAt(0).toLowerCase() + s.slice(1);
                    out.push(s);
                }
            }
        }
        return out;
    } catch (e) {
        console.error(
            `[lightweight-scraper] Failed to fetch native senses for ${query} on ${targetLang}.wiktionary:`,
            e,
        );
        return [];
    }
}
