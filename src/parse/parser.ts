import type { PartOfSpeech, TemplateCall, WikiLang } from "../types";
import { isLexemeSectionHeading, mapHeadingToStrictPartOfSpeech } from "./lexicographic-headings";

/** -------------------- Wikitext Sectioning -------------------- **/

export function extractLanguageSection(wikitext: string, languageName: string) {
    // Language sections are level-2 headers: ==Greek==, ==Ancient Greek==, etc.
    const re = new RegExp(`^==\\s*${escapeRegExp(languageName)}\\s*==\\s*$`, "m");
    const m = re.exec(wikitext);
    if (!m) return null;
    const start = m.index + m[0].length;
    const after = wikitext.slice(start);
    const next = after.search(/^==[^=].*==\s*$/m);
    const block = next === -1 ? after : after.slice(0, next);
    return `==${languageName}==` + block;
}

export function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitEtymologiesAndPOS(langBlock: string) {
    // PoS headings create posBlocks; other H3–H5 headings become content
    // lines within the nearest PoS. Heading marker lines are preserved in
    // posBlock wikitext so section-based decoders can still locate them.
    const lines = langBlock.split("\n");
    const etyms: any[] = [];
    let currentEtym: any = { idx: 0, title: "Etymology", posBlocks: [], preamble: [] };
    let currentPOS: any = null;
    let pendingNonPosLines: string[] = [];

    function flushPOS() {
        if (currentPOS) {
            currentEtym.posBlocks.push(currentPOS);
            currentPOS = null;
        }
    }
    function flushEtym() {
        flushPOS();
        if (currentEtym.posBlocks.length > 0) etyms.push(currentEtym);
        pendingNonPosLines = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const m = line.match(/^(=+)\s*(.+?)\s*\1$/);
        if (m) {
            const level = m[1].length;
            const heading = m[2].trim();

            if (level === 3 && heading.startsWith("Etymology")) {
                flushEtym();
                const etymMatch = heading.match(/Etymology\s+(\d+)/);
                const n = etymMatch ? parseInt(etymMatch[1], 10) : etyms.length + 1;
                currentEtym = {
                    idx: n,
                    title: heading,
                    posBlocks: [],
                    preamble: [],
                };
                continue;
            }

            if (level >= 3 && level <= 5) {
                if (isLexemeSectionHeading(heading)) {
                    flushPOS();
                    if (pendingNonPosLines.length > 0) {
                        currentPOS = { posHeading: heading, lines: [...pendingNonPosLines] };
                        pendingNonPosLines = [];
                    } else {
                        currentPOS = { posHeading: heading, lines: [] };
                    }
                } else {
                    if (currentPOS) {
                        currentPOS.lines.push(line);
                    } else {
                        pendingNonPosLines.push(line);
                    }
                }
                continue;
            }
        }

        if (currentPOS) {
            currentPOS.lines.push(line);
        } else if (pendingNonPosLines.length > 0) {
            pendingNonPosLines.push(line);
        } else {
            currentEtym.preamble.push(line);
        }
    }
    flushEtym();

    if (etyms.length === 0) {
        return [
            {
                idx: 0,
                title: "Etymology",
                posBlocks: [{ posHeading: "(unknown)", wikitext: lines.join("\n") }],
            },
        ];
    }

    for (const e of etyms) {
        const preambleText = e.preamble.join("\n");
        e.etymology_raw_text = preambleText;
        for (const pb of e.posBlocks) {
            pb.wikitext = (preambleText ? preambleText + "\n" : "") + pb.lines.join("\n");
            delete pb.lines;
        }
        delete e.preamble;
    }
    return etyms;
}

/** -------------------- Template Parsing -------------------- **/

export interface TemplateCallWithLocation extends TemplateCall {
    start?: number;
    end?: number;
    line?: number;
}

export function parseTemplates(wikitext: string, withLocation = false): TemplateCall[] | TemplateCallWithLocation[] {
    const out: (TemplateCall | TemplateCallWithLocation)[] = [];
    let i = 0;
    while (i < wikitext.length) {
        const start = wikitext.indexOf("{{", i);
        if (start === -1) break;
        let depth = 0;
        let j = start;
        for (; j < wikitext.length; j++) {
            if (wikitext.startsWith("{{", j)) {
                depth++;
                j++;
                continue;
            }
            if (wikitext.startsWith("}}", j)) {
                depth--;
                j++;
                if (depth === 0) {
                    j++;
                    break;
                }
                continue;
            }
        }
        if (depth !== 0) {
            i = start + 2;
            continue;
        }
        const raw = wikitext.slice(start, j);
        const inner = raw.slice(2, -2);
        const tpl = parseTemplateInner(inner);
        if (tpl) {
            const base = { ...tpl, raw };
            if (withLocation) {
                const line = wikitext.slice(0, start).split("\n").length;
                (out as TemplateCallWithLocation[]).push({ ...base, start, end: j, line });
            } else {
                out.push(base);
            }
        }
        i = j;
    }
    return out as TemplateCall[] | TemplateCallWithLocation[];
}

/**
 * Splits on | only when both depthLink and depthTpl are 0.
 * Preserves pipes inside [[...]] and {{...}}.
 */
export function splitPipesPreservingLinks(s: string) {
    const parts: string[] = [];
    let cur = "";
    let depthLink = 0;
    let depthTpl = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const next2 = s.slice(i, i + 2);
        if (next2 === "[[") {
            depthLink++;
            cur += next2;
            i++;
            continue;
        }
        if (next2 === "]]" && depthLink > 0) {
            depthLink--;
            cur += next2;
            i++;
            continue;
        }
        if (next2 === "{{") {
            depthTpl++;
            cur += next2;
            i++;
            continue;
        }
        if (next2 === "}}" && depthTpl > 0) {
            depthTpl--;
            cur += next2;
            i++;
            continue;
        }
        if (ch === "|" && depthLink === 0 && depthTpl === 0) {
            parts.push(cur);
            cur = "";
            continue;
        }
        cur += ch;
    }
    parts.push(cur);
    return parts;
}

export function parseTemplateInner(inner: string) {
    const parts = splitPipesPreservingLinks(inner);
    const name = (parts[0] ?? "").trim();
    if (!name) return null;
    const positional: string[] = [];
    const named: Record<string, string> = {};
    for (let k = 1; k < parts.length; k++) {
        const p = parts[k];
        const eq = p.indexOf("=");
        if (eq !== -1) {
            const key = p.slice(0, eq).trim();
            const val = p.slice(eq + 1).trim();
            if (key) named[key] = val;
            else positional.push(p.trim());
        } else {
            positional.push(p.trim());
        }
    }
    return { name, params: { positional, named } };
}

/** Strict grammatical PoS only; see {@link mapHeadingToLexicographic} for full taxonomy. */
export function mapHeadingToPos(heading: string): PartOfSpeech | null {
    return mapHeadingToStrictPartOfSpeech(heading);
}

export function langToLanguageName(lang: WikiLang): string | null {
    if (lang === "el") return "Greek";
    if (lang === "grc") return "Ancient Greek";
    if (lang === "en") return "English";
    if (lang === "nl") return "Dutch";
    if (lang === "de") return "German";
    if (lang === "fr") return "French";
    if (lang === "af") return "Afrikaans";
    if (lang === "da") return "Danish";
    if (lang === "es") return "Spanish";
    if (lang === "la") return "Latin";
    if (lang === "ja") return "Japanese";
    if (lang === "ar") return "Arabic";
    if (lang === "ru") return "Russian";
    if (lang === "it") return "Italian";
    if (lang === "pt") return "Portuguese";
    return null;
}

export function languageNameToLang(name: string): WikiLang | null {
    const nameLower = name.toLowerCase();
    if (nameLower === "greek") return "el";
    if (nameLower === "ancient greek") return "grc";
    if (nameLower === "english") return "en";
    if (nameLower === "dutch") return "nl";
    if (nameLower === "german") return "de";
    if (nameLower === "french") return "fr";
    if (nameLower === "afrikaans") return "af";
    if (nameLower === "danish") return "da";
    if (nameLower === "spanish") return "es";
    if (nameLower === "latin") return "la";
    if (nameLower === "japanese") return "ja";
    if (nameLower === "arabic") return "ar";
    if (nameLower === "russian") return "ru";
    if (nameLower === "italian") return "it";
    if (nameLower === "portuguese") return "pt";
    return null;
}

/**
 * Wiktionary etymology template codes not covered by {@link langToLanguageName} (historical langs, proto-languages, etc.).
 * Keys must be lowercase; lookup uses {@link String#toLowerCase}.
 */
const ETYM_LANG_EXTRA: Record<string, string> = {
    ang: "Old English",
    enm: "Middle English",
    fro: "Old French",
    frm: "Middle French",
    gem: "Proto-Germanic",
    "gem-pro": "Proto-Germanic",
    goh: "Old High German",
    gmh: "Middle High German",
    got: "Gothic",
    "grc-koi": "Koine Greek",
    grm: "Medieval Greek",
    "ine-pro": "Proto-Indo-European",
    "cel-pro": "Proto-Celtic",
    "sla-pro": "Proto-Slavic",
    "ira-pro": "Proto-Iranian",
    "itc-pro": "Proto-Italic",
    frk: "Frankish",
    "la-vul": "Vulgar Latin",
    non: "Old Norse",
    osx: "Old Saxon",
    cu: "Old Church Slavonic",
    sga: "Old Irish",
    cy: "Welsh",
    ga: "Irish",
    gd: "Scottish Gaelic",
    br: "Breton",
    kw: "Cornish",
    xcl: "Classical Armenian",
    hy: "Armenian",
    fa: "Persian",
    peo: "Old Persian",
    sa: "Sanskrit",
    hit: "Hittite",
    he: "Hebrew",
    arc: "Aramaic",
    xpi: "Proto-Indo-Iranian",
};

/**
 * Human-readable label for an etymology chain/cognate {@code source_lang} code.
 * Uses {@link langToLanguageName}, then {@link languageNameToLang} for section-style names, then {@link ETYM_LANG_EXTRA}; otherwise returns the trimmed source string.
 */
export function etymSourceLangDisplayName(code: string): string {
    const raw = code.trim();
    if (!raw) return "";
    const k = raw.toLowerCase();
    const core = langToLanguageName(k as WikiLang);
    if (core !== null) return core;
    const fromSection = languageNameToLang(raw);
    if (fromSection) {
        const n = langToLanguageName(fromSection);
        if (n !== null) return n;
    }
    return ETYM_LANG_EXTRA[k] ?? raw;
}

/**
 * Lexeme.language may be a WikiLang code or a Wiktionary section title (e.g. "Afrikaans")
 * when no code mapping existed at parse time. Normalize for {@link wiktionary} `lang`
 * (must be a known code or `"Auto"`).
 */
export function normalizeWikiLangArg(input: string | WikiLang): WikiLang {
    const s = String(input).trim();
    if (!s || s === "Auto") return "Auto";
    const fromName = languageNameToLang(s);
    if (fromName) return fromName;
    if (langToLanguageName(s as WikiLang) !== null) return s as WikiLang;
    return "Auto";
}

export function extractAllLanguageSections(wikitext: string): Array<{ langName: string; block: string }> {
    const re = /^==\s*([^=]+)\s*==\s*$/gm;
    let match;
    const sections: Array<{ langName: string; block: string }> = [];
    const positions: Array<{ name: string; start: number }> = [];

    while ((match = re.exec(wikitext)) !== null) {
        positions.push({ name: match[1].trim(), start: match.index });
    }

    for (let i = 0; i < positions.length; i++) {
        const start = positions[i].start;
        const end = i + 1 < positions.length ? positions[i + 1].start : wikitext.length;
        sections.push({
            langName: positions[i].name,
            block: wikitext.slice(start, end)
        });
    }
    return sections;
}
