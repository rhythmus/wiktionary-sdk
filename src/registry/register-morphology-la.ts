import type { TemplateCall } from "../types";
import type { DecoderRegistry } from "./decoder-registry";
import { GENDER_MAP } from "./gender-map";

/** Maps param key pairs to transitivity value. */
function decodeTransitivity(named: Record<string, string>): "transitive" | "intransitive" | "both" | null {
    const hasTr = named["tr"] === "yes" || named["tr"] === "1" || named["type"] === "tr";
    const hasIntr =
        named["intr"] === "yes" ||
        named["intr"] === "1" ||
        named["type"] === "intr" ||
        named["intrans"] === "yes";
    if (hasTr && hasIntr) return "both";
    if (hasTr) return "transitive";
    if (hasIntr) return "intransitive";
    return null;
}

/** Maps {{el-verb}} principal-parts param names to slot names. */
const VERB_PART_PARAMS: Array<[string, string]> = [
    ["past", "simple_past"],
    ["past2", "simple_past_alt"],
    ["pres_pass", "present_passive"],
    ["perf_pass", "perfect_passive"],
    ["fut", "future_active"],
    ["fut_pass", "future_passive"],
];

/** Latin {{la-noun}} / {{la-proper noun}}: |g= / |g2= or .M/.F/.N in |1= subtype (see Template:la-noun). */
function decodeLaNounGenderFromTemplate(t: TemplateCall): "masculine" | "feminine" | "neuter" | null {
    const named = t.params.named ?? {};
    const pos = t.params.positional ?? [];
    const rawNamed = (named["g"] || named["g2"] || "").toString().trim();
    if (rawNamed) {
        const first = rawNamed.split(/[,|]/)[0].trim().charAt(0).toLowerCase();
        const g = GENDER_MAP[first];
        if (g && g !== "common") return g;
    }
    const p1 = pos[0] || "";
    const m = p1.match(/\.([MFN])(?:>|$|\s)/i);
    if (m) {
        const L = m[1].toUpperCase();
        if (L === "M") return "masculine";
        if (L === "F") return "feminine";
        if (L === "N") return "neuter";
    }
    return null;
}

/** Greek verb/noun headword morphology and Latin noun gender (historical registration order). */
export function registerMorphologyLa(reg: DecoderRegistry): void {
    reg.register({
        id: "el-verb-morphology",
        handlesTemplates: ["el-verb"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-verb"),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => t.name === "el-verb");
            if (!t) return {};
            const named = t.params.named ?? {};
            const transitivity = decodeTransitivity(named);
            const principal_parts: Record<string, string> = {};
            for (const [param, slot] of VERB_PART_PARAMS) {
                if (named[param]) principal_parts[slot] = named[param];
            }
            const aspect =
                named["asp"] === "perf" ? "perfective" : named["asp"] === "impf" ? "imperfective" : null;
            const voice =
                named["voice"] === "act"
                    ? "active"
                    : named["voice"] === "pass"
                      ? "passive"
                      : named["voice"] === "mp"
                        ? "mediopassive"
                        : null;
            return {
                entry: {
                    part_of_speech: "verb",
                    headword_morphology: {
                        ...(transitivity !== null && { transitivity }),
                        ...(aspect !== null && { aspect }),
                        ...(voice !== null && { voice }),
                        ...(Object.keys(principal_parts).length > 0 && { principal_parts }),
                    },
                },
            };
        },
    });

    reg.register({
        id: "el-noun-gender",
        handlesTemplates: ["el-noun"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-noun"),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => t.name === "el-noun");
            if (!t) return {};
            const named = t.params.named ?? {};
            const pos = t.params.positional ?? [];
            // Gender is usually the first positional param or the `g=` named param
            const rawGender = named["g"] || named["gender"] || pos[0] || "";
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
        id: "la-noun-head",
        handlesTemplates: ["la-noun", "la-proper noun"],
        matches: (ctx) =>
            ctx.templates.some((t) => t.name === "la-noun" || t.name === "la-proper noun"),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => t.name === "la-noun" || t.name === "la-proper noun");
            if (!t) return {};
            const gender = decodeLaNounGenderFromTemplate(t);
            return {
                entry: {
                    part_of_speech: "noun",
                    ...(gender !== null && { headword_morphology: { gender } }),
                },
            };
        },
    });
}
