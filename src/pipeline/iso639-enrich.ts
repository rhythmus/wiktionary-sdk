import { parse as parseHtml } from "node-html-parser";
import type { Lexeme } from "../model";
import { mwParseWikitextFragment } from "./form-of-parse-enrich";
import { fetchWikidataEntityByWikipediaTitle } from "../ingress/api";

const ISO_639_RE = /\{\{ISO\s+639\|([^}]*)\}\}/i;

/** True when a lexeme is a Translingual entry whose sole sense is an {{ISO 639|…}} template. */
export function lexemeNeedsIso639Enrichment(lex: Lexeme): boolean {
    if (lex.language !== "Translingual") return false;
    const sense = lex.senses?.[0];
    if (!sense) return false;
    const raw = sense.gloss_raw ?? sense.gloss ?? "";
    return ISO_639_RE.test(raw);
}

/**
 * Extract the plain-text language-code description from the parsed HTML of {{ISO 639|N}}.
 * Returns e.g. "ISO 639-3 language code for Godié".
 */
function extractIso639TextFromHtml(html: string): { text: string; langName: string | null } {
    const root = parseHtml(html);
    const p = root.querySelector("p");
    const rawText = (p?.text ?? root.text).replace(/\s+/g, " ").trim();
    const cleaned = rawText
        .replace(/^\(\s*international standards?\s*\)\s*/i, "")
        .replace(/\.\s*$/, "")
        .trim();

    const forMatch = cleaned.match(/\bfor\s+(.+)$/i);
    const langName = forMatch ? forMatch[1].trim() : null;
    return { text: cleaned, langName };
}

/**
 * Enrich a Translingual ISO 639 lexeme:
 * 1. Expand the definition template via action=parse to get the full gloss with language name
 * 2. Look up the correct Wikidata QID for the language via its Wikipedia article
 */
export async function enrichIso639Lexeme(lex: Lexeme, pageTitle: string): Promise<void> {
    const sense = lex.senses?.[0];
    if (!sense) return;
    const raw = sense.gloss_raw ?? sense.gloss ?? "";
    const m = raw.match(ISO_639_RE);
    if (!m) return;

    const html = await mwParseWikitextFragment(pageTitle, `{{ISO 639|${m[1]}}}`);
    if (!html) return;

    const { text, langName } = extractIso639TextFromHtml(html);
    if (text) {
        sense.gloss = text;
    }

    if (langName) {
        try {
            const entity = await fetchWikidataEntityByWikipediaTitle(`${langName} language`);
            if (entity?.id) {
                lex.wikidata = {
                    qid: entity.id,
                    labels: entity.labels || {},
                    descriptions: entity.descriptions || {},
                    sitelinks: {},
                    instance_of: [],
                    subclass_of: [],
                };
            }
        } catch {
            // best-effort: language Wikidata lookup is non-critical
        }
    }
}

export async function enrichIso639LexemesBatch(lexemes: Lexeme[], pageTitle: string): Promise<void> {
    for (const lex of lexemes) {
        if (lexemeNeedsIso639Enrichment(lex)) {
            await enrichIso639Lexeme(lex, pageTitle);
        }
    }
}
