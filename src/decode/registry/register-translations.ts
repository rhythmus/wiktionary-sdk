import { parseTemplates } from "../../parse/parser";
import type { DecoderRegistry } from "./decoder-registry";

function parseTranslationsFromBlock(wikitext: string) {
    const lines = wikitext.split("\n");
    const out: Record<string, Array<Record<string, unknown>>> = {};
    let currentSense: string | null = null;
    for (const line of lines) {
        const senseM = line.match(/^\*\s*\(([^)]+)\)\s*:/);
        if (senseM) currentSense = senseM[1].trim();
        if (!line.includes("{{t") && !line.includes("{{tt")) continue;

        const tpls = parseTemplates(line);
        for (const t of tpls) {
            if (
                !(
                    t.name === "t" ||
                    t.name === "t+" ||
                    t.name === "t-simple" ||
                    t.name === "tt" ||
                    t.name === "tt+"
                )
            )
                continue;
            const pos = t.params.positional || [];
            const named = t.params.named ?? {};
            // {{t|target_lang|source_lang|term|...}} — pos[1]=translation lang, pos[2]=term
            const lang = pos[1] ?? pos[0];
            const term = pos[2] ?? pos[1];
            if (!lang || !term) continue;
            if (!out[lang]) out[lang] = [];
            const gloss = named.t ?? named.gloss;
            out[lang].push({
                term,
                ...(gloss && { gloss }),
                ...(named.tr && { transliteration: named.tr }),
                ...(named.g && { gender: named.g }),
                ...(named.alt && { alt: named.alt }),
                sense: currentSense || null,
                template: t.name,
                raw: t.raw,
                params: t.params,
            });
        }
    }
    return out;
}

/** Translation row extraction from ===Translations=== (historical registration order). */
export function registerTranslations(reg: DecoderRegistry): void {
    reg.register({
        id: "translations",
        handlesTemplates: ["t", "t+", "t-simple", "tt", "tt+"],
        matches: (ctx) => /==+\s*Translations\s*==+/i.test(ctx.posBlockWikitext),
        decode: (ctx) => {
            const parts = ctx.posBlockWikitext.split("\n");
            let inTr = false;
            const buf: string[] = [];
            for (const line of parts) {
                if (line.match(/^====\s*Translations\s*====\s*$/)) {
                    inTr = true;
                    continue;
                }
                if (inTr && line.match(/^====\s*[^=]/)) {
                    break;
                }
                if (inTr) buf.push(line);
            }
            if (buf.length === 0) return {};
            const tr = parseTranslationsFromBlock(buf.join("\n"));
            if (Object.keys(tr).length === 0) return {};
            return { entry: { translations: tr } };
        },
    });
}
