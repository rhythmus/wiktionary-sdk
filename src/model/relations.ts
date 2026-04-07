export type RelationSourceEvidence =
  | "template_id"
  | "section_scope"
  | "qualifier_match"
  | "heuristic";

export type RelationConfidence = "high" | "medium" | "low";

export interface SemanticRelation {
  term: string;
  sense_id?: string;
  qualifier?: string;
  source_evidence?: RelationSourceEvidence;
  confidence?: RelationConfidence;
  matched_sense_id?: string;
}

export interface SemanticRelations {
  synonyms?: SemanticRelation[];
  antonyms?: SemanticRelation[];
  hypernyms?: SemanticRelation[];
  hyponyms?: SemanticRelation[];
  /** Terms that are peers at the same level (e.g. days of the week together). */
  coordinate_terms?: SemanticRelation[];
  /** Wholes that contain this term as a part (meronymy inverse). */
  holonyms?: SemanticRelation[];
  /** Parts that make up this term. */
  meronyms?: SemanticRelation[];
  /** For verbs: manner-of-action subtypes (e.g. "sprint" is a troponym of "run"). */
  troponyms?: SemanticRelation[];
  /**
   * Words in the same semantic field (complementary or contrastive), per
   * en.wiktionary `====Comeronyms====` (see `docs/section-inventory.md`).
   */
  comeronyms?: SemanticRelation[];
  /** Near-synonyms with distinct nuance (`====Parasynonyms====`). */
  parasynonyms?: SemanticRelation[];
  /** Typical word combinations (`====Collocations====` or list content). */
  collocations?: SemanticRelation[];
}

export interface SenseSemanticRelations extends SemanticRelations {
  /** Sense ID this group is linked to. */
  sense_id: string;
}

export type SemanticRelationsBySense = Record<string, SemanticRelations>;
