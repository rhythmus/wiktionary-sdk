/**
 * Language-aware typographic ("smart") quote replacement.
 *
 * Converts ASCII straight quotes (" and ') into the correct curly/angular
 * quotation marks for the given language, following the conventions documented
 * at https://en.wikipedia.org/wiki/Quotation_mark#Summary_table
 */

interface QuoteStyle {
    openDouble: string;
    closeDouble: string;
    openSingle: string;
    closeSingle: string;
}

const ENGLISH: QuoteStyle = {
    openDouble: "\u201C",   // "
    closeDouble: "\u201D",  // "
    openSingle: "\u2018",   // '
    closeSingle: "\u2019",  // '
};

const QUOTE_STYLES: Record<string, QuoteStyle> = {
    en: ENGLISH,
    af: ENGLISH,

    el: {
        openDouble: "\u00AB",   // «
        closeDouble: "\u00BB",  // »
        openSingle: "\u201C",   // "
        closeSingle: "\u201D",  // "
    },
    grc: {
        openDouble: "\u00AB",
        closeDouble: "\u00BB",
        openSingle: "\u201C",
        closeSingle: "\u201D",
    },

    de: {
        openDouble: "\u201E",   // „
        closeDouble: "\u201C",  // "
        openSingle: "\u201A",   // ‚
        closeSingle: "\u2018",  // '
    },

    nl: ENGLISH,

    fr: {
        openDouble: "\u00AB\u202F",  // « + narrow no-break space
        closeDouble: "\u202F\u00BB", // narrow no-break space + »
        openSingle: "\u2039\u202F",  // ‹ + narrow no-break space
        closeSingle: "\u202F\u203A", // narrow no-break space + ›
    },

    es: {
        openDouble: "\u00AB",
        closeDouble: "\u00BB",
        openSingle: "\u201C",
        closeSingle: "\u201D",
    },

    it: {
        openDouble: "\u00AB",
        closeDouble: "\u00BB",
        openSingle: "\u201C",
        closeSingle: "\u201D",
    },

    pt: {
        openDouble: "\u00AB",
        closeDouble: "\u00BB",
        openSingle: "\u201C",
        closeSingle: "\u201D",
    },

    ru: {
        openDouble: "\u00AB",
        closeDouble: "\u00BB",
        openSingle: "\u201E",
        closeSingle: "\u201C",
    },

    da: {
        openDouble: "\u00BB",   // »
        closeDouble: "\u00AB",  // «
        openSingle: "\u203A",   // ›
        closeSingle: "\u2039",  // ‹
    },

    la: ENGLISH,

    ja: {
        openDouble: "\u300C",   // 「
        closeDouble: "\u300D",  // 」
        openSingle: "\u300E",   // 『
        closeSingle: "\u300F",  // 』
    },

    ar: {
        openDouble: "\u00AB",
        closeDouble: "\u00BB",
        openSingle: "\u201C",
        closeSingle: "\u201D",
    },
};

function styleForLang(lang: string | undefined): QuoteStyle {
    if (!lang) return ENGLISH;
    const code = lang.toLowerCase().trim();
    return QUOTE_STYLES[code] ?? ENGLISH;
}

function isWordChar(ch: string | undefined): boolean {
    if (!ch) return false;
    return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * True when the preceding character suggests the quote should close
 * (word chars, punctuation that sits before closing quotes, closing brackets).
 */
function isClosingContext(ch: string | undefined): boolean {
    if (!ch) return false;
    return /[\p{L}\p{N}\p{P}\p{S})\]\u2019\u201D\u00BB\u203A\u300D\u300F]/u.test(ch);
}

/**
 * True when the preceding character suggests the quote should open
 * (start of string, whitespace, opening brackets, dashes).
 */
function isOpeningContext(ch: string | undefined): boolean {
    if (!ch) return true;
    return /[\s(\[\u2014\u2013\u2012]/u.test(ch);
}

/**
 * Replace ASCII straight double and single quotes with typographic equivalents.
 *
 * The algorithm uses the SmartyPants heuristic: a quote preceded by whitespace
 * or at start of string is opening; preceded by word chars or punctuation is
 * closing. Single quotes between two word characters are apostrophes (which
 * correctly render as the right single quotation mark).
 */
export function smartQuotes(text: string, lang?: string): string {
    if (!text) return text;
    const style = styleForLang(lang);
    const chars = [...text];
    const out: string[] = [];

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const prev = i > 0 ? chars[i - 1] : undefined;
        const next = i < chars.length - 1 ? chars[i + 1] : undefined;

        if (ch === '"') {
            if (isOpeningContext(prev)) {
                out.push(style.openDouble);
            } else {
                out.push(style.closeDouble);
            }
            continue;
        }

        if (ch === "'") {
            if (isWordChar(prev) && isWordChar(next)) {
                out.push(style.closeSingle);
            } else if (isOpeningContext(prev)) {
                out.push(style.openSingle);
            } else {
                out.push(style.closeSingle);
            }
            continue;
        }

        out.push(ch);
    }

    return out.join("");
}
