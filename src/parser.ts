import type { TemplateCall, WikiLang } from "./types";

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
    const lines = langBlock.split("\n");
    let currentEtym: any = { idx: 0, title: "Etymology", posBlocks: [] };
    let currentPOS: any = null;

    function flushPOS() {
        if (currentPOS) {
            currentEtym.posBlocks.push(currentPOS);
            currentPOS = null;
        }
    }
    function flushEtym() {
        flushPOS();
        if (currentEtym.posBlocks.length > 0) etyms.push(currentEtym);
    }

    const etyms: any[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const mE = line.match(/^===\s*Etymology(?:\s+(\d+))?\s*===\s*$/);
        const mPOS = line.match(/^===\s*([^=]+?)\s*===\s*$/);
        if (mE) {
            flushEtym();
            const n = mE[1] ? parseInt(mE[1], 10) : currentEtym.idx + 1;
            currentEtym = {
                idx: n,
                title: `Etymology${mE[1] ? " " + mE[1] : ""}`,
                posBlocks: [],
            };
            continue;
        }
        if (mPOS && !mE) {
            flushPOS();
            currentPOS = { posHeading: mPOS[1].trim(), lines: [] };
            continue;
        }
        if (currentPOS) currentPOS.lines.push(line);
    }
    flushEtym();
    if (etyms.length === 0) {
        return [
            {
                idx: 0,
                title: "Etymology",
                posBlocks: [{ posHeading: "(unknown)", lines: lines.slice(1) }],
            },
        ];
    }
    for (const e of etyms) {
        for (const pb of e.posBlocks) {
            pb.wikitext = pb.lines.join("\n");
            delete pb.lines;
        }
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

export function mapHeadingToPos(heading: string) {
    const h = (heading || "").toLowerCase();
    const map: Record<string, string> = {
        verb: "verb",
        noun: "noun",
        adjective: "adjective",
        pronoun: "pronoun",
        numeral: "numeral",
        adverb: "adverb",
        article: "article",
        participle: "participle",
        preposition: "preposition",
        conjunction: "conjunction",
        particle: "particle",
        "proper noun": "proper_noun",
        suffix: "suffix",
        prefix: "prefix",
        interfix: "interfix",
        phrase: "phrase",
        determiner: "determiner",
    };
    return map[h] || null;
}

export function langToLanguageName(lang: WikiLang): string | null {
    if (lang === "el") return "Greek";
    if (lang === "grc") return "Ancient Greek";
    if (lang === "en") return "English";
    if (lang === "nl") return "Dutch";
    if (lang === "de") return "German";
    if (lang === "fr") return "French";
    return null;
}
