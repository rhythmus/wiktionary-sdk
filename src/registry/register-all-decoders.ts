import type { DecoderRegistry } from "./decoder-registry";
import { registerCoreAndPronunciation } from "./register-core-pronunciation";
import { registerHeadwordsElNlDe } from "./register-headwords-el-nl-de";
import { registerFormOfWikidata } from "./register-form-of-wikidata";
import { registerTranslations } from "./register-translations";
import { registerSenses } from "./register-senses";
import { registerMorphologyLa } from "./register-morphology-la";
import { registerSemanticRelations } from "./register-semantic-relations";
import { registerEtymology } from "./register-etymology";
import { registerPronunciationExtra } from "./register-pronunciation-extra";
import { registerSections } from "./register-sections";

/**
 * Register all template/section decoders in **historical source order**.
 * Call once per {@link DecoderRegistry} instance (typically the package singleton).
 */
export function registerAllDecoders(reg: DecoderRegistry): void {
registerCoreAndPronunciation(reg);
registerHeadwordsElNlDe(reg);
registerFormOfWikidata(reg);
registerTranslations(reg);
registerSenses(reg);
registerMorphologyLa(reg);
registerSemanticRelations(reg);
registerEtymology(reg);
registerPronunciationExtra(reg);
registerSections(reg);

function registerInflectionTableAndStems(): void {
reg.register({
    id: "inflection-table-ref",
    handlesTemplates: [],
    matches: (ctx) => ctx.templates.some(t => t.name.startsWith("el-conj-") || t.name.startsWith("el-decl-") || t.name.startsWith("el-conjug-") || t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-")),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name.startsWith("el-conj-") || t.name.startsWith("el-decl-") || t.name.startsWith("el-conjug-") || t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-"));
        if (!t) return {};
        return {
            entry: {
                inflection_table_ref: {
                    template_name: t.name,
                    raw: t.raw,
                },
            },
        };
    },
});

/** --- High-Fidelity Greek Inflection Stems --- **/
reg.register({
    id: "el-verb-stems",
    handlesTemplates: ["el-conjug-1st", "el-conjug-2nd", "el-conjug-passive-1st", "el-conjug-passive-2nd"],
    matches: (ctx) => ctx.templates.some(t => t.name.startsWith("el-conjug-")),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name.startsWith("el-conjug-"));
        if (!t) return {};
        const named = t.params.named ?? {};
        const principal_parts: Record<string, string> = {};
        
        // Map stems to principal parts
        if (named.present) principal_parts["present"] = named.present + "ω";
        if (named["a-simplepast"]) principal_parts["aorist_active"] = named["a-simplepast"] + "α";
        if (named["p-simplepast"]) principal_parts["aorist_passive"] = named["p-simplepast"] + "α";
        if (named["p-perf-part"]) principal_parts["perfect_passive_participle"] = named["p-perf-part"] + "μένος";
        if (named["a-dependent"]) principal_parts["dependent_active"] = named["a-dependent"] + "ω";
        if (named["p-dependent"]) principal_parts["dependent_passive"] = named["p-dependent"] + "ω";
        
        return {
            entry: {
                headword_morphology: {
                    principal_parts: Object.keys(principal_parts).length > 0 ? principal_parts : undefined
                }
            }
        };
    }
});

reg.register({
    id: "el-noun-stems",
    handlesTemplates: [],
    matches: (ctx) => ctx.templates.some(t => t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-")),
    decode: (ctx) => {
        const t = ctx.templates.find(t => t.name.startsWith("el-nN-") || t.name.startsWith("el-nM-") || t.name.startsWith("el-nF-"));
        if (!t) return {};
        const stem = t.params.positional?.[0] || "";
        if (!stem) return {};
        
        const gender = t.name.startsWith("el-nM-") ? "masculine" : (t.name.startsWith("el-nF-") ? "feminine" : (t.name.startsWith("el-nN-") ? "neuter" : undefined));
        return {
            entry: {
                headword_morphology: {
                    ...(gender ? { gender } : {}),
                    principal_parts: {
                        "stem": stem
                    }
                }
            }
        };
    }
});
}
registerInflectionTableAndStems();
}
