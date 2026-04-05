import { parseTemplates } from "../parse/parser";
import type { DecoderRegistry } from "./decoder-registry";
import { extractSectionByLevelHeaders } from "./section-extract";

/** First positional is often a language code (|el|, |grk-ita|); otherwise all positionals are syllables. */
function hyphenationSyllablesFromPositionals(positional: string[] | undefined): string[] {
    const pos = (positional || []).map((p) => p.trim()).filter(Boolean);
    if (pos.length === 0) return [];
    // First token already in target script → no leading lang (e.g. {{hyphenation|γρά|φω}}). Must run before the
    // "second is non-ASCII" branch, or Greek|Greek would be misread as lang|syllables.
    if (/[^\x00-\x7F]/.test(pos[0])) {
        return pos;
    }
    // Second token in non-Latin script while first is ASCII → first is a lang code (e.g. {{hyphenation|el|γρά|φω}}).
    if (pos.length >= 2 && /[^\x00-\x7F]/.test(pos[1])) {
        return pos.slice(1);
    }
    // All ASCII: leading token may be a language code (|el|bank|, |el|foo|bar|) or a syllable (|foo|bar|).
    const first = pos[0].toLowerCase();
    const shortLang = /^[a-z]{2,3}$/i.test(first);
    const skipFirst =
        pos.length >= 2 &&
        (HYPHENATION_COMPOUND_LANG_PREFIXES.has(first) ||
            (shortLang && HYPHENATION_LEADING_LANG_CODES.has(first)));
    return skipFirst ? pos.slice(1) : pos;
}

/** Wiktionary-specific hyphenation language tags (not ISO 639-1 single tokens). */
const HYPHENATION_COMPOUND_LANG_PREFIXES = new Set(["grk-ita", "grk-bgr"]);

/** ISO 639-1-style codes commonly used as first param on en.wiktionary {{hyphenation|…}} (closed list; excludes ba to reduce syllable false positives). */
const HYPHENATION_LEADING_LANG_CODES = new Set(
    (
        "aa ab ae af ak am an ar as av ay az be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee " +
        "el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu " +
        "ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my " +
        "na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw " +
        "ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu " +
        "grc grk mul und got tr nl pl fi sv no da cs hu ro bg sr hr sk sl uk be he ar fa zh ja ko hi vi id ms tl sw wo ha yo zu xh st tn ne ng bm bi so om si my km lo th jv su ceb haw mi sm to fy af co br oc an sc rm wa li vo eo io ie ia jbo tok pih dz ch ay qu gn ht lv lt et ast nah rap ab cv"
    )
        .split(/\s+/)
        .filter(Boolean),
);

/**
 * Core verbatim storage, IPA, hyphenation, and PoS-block Alternative forms section.
 * Must stay first in {@link registerAllDecoders} order.
 */
export function registerCoreAndPronunciation(reg: DecoderRegistry): void {
    /** --- Core: store raw template calls (always) --- **/
    reg.register({
        id: "store-raw-templates",
        handlesTemplates: [], // matches all via matches()
        matches: (_ctx) => true,
        decode: (ctx) => {
            const store: any = { entry: { templates: {} } };
            for (const t of ctx.templates) {
                if (!store.entry.templates[t.name]) store.entry.templates[t.name] = [];
                store.entry.templates[t.name].push({ params: t.params, raw: t.raw });
            }
            return store;
        },
    });

    /** --- Headword templates --- **/
    reg.register({
        id: "ipa",
        handlesTemplates: ["IPA"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "IPA"),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => t.name === "IPA");
            const pos = t?.params?.positional ?? [];
            let ipa = pos.find((x) => x.startsWith("/") || x.startsWith("[")) ?? null;
            if (!ipa) {
                ipa = pos.find((x) => x.length > 3 || /[/\[\]ˈˌ]/.test(x)) ?? null;
            }
            if (!ipa) return {};
            return { entry: { pronunciation: { IPA: ipa } } };
        },
    });

    reg.register({
        id: "hyphenation",
        handlesTemplates: ["hyphenation"],
        matches: (ctx) => ctx.lines.some((l) => /^\s*[*#]*\s*\{\{hyphenation\|/.test(l)),
        decode: (ctx) => {
            const line = ctx.lines.find((l) => /^\s*[*#]*\s*\{\{hyphenation\|/.test(l));
            if (!line) return {};
            const tpls = parseTemplates(line);
            const t = tpls.find((x) => x.name === "hyphenation");
            if (!t) return { entry: { hyphenation: { raw: line.trim() } } };
            const sylls = hyphenationSyllablesFromPositionals(t.params.positional);
            if (sylls.length === 0) return { entry: { hyphenation: { raw: line.trim() } } };
            return { entry: { hyphenation: { syllables: sylls, raw: line.trim() } } };
        },
    });

    /** --- Alternative forms section --- **/
    reg.register({
        id: "alternative-forms-section",
        handlesTemplates: [],
        matches: (ctx) => /^=+\s*Alternative forms\s*=+/im.test(ctx.posBlockWikitext),
        decode: (ctx) => {
            const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, "Alternative forms");
            if (!section) return {};

            const lines = section.raw.split("\n").filter((l) => l.includes("{{") || l.includes("[["));
            const alternative_forms: Array<{
                term: string;
                qualifier?: string;
                raw: string;
                type?: string;
                labels?: string[];
            }> = [];

            for (const line of lines) {
                const tpls = parseTemplates(line);

                const variantTpl = tpls.find(
                    (t) => t.name.includes("form of") || t.name === "alt form" || t.name === "polytonic variant",
                );

                if (variantTpl) {
                    const pos = variantTpl.params.positional ?? [];
                    const term = pos[1] || pos[0] || "";
                    if (!term) continue;

                    const type = variantTpl.name.replace(" form of", "").replace(" variant", "").trim();
                    const labels = variantTpl.params.named?.["q"] ? [variantTpl.params.named["q"]] : [];

                    alternative_forms.push({
                        term,
                        raw: line.trim(),
                        type,
                        labels: labels.length > 0 ? labels : undefined,
                    });
                    continue;
                }

                const linkMatch = line.match(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/);
                if (linkMatch) {
                    const term = linkMatch[1];
                    const qualifierMatch = line.match(/\(([^)]+)\)/);
                    alternative_forms.push({
                        term,
                        raw: line.trim(),
                        qualifier: qualifierMatch ? qualifierMatch[1] : undefined,
                    });
                }
            }

            if (alternative_forms.length === 0) return {};
            return { entry: { alternative_forms } };
        },
    });
}
