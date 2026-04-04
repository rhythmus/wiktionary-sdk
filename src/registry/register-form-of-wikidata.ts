import type { DecoderRegistry } from "./decoder-registry";
import { buildFormOfDisplayLabel } from "./form-of-display-label";
import {
    isFormOfTemplateName,
    isPerLangFormOfTemplate,
    isVariantFormOfTemplateName,
} from "./form-of-predicates";

/** Form-of / lemma triggers and Wikidata P31 hook (historical registration order). */
export function registerFormOfWikidata(reg: DecoderRegistry): void {
    reg.register({
        id: "form-of",
        /** Dynamic: any template matching isFormOfTemplateName (Category:Form-of templates + core set). */
        handlesTemplates: [],
        matches: (ctx) => ctx.templates.some((t) => isFormOfTemplateName(t.name)),
        decode: (ctx) => {
            const t = ctx.templates.find((t) => isFormOfTemplateName(t.name));
            if (!t) return {};
            const pos = t.params.positional ?? [];
            const perLang = isPerLangFormOfTemplate(t.name);
            const langPrefix = perLang ? t.name.match(/^([a-z]{2,3})-/i)?.[1]?.toLowerCase() : undefined;
            const lang = perLang ? (langPrefix ?? ctx.lang) : (pos[0] ?? ctx.lang);
            const lemma = perLang ? (pos[0] ?? null) : (pos[1] ?? null);
            const tags = perLang ? pos.slice(1).filter(Boolean) : pos.slice(2).filter(Boolean);
            const named = t.params.named ?? {};
            const label = buildFormOfDisplayLabel(t.name, tags);
            const isVariant = isVariantFormOfTemplateName(t.name);

            // Subclass: strip trailing " of" (e.g. "misspelling of" -> "misspelling")
            const subclass = t.name.replace(/\s+of$/i, "").replace(/\s+form$/i, "").trim().toLowerCase();

            return {
                entry: {
                    type: isVariant ? "FORM_OF" : "INFLECTED_FORM",
                    form_of: { template: t.name, lemma, lang, tags, named, subclass, label },
                },
            };
        },
    });

    reg.register({
        id: "wikidata-p31",
        handlesTemplates: [],
        matches: (ctx) => !!ctx.page.pageprops?.wikibase_item,
        decode: (_ctx) => {
            return {};
        },
    });
}
