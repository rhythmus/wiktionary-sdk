import type { DecoderRegistry } from "./decoder-registry";
import { GENDER_MAP } from "./gender-map";

/** Greek, Dutch, and German headword PoS decoders (historical registration order). */
export function registerHeadwordsElNlDe(reg: DecoderRegistry): void {
    reg.register({
        id: "el-adj-head",
        handlesTemplates: ["el-adj"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-adj"),
        decode: (_ctx) => ({ entry: { part_of_speech: "adjective" } }),
    });

    reg.register({
        id: "el-noun-head",
        handlesTemplates: ["el-noun"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-noun"),
        decode: (_ctx) => ({ entry: { part_of_speech: "noun" } }),
    });

    reg.register({
        id: "el-verb-head",
        handlesTemplates: ["el-verb"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-verb"),
        decode: (_ctx) => ({ entry: { part_of_speech: "verb" } }),
    });

    reg.register({
        id: "el-pron-head",
        handlesTemplates: ["el-pron"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-pron"),
        decode: (_ctx) => ({ entry: { part_of_speech: "pronoun" } }),
    });

    reg.register({
        id: "el-numeral-head",
        handlesTemplates: ["el-numeral"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-numeral"),
        decode: (_ctx) => ({ entry: { part_of_speech: "numeral" } }),
    });

    reg.register({
        id: "el-participle-head",
        handlesTemplates: ["el-part"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-part"),
        decode: (_ctx) => ({ entry: { part_of_speech: "participle" } }),
    });

    reg.register({
        id: "el-adv-head",
        handlesTemplates: ["el-adv"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-adv"),
        decode: (_ctx) => ({ entry: { part_of_speech: "adverb" } }),
    });

    reg.register({
        id: "el-art-head",
        handlesTemplates: ["el-art", "el-art-def", "el-art-indef"],
        matches: (ctx) =>
            ctx.templates.some(
                (t) =>
                    t.name === "el-art" ||
                    t.name === "el-art-def" ||
                    t.name === "el-art-indef",
            ),
        decode: (_ctx) => ({ entry: { part_of_speech: "article" } }),
    });

    reg.register({
        id: "nl-adj-head",
        handlesTemplates: ["nl-adj"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "nl-adj"),
        decode: (_ctx) => ({ entry: { part_of_speech: "adjective" } }),
    });

    reg.register({
        id: "nl-noun-head",
        handlesTemplates: ["nl-noun", "nl-noun-dim", "nl-noun-dim-tant"],
        matches: (ctx) =>
            ctx.templates.some((t) => ["nl-noun", "nl-noun-dim", "nl-noun-dim-tant"].includes(t.name)),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => ["nl-noun", "nl-noun-dim", "nl-noun-dim-tant"].includes(t.name));
            if (!t) return {};
            const pos = t.params.positional ?? [];
            const rawGender = t.params.named?.g || pos[0] || "";
            const gender =
                GENDER_MAP[rawGender.toLowerCase()] || (rawGender.toLowerCase() === "c" ? "common" : null);
            return {
                entry: {
                    part_of_speech: "noun",
                    ...(gender !== null && { headword_morphology: { gender } }),
                },
            };
        },
    });

    reg.register({
        id: "nl-verb-head",
        handlesTemplates: ["nl-verb"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "nl-verb"),
        decode: (_ctx) => ({ entry: { part_of_speech: "verb" } }),
    });

    reg.register({
        id: "de-adj-head",
        handlesTemplates: ["de-adj"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "de-adj"),
        decode: (_ctx) => ({ entry: { part_of_speech: "adjective" } }),
    });

    reg.register({
        id: "de-noun-head",
        handlesTemplates: ["de-noun", "de-proper noun"],
        matches: (ctx) => ctx.templates.some((t) => ["de-noun", "de-proper noun"].includes(t.name)),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => ["de-noun", "de-proper noun"].includes(t.name));
            if (!t) return {};
            const pos = t.params.positional ?? [];
            const fullParam = pos[0] || "";
            const rawGender = fullParam.split(",")[0] || "";
            const gender = GENDER_MAP[rawGender.toLowerCase()] || null;
            return {
                entry: {
                    part_of_speech: "noun",
                    ...(gender !== null && { headword_morphology: { gender } }),
                },
            };
        },
    });

    reg.register({
        id: "de-verb-head",
        handlesTemplates: ["de-verb"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "de-verb"),
        decode: (_ctx) => ({ entry: { part_of_speech: "verb" } }),
    });
}
