export const INFLECTION_TEMPLATES = new Set([
    "infl of",
    "inflection of",
    "plural of",
    "noun form of",
    "verb form of",
    "adj form of",
    "participle of",
    "past tense of",
    "past participle of",
    "present participle of",
    "gerund of",
    "command of",
    "imperative of",
]);

export const VARIANT_TEMPLATES = new Set([
    "alternative form of",
    "alt form",
    "alt form of",
    "form of",
    "misspelling of",
    "abbreviation of",
    "short for",
    "clipping of",
    "diminutive of",
    "augmentative of",
]);

export const FORM_OF_TEMPLATES = new Set([...INFLECTION_TEMPLATES, ...VARIANT_TEMPLATES]);

/**
 * e.g. {{es-verb form of|sensar}} — lemma is |1= only; language is implied by the template name.
 * Matches en.wiktionary {{ll-verb form of}}, {{ll-noun form of}}, {{ll-adj form of}}.
 */
export function isPerLangFormOfTemplate(name: string): boolean {
    return /^[a-z]{2,3}-(?:verb|noun|adj)\s+form\s+of$/i.test(name.trim());
}

/** Category:Form-of templates that do not end with " … of" (normalized, lowercased). */
const FORM_OF_EXTRA_NAMES = new Set<string>(["rfform", "iupac-1", "iupac-2", "iupac-3"]);

/**
 * True for en.wiktionary lemma-pointer "form of" templates: {@link FORM_OF_TEMPLATES},
 * {@link isPerLangFormOfTemplate}, names ending with ` … of` (see Category:Form-of templates on en.wiktionary),
 * and {@link FORM_OF_EXTRA_NAMES}. Excludes `only used in` (different semantics; decoded separately).
 */
export function isFormOfTemplateName(name: string): boolean {
    const raw = name.trim();
    if (!raw) return false;
    if (isPerLangFormOfTemplate(raw)) return true;
    const n = raw.replace(/_/g, " ").trim().toLowerCase();
    if (FORM_OF_TEMPLATES.has(n)) return true;
    if (n === "only used in") return false;
    if (FORM_OF_EXTRA_NAMES.has(n)) return true;
    return /\s+of$/i.test(n);
}

/**
 * Substrings (longest match wins) — if the normalized template name includes one, lexeme type is
 * `FORM_OF` (spelling/lexical variant) rather than `INFLECTED_FORM`. Keep participle/tense templates out of this list.
 */
const VARIANT_FORM_OF_SUBSTRINGS: string[] = [
    "assimilated harmonic variant",
    "honorific alternative case form",
    "mixed mutation after",
    "pronunciation spelling",
    "pronunciation variant",
    "syllabic abbreviation",
    "filter-avoidance spelling",
    "scribal abbreviation",
    "word-final anusvara",
    "hiatus-filler form",
    "pseudo-acronym",
    "nomen sacrum",
    "mixed mutation",
    "aspirate mutation",
    "soft mutation",
    "hard mutation",
    "nasal mutation",
    "eye dialect",
    "clipped compound",
    "minced oath",
    "spoonerism",
    "romanization",
    "arabicization",
    "sumerogram",
    "akkadogram",
    "deliberate misspelling",
    "obsolete typography",
    "alternative typography",
    "alternative spelling",
    "alternative case form",
    "alternative reconstruction",
    "archaic spelling",
    "dated spelling",
    "medieval spelling",
    "runic spelling",
    "nonstandard spelling",
    "informal spelling",
    "rare spelling",
    "uncommon spelling",
    "superseded spelling",
    "obsolete spelling",
    "censored spelling",
    "standard spelling",
    "nuqtale",
    "unhamzated",
    "obsolete",
    "archaic",
    "nonstandard",
    "informal",
    "superseded",
    "uncommon",
    "abbreviation",
    "acronym",
    "initialism",
    "misspelling",
    "typography",
    "spelling",
    "synonym",
    "eggcorn",
    "ellipsis",
    "syncopic",
    "apocopic",
    "elongated",
    "geminated",
    "haplological",
    "apheretic",
    "paragogic",
    "prothetic",
    "t-prothesis",
    "h-prothesis",
    "eclipsis",
    "lenition",
    "mutation",
    "broad form",
    "slender form",
    "harmonic variant",
    "topicalized",
    "misconstruction",
    "contraction",
    "endearing",
    "literary form",
    "standard form",
    "dated",
    "rare",
    "censored",
    "deliberate",
    "euphemistic",
    "medieval",
    "runic",
    "scribal",
    "pronunciation",
    "alternative",
    "men's speech",
].sort((a, b) => b.length - a.length);

/** True if this form-of template should yield lexeme type FORM_OF (variant) vs INFLECTED_FORM. */
export function isVariantFormOfTemplateName(name: string): boolean {
    const n = name.replace(/_/g, " ").trim().toLowerCase();
    if (VARIANT_TEMPLATES.has(n)) return true;
    if (/\b(female|male|neuter) equivalent\b/i.test(n)) return true;
    if (VARIANT_FORM_OF_SUBSTRINGS.some((frag) => n.includes(frag))) return true;
    return false;
}
