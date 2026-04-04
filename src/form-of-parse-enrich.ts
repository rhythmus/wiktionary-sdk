import { parse } from "node-html-parser";
import { mwFetchJson } from "./api";
import { isPerLangFormOfTemplate } from "./registry";
import type { Lexeme } from "./types";
import {
    expandDualPersonInflectionLine,
    formOfMorphLinesAreAbbrevTokensOnly,
    inflectionMorphDisplayLines,
} from "./formatter";
import { parallelMap } from "./utils";

/**
 * Per-language form-of templates (`{{xx-verb form of}}`, `{{xx-noun form of}}`, `{{xx-adj form of}}`
 * on en.wiktionary) often expand via Lua to a nested HTML list of inflection glosses — not present
 * as `##` wikitext. Same {@link isPerLangFormOfTemplate} predicate as the decoder registry.
 */
export function formOfTemplateUsesMwParseInflectionTree(template: string): boolean {
    return isPerLangFormOfTemplate(template);
}

export function lexemeNeedsFormOfParseEnrichment(lex: Lexeme): boolean {
    if (!lex.form_of?.template) return false;
    if (!formOfTemplateUsesMwParseInflectionTree(lex.form_of.template)) return false;
    if ((lex.form_of.display_morph_lines?.length ?? 0) > 0) return false;
    const subs =
        lex.senses?.[0]?.subsenses?.map((s) => String(s.gloss ?? "").trim()).filter(Boolean) ?? [];
    if (subs.length > 0) return false;
    if (formOfMorphLinesAreAbbrevTokensOnly(lex)) return false;
    return inflectionMorphDisplayLines(lex).length === 0;
}

/** Lines under nested <ol> from MW parser output (inflection-of module HTML). */
export function extractFormOfMorphLinesFromParsedHtml(html: string): string[] {
    const root = parse(html);
    const out: string[] = [];
    for (const li of root.querySelectorAll("ol ol > li")) {
        const text = li.text.replace(/\s+/g, " ").trim();
        if (text) out.push(text);
    }
    return out;
}

export async function mwParseWikitextFragment(pageTitle: string, wikitext: string): Promise<string | null> {
    try {
        const j = await mwFetchJson("https://en.wiktionary.org/w/api.php", {
            action: "parse",
            format: "json",
            formatversion: "2",
            origin: "*",
            prop: "text",
            contentmodel: "wikitext",
            title: pageTitle,
            text: wikitext,
        });
        const html = j?.parse?.text;
        return typeof html === "string" ? html : null;
    } catch {
        return null;
    }
}

export async function enrichLexemeFormOfMorphLinesFromParse(lex: Lexeme, pageTitle: string): Promise<void> {
    if (!lexemeNeedsFormOfParseEnrichment(lex)) return;
    const raw = lex.senses?.[0]?.gloss_raw?.trim();
    if (!raw) return;
    const html = await mwParseWikitextFragment(pageTitle, raw);
    if (!html) return;
    const lines = extractFormOfMorphLinesFromParsedHtml(html);
    if (lines.length === 0) return;
    const expanded = lines.flatMap((l) => expandDualPersonInflectionLine(l));
    lex.form_of = {
        ...lex.form_of!,
        display_morph_lines: expanded,
        display_morph_lines_source: "mediawiki_parse",
    };
}

export async function enrichFormOfMorphLinesFromParseBatch(
    lexemes: Lexeme[],
    pageTitle: string,
    concurrency?: number,
): Promise<void> {
    const targets = lexemes.filter(lexemeNeedsFormOfParseEnrichment);
    await parallelMap(targets, concurrency ?? Infinity, (l) =>
        enrichLexemeFormOfMorphLinesFromParse(l, pageTitle),
    );
}
