import type { SemanticRelation, SemanticRelations, SectionLinkItem } from "../../model";
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

function parseSenseGlossFromSectionItem(raw: string): string | undefined {
    const m = raw.match(/^\*\s*\(([^)]+)\)/);
    return m ? m[1].trim() : undefined;
}

/**
 * Enhanced section parser: for each bullet line, extracts parenthetical qualifiers
 * adjacent to `{{l|…}}` templates and attaches them as `gloss` on the item.
 */
function parseSectionRelationItems(
    sectionRaw: string,
): Array<SectionLinkItem & { lineQualifier?: string }> {
    const linkItems = parseSectionLinkTemplates(sectionRaw);
    if (linkItems.length === 0) return [];

    const lines = sectionRaw.split("\n");
    const results: Array<SectionLinkItem & { lineQualifier?: string }> = [];

    for (const item of linkItems) {
        const hostLine = lines.find((l) => l.includes(item.raw));
        const lineQualifier = hostLine
            ? parseSenseGlossFromSectionItem(hostLine)
            : undefined;
        results.push({
            ...item,
            gloss: item.gloss || lineQualifier || undefined,
            lineQualifier,
        });
    }
    return results;
}

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
                    const rel: SemanticRelation = { term, qualifier };
                    if (senseId) {
                        rel.sense_id = senseId;
                        rel.source_evidence = "template_id";
                        rel.confidence = "high";
                    }
                    relations[key]!.push(rel);
                }
            }

            for (const [header, field] of Object.entries(RELATION_HEADERS)) {
                const section = extractSectionByLevelHeaders(ctx.posBlockWikitext, header);
                if (!section) continue;
                const items = parseSectionRelationItems(section.raw);
                if (items.length === 0) continue;
                if (!relations[field as keyof SemanticRelations])
                    relations[field as keyof SemanticRelations] = [];
                for (const item of items) {
                    const rel: SemanticRelation = {
                        term: item.term,
                        qualifier: item.gloss,
                    };
                    if (item.lineQualifier || item.gloss) {
                        rel.source_evidence = "section_scope";
                        rel.confidence = "medium";
                    }
                    relations[field as keyof SemanticRelations]!.push(rel);
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
