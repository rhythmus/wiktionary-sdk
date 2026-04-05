import type { DecoderRegistry } from "./decoder-registry";

/** el-IPA, audio gallery, head-template romanization, rhymes, homophones. */
export function registerPronunciationExtra(reg: DecoderRegistry): void {
    reg.register({
        id: "el-ipa",
        handlesTemplates: ["el-IPA"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "el-IPA"),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => t.name === "el-IPA");
            if (!t) return {};
            const ipa = t.params.positional[0] || undefined;
            if (!ipa) return {};
            return { entry: { pronunciation: { IPA: ipa } } };
        },
    });

    reg.register({
        id: "audio",
        handlesTemplates: ["audio"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "audio"),
        decode: (ctx) => {
            const audioTpls = ctx.templates.filter((t) => t.name === "audio");
            if (audioTpls.length === 0) return {};

            const audio_details: Array<{ url: string; label?: string; filename: string }> = [];
            let firstAudio: string | undefined;
            let firstAudioUrl: string | undefined;
            let firstRomanization: string | undefined;

            for (const t of audioTpls) {
                const file = t.params.positional[1] || t.params.positional[0] || undefined;
                if (!file) continue;
                const normalizedName = file.replace(/ /g, "_");
                const audio_url = `https://upload.wikimedia.org/wikipedia/commons/${normalizedName}`;
                const label = t.params.positional[2] || t.params.named?.label || t.params.named?.p || undefined;

                if (!firstAudio) {
                    firstAudio = file;
                    firstAudioUrl = audio_url;
                    firstRomanization = t.params.named?.tr;
                }
                audio_details.push({ url: audio_url, label, filename: file });
            }

            if (audio_details.length === 0) return {};

            return {
                entry: {
                    pronunciation: {
                        audio: firstAudio,
                        audio_url: firstAudioUrl,
                        audio_details,
                        ...(firstRomanization && { romanization: firstRomanization }),
                    },
                },
            };
        },
    });

    reg.register({
        id: "romanization",
        handlesTemplates: [],
        matches: (ctx) => {
            const allowed = new Set([
                "head",
                "el-verb",
                "el-noun",
                "el-adj",
                "grc-noun",
                "grc-verb",
                "fr-verb",
                "de-noun",
            ]);
            return ctx.templates.some((t) => allowed.has(t.name) && !!t.params.named?.tr);
        },
        decode: (ctx) => {
            const allowed = new Set([
                "head",
                "el-verb",
                "el-noun",
                "el-adj",
                "grc-noun",
                "grc-verb",
                "fr-verb",
                "de-noun",
            ]);
            const t = ctx.templates.find((t) => allowed.has(t.name) && !!t.params.named?.tr);
            if (!t) return {};
            return { entry: { pronunciation: { romanization: t.params.named.tr } } };
        },
    });

    reg.register({
        id: "rhymes",
        handlesTemplates: ["rhymes"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "rhymes"),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => t.name === "rhymes");
            if (!t) return {};
            const pos = t.params.positional ?? [];
            const rhymes = pos.slice(1).filter(Boolean);
            if (rhymes.length === 0) return {};
            return { entry: { pronunciation: { rhymes } } };
        },
    });

    reg.register({
        id: "homophones",
        handlesTemplates: ["homophones"],
        matches: (ctx) => ctx.templates.some((t) => t.name === "homophones"),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => t.name === "homophones");
            if (!t) return {};
            const pos = t.params.positional ?? [];
            const homophones = pos.slice(1).filter(Boolean);
            if (homophones.length === 0) return {};
            return { entry: { pronunciation: { homophones } } };
        },
    });
}
