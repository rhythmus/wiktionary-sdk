/**
 * Closed vocabulary for `Lexeme.part_of_speech` (strict slug), interchange with external
 * lexicons, and future headword/ja logic. Aligned with the standard + Japanese tags documented
 * at https://www.odict.org/docs/reference/pos — ODict `aux-adj` / `conj_s` style codes use
 * snake_case (`auxiliary_adjective`, `subordinating_conjunction`); Japanese tags use underscores
 * for hyphens (`adj_na`, `v5r_i`). Synonymous ODict abbreviations (`n`, `adj`, `vt`) map onto
 * these slugs (e.g. `noun`, `adjective`, `transitive_verb`), not separate enum members.
 *
 * Section headings for morphemes, symbols, phraseology, etc. may still use
 * `lexicographic_section` with `part_of_speech: null` per `lexicographic-headings.ts`.
 *
 * Canonical list mirrored in `schema/normalized-entry.schema.json` `$defs.PartOfSpeech`
 * (see `test/schema-pos-parity.test.ts`).
 */
export const PART_OF_SPEECH_VALUES = [
  "abbreviation", // ODict `abbrev`: abbreviation
  "adfix", // ODict `adf`: adfix
  "adj_f", // ODict `adj-f` (Japanese): noun or verb acting prenominally
  "adj_ix", // ODict `adj-ix` (Japanese): adjective (keiyoushi) — yoi/ii class
  "adj_kari", // ODict `adj-kari` (Japanese): kari adjective (archaic)
  "adj_ku", // ODict `adj-ku` (Japanese): ku adjective (archaic)
  "adj_na", // ODict `adj-na` (Japanese): adjectival nouns or quasi-adjectives (keiyodoshi)
  "adj_nari", // ODict `adj-nari` (Japanese): archaic/formal form of na-adjective
  "adj_no", // ODict `adj-no` (Japanese): nouns which may take the genitive case particle no
  "adj_pn", // ODict `adj-pn` (Japanese): pre-noun adjectival (rentaishi)
  "adj_shiku", // ODict `adj-shiku` (Japanese): shiku adjective (archaic)
  "adj_t", // ODict `adj-t` (Japanese): taru adjective
  "adjective", // ODict `adj`: adjective
  "adjective_phrase", // ODict `phr_adj`: adjective phrase
  "adv_to", // ODict `adv-to` (Japanese): adverb taking the to particle
  "adverb", // ODict `adv`: adverb
  "adverbial_phrase", // ODict `phr_adv`: adverbial phrase
  "affix", // ODict `aff`: affix
  "article", // en.wiktionary strict PoS (not listed in ODict standard table)
  "auxiliary", // ODict `aux`: auxiliary
  "auxiliary_adjective", // ODict `aux-adj`: auxiliary adjective
  "auxiliary_verb", // ODict `aux-v`: auxiliary verb
  "character", // ODict `chr`: character
  "circumfix", // ODict `crcf`: circumfix
  "conjunction", // ODict `conj`: conjunction
  "contraction", // en.wiktionary strict PoS (not listed in ODict standard table)
  "coordinating_conjunction", // ODict `cconj`: coordinating conjunction
  "copula", // ODict `cop`: copula
  "counter", // ODict `ctr`: counter
  "determiner", // ODict `det`: determiner
  "expression", // ODict `expr`: expression
  "infix", // ODict `inf`: infix
  "interfix", // ODict `intf`: interfix
  "interjection", // ODict `intj`: interjection
  "intransitive_verb", // ODict `vi`: intransitive verb
  "n_adv", // ODict `n-adv` (Japanese): adverbial noun (fukushitekimeishi)
  "n_pref", // ODict `n-pref` (Japanese): noun, used as a prefix
  "n_suf", // ODict `n-suf` (Japanese): noun, used as a suffix
  "n_t", // ODict `n-t` (Japanese): noun (temporal) (jisoumeishi)
  "name", // ODict `name`: name
  "noun", // ODict `n`: noun
  "numeral", // en.wiktionary strict PoS — Numeral section (distinct from ODict `num`)
  "numeric", // ODict `num`: numeric
  "participle", // en.wiktionary strict PoS (not listed in ODict standard table)
  "particle", // ODict `part`: particle
  "phrase", // ODict `phr`: phrase
  "postposition", // ODict `postp`: postposition
  "prefix", // ODict `pref`: prefix
  "preposition", // ODict `prep`: preposition
  "prepositional_phrase", // ODict `phr_prep`: prepositional phrase
  "pronoun", // ODict `pron`: pronoun
  "proper_noun", // ODict `propn`: proper noun
  "proverb", // ODict `prov`: proverb
  "punctuation", // ODict `punc`: punctuation
  "subordinating_conjunction", // ODict `conj_s`: subordinating conjunction
  "suffix", // ODict `suff`: suffix
  "symbol", // ODict `sym`: symbol
  "transitive_verb", // ODict `vt`: transitive verb
  "unknown", // ODict `un`: unknown
  "v_unspec", // ODict `v-unspec` (Japanese): verb unspecified
  "v1", // ODict `v1` (Japanese): Ichidan verb
  "v1_s", // ODict `v1-s` (Japanese): Ichidan verb — kureru special class
  "v2a_s", // ODict `v2a-s` (Japanese): Nidan verb with u ending (archaic)
  "v2b_k", // ODict `v2b-k` (Japanese): Nidan verb (upper class) with bu ending (archaic)
  "v2b_s", // ODict `v2b-s` (Japanese): Nidan verb (lower class) with bu ending (archaic)
  "v2d_k", // ODict `v2d-k` (Japanese): Nidan verb (upper class) with dzu ending (archaic)
  "v2d_s", // ODict `v2d-s` (Japanese): Nidan verb (lower class) with dzu ending (archaic)
  "v2g_k", // ODict `v2g-k` (Japanese): Nidan verb (upper class) with gu ending (archaic)
  "v2g_s", // ODict `v2g-s` (Japanese): Nidan verb (lower class) with gu ending (archaic)
  "v2h_k", // ODict `v2h-k` (Japanese): Nidan verb (upper class) with hu/fu ending (archaic)
  "v2h_s", // ODict `v2h-s` (Japanese): Nidan verb (lower class) with hu/fu ending (archaic)
  "v2k_k", // ODict `v2k-k` (Japanese): Nidan verb (upper class) with ku ending (archaic)
  "v2k_s", // ODict `v2k-s` (Japanese): Nidan verb (lower class) with ku ending (archaic)
  "v2m_k", // ODict `v2m-k` (Japanese): Nidan verb (upper class) with mu ending (archaic)
  "v2m_s", // ODict `v2m-s` (Japanese): Nidan verb (lower class) with mu ending (archaic)
  "v2n_s", // ODict `v2n-s` (Japanese): Nidan verb (lower class) with nu ending (archaic)
  "v2r_k", // ODict `v2r-k` (Japanese): Nidan verb (upper class) with ru ending (archaic)
  "v2r_s", // ODict `v2r-s` (Japanese): Nidan verb (lower class) with ru ending (archaic)
  "v2s_s", // ODict `v2s-s` (Japanese): Nidan verb (lower class) with su ending (archaic)
  "v2t_k", // ODict `v2t-k` (Japanese): Nidan verb (upper class) with tsu ending (archaic)
  "v2t_s", // ODict `v2t-s` (Japanese): Nidan verb (lower class) with tsu ending (archaic)
  "v2w_s", // ODict `v2w-s` (Japanese): Nidan verb (lower class) with u ending and we conjugation (archaic)
  "v2y_k", // ODict `v2y-k` (Japanese): Nidan verb (upper class) with yu ending (archaic)
  "v2y_s", // ODict `v2y-s` (Japanese): Nidan verb (lower class) with yu ending (archaic)
  "v2z_s", // ODict `v2z-s` (Japanese): Nidan verb (lower class) with zu ending (archaic)
  "v4b", // ODict `v4b` (Japanese): Yodan verb with bu ending (archaic)
  "v4g", // ODict `v4g` (Japanese): Yodan verb with gu ending (archaic)
  "v4h", // ODict `v4h` (Japanese): Yodan verb with hu/fu ending (archaic)
  "v4k", // ODict `v4k` (Japanese): Yodan verb with ku ending (archaic)
  "v4m", // ODict `v4m` (Japanese): Yodan verb with mu ending (archaic)
  "v4n", // ODict `v4n` (Japanese): Yodan verb with nu ending (archaic)
  "v4r", // ODict `v4r` (Japanese): Yodan verb with ru ending (archaic)
  "v4s", // ODict `v4s` (Japanese): Yodan verb with su ending (archaic)
  "v4t", // ODict `v4t` (Japanese): Yodan verb with tsu ending (archaic)
  "v5aru", // ODict `v5aru` (Japanese): Godan verb — -aru special class
  "v5b", // ODict `v5b` (Japanese): Godan verb with bu ending
  "v5g", // ODict `v5g` (Japanese): Godan verb with gu ending
  "v5k", // ODict `v5k` (Japanese): Godan verb with ku ending
  "v5k_s", // ODict `v5k-s` (Japanese): Godan verb — Iku/Yuku special class
  "v5m", // ODict `v5m` (Japanese): Godan verb with mu ending
  "v5n", // ODict `v5n` (Japanese): Godan verb with nu ending
  "v5r", // ODict `v5r` (Japanese): Godan verb with ru ending
  "v5r_i", // ODict `v5r-i` (Japanese): Godan verb with ru ending (irregular verb)
  "v5s", // ODict `v5s` (Japanese): Godan verb with su ending
  "v5t", // ODict `v5t` (Japanese): Godan verb with tsu ending
  "v5u", // ODict `v5u` (Japanese): Godan verb with u ending
  "v5u_s", // ODict `v5u-s` (Japanese): Godan verb with u ending (special class)
  "v5uru", // ODict `v5uru` (Japanese): Godan verb — Uru old class verb (old form of Eru)
  "verb", // ODict `v`: verb
  "vk", // ODict `vk` (Japanese): Kuru verb — special class
  "vn", // ODict `vn` (Japanese): irregular nu verb
  "vr", // ODict `vr` (Japanese): irregular ru verb; plain form ends with -ri
  "vs", // ODict `vs` (Japanese): noun or participle which takes the aux. verb suru
  "vs_c", // ODict `vs-c` (Japanese): su verb — precursor to the modern suru
  "vs_i", // ODict `vs-i` (Japanese): suru verb — included
  "vs_s", // ODict `vs-s` (Japanese): suru verb — special class
  "vz", // ODict `vz` (Japanese): Ichidan verb — zuru verb (alternative form of -jiru verbs)
] as const;

/** Strict grammatical PoS slug; optional on `Lexeme` when the section is non-PoS. */
export type PartOfSpeech = (typeof PART_OF_SPEECH_VALUES)[number];

const PART_OF_SPEECH_SET = new Set<string>(PART_OF_SPEECH_VALUES);

export function isPartOfSpeech(s: string): s is PartOfSpeech {
  return PART_OF_SPEECH_SET.has(s);
}
