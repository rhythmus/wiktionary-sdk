/**
 * Post-decode pass: links each SemanticRelation to a specific sense on the
 * same lexeme, producing `semantic_relations_by_sense` and enriching the
 * flat `semantic_relations` items with `matched_sense_id` + confidence.
 *
 * Evidence tiers:
 *   high   – template carried an explicit sense anchor (`id=`)
 *   medium – relation section had a qualifier/gloss that maps to a sense
 *   low    – best-effort token overlap between qualifier/term and gloss
 */
import type {
    Lexeme,
    Sense,
    SemanticRelation,
    SemanticRelations,
    SemanticRelationsBySense,
    RelationConfidence,
} from "../model";

const LINKER_STOPWORDS = new Set([
    "the", "and", "for", "with", "from", "this", "that", "into", "onto",
    "about", "used", "use", "very", "also", "such", "some", "many",
]);

function tokenize(s: string): string[] {
    return (s || "")
        .toLocaleLowerCase()
        .replace(/[_()[\],.;:!?/\\'"`{}-]+/g, " ")
        .split(/\s+/)
        .map((x) => x.trim())
        .filter((x) => x.length >= 3 && !LINKER_STOPWORDS.has(x));
}

function senseTextBag(sense: Sense): Set<string> {
    const parts: string[] = [sense.gloss || ""];
    if (sense.gloss_raw) parts.push(sense.gloss_raw);
    if (sense.qualifier) parts.push(sense.qualifier);
    if (sense.labels) parts.push(...sense.labels);
    if (sense.topics) parts.push(...sense.topics);
    return new Set(tokenize(parts.join(" ")));
}

interface ScoredMatch {
    senseId: string;
    score: number;
    confidence: RelationConfidence;
}

function scoreSenseForRelation(
    sense: Sense,
    senseTokens: Set<string>,
    rel: SemanticRelation,
): ScoredMatch | null {
    if (rel.source_evidence === "template_id" && rel.sense_id) {
        if (sense.id === rel.sense_id) {
            return { senseId: sense.id, score: 100, confidence: "high" };
        }
        return null;
    }

    const qualifierTokens = tokenize(rel.qualifier || "");
    const termTokens = tokenize(rel.term || "");

    let score = 0;

    for (const token of qualifierTokens) {
        if (senseTokens.has(token)) score += 3;
    }

    if (rel.qualifier) {
        const qualLower = rel.qualifier.toLocaleLowerCase();
        const glossLower = (sense.gloss || "").toLocaleLowerCase();
        if (glossLower.includes(qualLower)) score += 5;
    }

    for (const token of termTokens) {
        if (senseTokens.has(token)) score += 1;
    }

    if (score < 2) return null;

    const confidence: RelationConfidence = score >= 5 ? "medium" : "low";
    return { senseId: sense.id, score, confidence };
}

function bestSenseMatch(
    senses: Sense[],
    senseBags: Map<string, Set<string>>,
    rel: SemanticRelation,
): ScoredMatch | null {
    let best: ScoredMatch | null = null;
    for (const sense of senses) {
        const tokens = senseBags.get(sense.id)!;
        const match = scoreSenseForRelation(sense, tokens, rel);
        if (!match) continue;
        if (!best || match.score > best.score) best = match;
    }
    return best;
}

const RELATION_FAMILIES: Array<keyof SemanticRelations> = [
    "synonyms", "antonyms", "hypernyms", "hyponyms",
    "coordinate_terms", "holonyms", "meronyms", "troponyms",
    "comeronyms", "parasynonyms", "collocations",
];

export function linkRelationsToSenses(lexeme: Lexeme): void {
    if (!lexeme.senses || lexeme.senses.length === 0) return;
    if (!lexeme.semantic_relations) return;

    const allSenses = collectAllSenses(lexeme.senses);
    if (allSenses.length === 0) return;

    const senseBags = new Map<string, Set<string>>();
    for (const sense of allSenses) {
        senseBags.set(sense.id, senseTextBag(sense));
    }

    const bySense: SemanticRelationsBySense = {};

    for (const family of RELATION_FAMILIES) {
        const items = lexeme.semantic_relations[family];
        if (!items || items.length === 0) continue;

        for (const rel of items) {
            if (rel.source_evidence === "template_id" && rel.sense_id) {
                rel.matched_sense_id = rel.sense_id;
                rel.confidence = "high";
                appendToBySense(bySense, rel.sense_id, family, rel);
                continue;
            }

            if (rel.source_evidence === "section_scope" && rel.qualifier) {
                const match = bestSenseMatch(allSenses, senseBags, rel);
                if (match) {
                    rel.matched_sense_id = match.senseId;
                    rel.confidence = match.confidence;
                    rel.source_evidence = rel.source_evidence;
                    appendToBySense(bySense, match.senseId, family, rel);
                    continue;
                }
            }

            const match = bestSenseMatch(allSenses, senseBags, rel);
            if (match) {
                rel.matched_sense_id = match.senseId;
                rel.confidence = match.confidence;
                if (!rel.source_evidence) rel.source_evidence = "heuristic";
                appendToBySense(bySense, match.senseId, family, rel);
            }
        }
    }

    if (Object.keys(bySense).length > 0) {
        lexeme.semantic_relations_by_sense = bySense;
    }
}

function appendToBySense(
    bySense: SemanticRelationsBySense,
    senseId: string,
    family: keyof SemanticRelations,
    rel: SemanticRelation,
): void {
    if (!bySense[senseId]) bySense[senseId] = {};
    const group = bySense[senseId];
    if (!group[family]) group[family] = [];
    group[family]!.push(rel);
}

function collectAllSenses(senses: Sense[]): Sense[] {
    const out: Sense[] = [];
    for (const s of senses) {
        out.push(s);
        if (s.subsenses) out.push(...collectAllSenses(s.subsenses));
    }
    return out;
}
