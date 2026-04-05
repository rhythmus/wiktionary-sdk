import type { EtymologyLink, TemplateCall } from "../../model";
import type { DecoderRegistry } from "./decoder-registry";
import { stripWikiMarkup } from "./strip-wiki-markup";

const ETYMOLOGY_ANCESTOR_TEMPLATES = new Set([
    "inh",
    "inherited",
    "der",
    "derived",
    "bor",
    "borrowed",
    "back-formation",
    "clipping",
    "short for",
    "abbreviation",
    "affix",
    "compound",
    "prefix",
    "suffix",
    "confix",
    "blend",
]);
const ETYMOLOGY_COGNATE_TEMPLATES = new Set(["cog", "cognate", "noncognate", "nc"]);
const ALL_ETYMOLOGY_TEMPLATES = new Set([...ETYMOLOGY_ANCESTOR_TEMPLATES, ...ETYMOLOGY_COGNATE_TEMPLATES]);

const TEMPLATE_RELATION_MAP: Record<string, string> = {
    inh: "inherited",
    inherited: "inherited",
    der: "derived",
    derived: "derived",
    bor: "borrowed",
    borrowed: "borrowed",
    "back-formation": "back-formation",
    clipping: "clipping",
    "short for": "clipping",
    abbreviation: "clipping",
    affix: "affix",
    compound: "compound",
    prefix: "prefix",
    suffix: "suffix",
    confix: "confix",
    blend: "blend",
    cog: "cognate",
    cognate: "cognate",
    noncognate: "cognate",
    nc: "cognate",
    "alternative form of": "alternative",
    "alt form": "alternative",
    "alt form of": "alternative",
};

/** Strip [[links]], {{templates}}, etc. from etymology fields; resolve |alt= when term slot is empty (Template:derived). */
function normalizeEtymologyFields(
    t: TemplateCall,
    isCog: boolean,
): { source_lang: string; term?: string; gloss?: string } {
    const pos = t.params.positional ?? [];
    const named = t.params.named ?? {};
    const sourceRaw = isCog ? (pos[0] ?? "") : (pos[1] ?? "");
    let termRaw = isCog ? pos[1] || undefined : pos[2] || undefined;
    let glossRaw = named["t"] || named["gloss"] || (isCog ? pos[2] : pos[3]) || undefined;
    if (!termRaw?.trim() && !isCog) {
        termRaw = named["alt"] || undefined;
    }
    const source_lang = stripWikiMarkup(sourceRaw.trim()).trim() || sourceRaw.trim();
    const term = termRaw ? stripWikiMarkup(termRaw).trim() || undefined : undefined;
    const gloss = glossRaw ? stripWikiMarkup(glossRaw).trim() || undefined : undefined;
    return { source_lang, term, gloss };
}

/** Etymology chain and cognate templates. */
export function registerEtymology(reg: DecoderRegistry): void {
    reg.register({
        id: "etymology",
        handlesTemplates: [...ALL_ETYMOLOGY_TEMPLATES],
        matches: (ctx) => ctx.templates.some((t) => ALL_ETYMOLOGY_TEMPLATES.has(t.name)),
        decode: (ctx) => {
            const chain: EtymologyLink[] = [];
            const cognates: EtymologyLink[] = [];

            for (const t of ctx.templates) {
                if (!ALL_ETYMOLOGY_TEMPLATES.has(t.name)) continue;
                const isCog = ETYMOLOGY_COGNATE_TEMPLATES.has(t.name);
                const { source_lang, term, gloss } = normalizeEtymologyFields(t, isCog);
                const relation = TEMPLATE_RELATION_MAP[t.name] ?? "derived";
                const link: EtymologyLink = {
                    template: t.name,
                    relation,
                    source_lang,
                    term,
                    gloss,
                    raw: t.raw,
                };
                if (isCog) {
                    cognates.push(link);
                } else {
                    chain.push(link);
                }
            }

            const raw_text = (ctx.etymology.etymology_raw_text ?? "").trim() || undefined;

            if (chain.length === 0 && cognates.length === 0 && !raw_text) return {};
            return {
                entry: {
                    etymology: {
                        ...(chain.length > 0 && { chain }),
                        ...(cognates.length > 0 && { cognates }),
                        ...(raw_text && { raw_text }),
                    },
                },
            };
        },
    });
}
