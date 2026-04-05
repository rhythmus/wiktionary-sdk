import type { SemanticRelations } from "../types";
import type { DecoderRegistry } from "./decoder-registry";
import {
    extractSectionByLevelHeaders,
    matchesSectionHeading,
    parseSectionLinkTemplates,
} from "./section-extract";

const RELATION_TEMPLATES: Record<string, keyof SemanticRelations> = {
    syn: "synonyms",
    ant: "antonyms",
    hyper: "hypernyms",
    hypo: "hyponyms",
};

const RELATION_HEADERS = {
    Synonyms: "synonyms",
    Antonyms: "antonyms",
    Hypernyms: "hypernyms",
    Hyponyms: "hyponyms",
    "Coordinate terms": "coordinate_terms",
    Holonyms: "holonyms",
    Meronyms: "meronyms",
    Troponyms: "troponyms",
    Comeronyms: "comeronyms",
    Parasynonyms: "parasynonyms",
    Collocations: "collocations",
} as const;

/** Template and section synonym/antonym/hypernym/hyponym extraction. */
export function registerSemanticRelations(reg: DecoderRegistry): void {
    reg.register({
        id: "semantic-relations",
        handlesTemplates: ["syn", "ant", "hyper", "hypo"],
        matches: (ctx) =>
            ctx.templates.some((t) => Object.keys(RELATION_TEMPLATES).includes(t.name)) ||
            Object.keys(RELATION_HEADERS).some((h) => matchesSectionHeading(ctx.posBlockWikitext, h)),
        decode: (ctx) => {
            const relations: SemanticRelations = {};

            // 1. Template-based relations
            for (const t of ctx.templates) {
                const key = RELATION_TEMPLATES[t.name];
                if (!key) continue;
                const pos = t.params.positional ?? [];
                const lang = pos[0];
                if (!lang) continue;
                const terms = pos.slice(1).filter(Boolean);
                const qualifier = t.params.named?.["q"] || undefined;
                const senseId = t.params.named?.["id"] || undefined;
                if (!relations[key]) relations[key] = [];
                for (const term of terms) {
                    relations[key]!.push({ term, sense_id: senseId, qualifier });
                }
            }

            // 2. Section-based relations (====Synonyms====)
            for (const [header, field] of Object.entries(RELATION_HEADERS)) {
                const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, header);
                if (section) {
                    const items = parseSectionLinkTemplates(section.raw);
                    if (items.length > 0) {
                        if (!relations[field as keyof SemanticRelations])
                            relations[field as keyof SemanticRelations] = [];
                        for (const item of items) {
                            relations[field as keyof SemanticRelations]!.push({
                                term: item.term,
                                qualifier: item.gloss,
                            });
                        }
                    }
                }
            }

            if (Object.keys(relations).length === 0) return {};
            for (const key of Object.keys(relations) as Array<keyof SemanticRelations>) {
                const values = relations[key];
                if (!values || values.length === 0) continue;
                const seen = new Set<string>();
                relations[key] = values.filter((v) => {
                    const sig = `${v.term}::${v.sense_id || ""}::${v.qualifier || ""}`;
                    if (seen.has(sig)) return false;
                    seen.add(sig);
                    return true;
                });
            }
            return { entry: { semantic_relations: relations } };
        },
    });
}
