/** Maps morph tag shortcodes → English words for human-readable labels. */
const TAG_LABEL_MAP: Record<string, string> = {
    "1": "1st pers.",
    "2": "2nd pers.",
    "3": "3rd pers.",
    s: "singular",
    sg: "singular",
    p: "plural",
    pl: "plural",
    perf: "perfective",
    impf: "imperfective",
    pres: "present",
    past: "past",
    fut: "future",
    aor: "aorist",
    actv: "active",
    pasv: "passive",
    mp: "mediopassive",
    mid: "middle",
    indc: "indicative",
    subj: "subjunctive",
    impr: "imperative",
    opt: "optative",
    cond: "conditional",
    inf: "infinitive",
    ptcp: "participle",
    ger: "gerund",
    m: "masculine",
    f: "feminine",
    n: "neuter",
    c: "common",
    nom: "nominative",
    gen: "genitive",
    acc: "accusative",
    voc: "vocative",
    dat: "dative",
    inst: "instrumental",
    loc: "locative",
    def: "definite",
    indef: "indefinite",
    pos: "positive",
    comp: "comparative",
    sup: "superlative",
};

function tagsToLabel(tags: string[]): string {
    return tags
        .map((t) => TAG_LABEL_MAP[t] || t)
        .filter((t) => t && t.length > 1) // skip single char tags that didn't map
        .join(" ");
}

/** Human-readable kind from the form-of template name when tags alone are empty. */
function defaultFormOfKindLabel(templateName: string): string {
    const key = templateName.trim().toLowerCase();
    const FORM_OF_KIND_LABELS: Record<string, string> = {
        "inflection of": "Inflection",
        "infl of": "Inflection",
        "plural of": "Plural",
        "noun form of": "Noun form",
        "verb form of": "Verb form",
        "adj form of": "Adjective form",
        "participle of": "Participle",
        "past tense of": "Past tense",
        "past participle of": "Past participle",
        "present participle of": "Present participle",
        "gerund of": "Gerund",
        "command of": "Command",
        "imperative of": "Imperative",
        "alternative form of": "Alternative form",
        "alt form": "Alternative form",
        "alt form of": "Alternative form",
        "altform": "Alternative form",
        "form of": "Alternative form",
        "altcase": "Alternative case form",
        "alt case": "Alternative case form",
        "alternative case form of": "Alternative case form",
        "altsp": "Alternative spelling",
        "misspelling of": "Misspelling",
        "abbreviation of": "Abbreviation",
        "short for": "Short for",
        "clipping of": "Clipping",
        "diminutive of": "Diminutive",
        "augmentative of": "Augmentative",
    };
    if (FORM_OF_KIND_LABELS[key]) return FORM_OF_KIND_LABELS[key];
    if (/^[a-z]{2,3}-verb\s+form\s+of$/i.test(key)) return "Verb form";
    if (/^[a-z]{2,3}-noun\s+form\s+of$/i.test(key)) return "Noun form";
    if (/^[a-z]{2,3}-adj\s+form\s+of$/i.test(key)) return "Adjective form";
    const stripped = key.replace(/\s+of$/i, "").trim();
    if (!stripped) return "Form";
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** Display label: template kind + optional morphological tag phrase from positional args. */
export function buildFormOfDisplayLabel(templateName: string, tags: string[]): string {
    const morph = tagsToLabel(tags);
    const kind = defaultFormOfKindLabel(templateName);
    if (morph) return `${kind} (${morph})`;
    return kind;
}
