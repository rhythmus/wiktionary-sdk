export interface SemanticRelation {
  term: string;
  sense_id?: string;
  qualifier?: string;
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
