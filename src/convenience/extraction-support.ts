import type { Lexeme, SemanticRelations } from "../model";

/** Brand for mapLexemes extractors that attach a support note. */
const EXTRACTION_BRAND = Symbol.for("wiktionarySdk.extractionEnvelope");

export interface ExtractionEnvelope<T> {
    readonly [EXTRACTION_BRAND]: true;
    value: T;
    support_warning?: string;
}

export function withExtractionSupport<T>(value: T, support_warning?: string): T | ExtractionEnvelope<T> {
    if (support_warning === undefined || support_warning === "") return value;
    return { [EXTRACTION_BRAND]: true, value, support_warning };
}

export function unwrapExtraction<T>(out: T | ExtractionEnvelope<T>): { value: T; support_warning?: string } {
    if (
        out !== null &&
        typeof out === "object" &&
        (out as ExtractionEnvelope<T>)[EXTRACTION_BRAND] === true
    ) {
        const e = out as ExtractionEnvelope<T>;
        return { value: e.value, support_warning: e.support_warning };
    }
    return { value: out as T };
}

export function hasRawTemplateInstances(lexeme: Lexeme, name: string): boolean {
    const arr = lexeme.templates?.[name];
    return Array.isArray(arr) && arr.length > 0;
}

export function isVerbLikeLexeme(lexeme: Lexeme): boolean {
    const p = lexeme.part_of_speech ?? "";
    if (p && (p.endsWith("_verb") || /^v\d/.test(p))) return true;
    const h = (lexeme.part_of_speech_heading || "").toLowerCase();
    return /\bverb\b/.test(h);
}

export function isNominalLikeLexeme(lexeme: Lexeme): boolean {
    const p = lexeme.part_of_speech ?? "";
    if (p === "noun" || p === "proper_noun" || p === "adjective" || p === "numeral" || p === "participle")
        return true;
    if (p.startsWith("adj_") || p === "name") return true;
    const h = (lexeme.part_of_speech_heading || "").toLowerCase();
    return /\bnoun\b/.test(h) || /\badj(?:ective)?\b/.test(h) || /\bnumeral\b/.test(h);
}

function templatesAllNames(lexeme: Lexeme): string[] {
    return (lexeme.templates_all || []).map((t: { name?: string }) => String(t.name || ""));
}

export function hasElConjugationTemplate(lexeme: Lexeme): boolean {
    return templatesAllNames(lexeme).some(
        (n) => n.startsWith("el-conjug-") || n.startsWith("el-verb-") || n.startsWith("el-conj-"),
    );
}

export function hasElDeclensionTemplate(lexeme: Lexeme): boolean {
    return templatesAllNames(lexeme).some(
        (n) =>
            n.startsWith("el-noun-") ||
            n.startsWith("el-adj-") ||
            n.startsWith("el-nM-") ||
            n.startsWith("el-nF-") ||
            n.startsWith("el-nN-") ||
            n.startsWith("el-decl-") ||
            n.startsWith("el-proper-noun-"),
    );
}

export function hasGrcConjTemplate(lexeme: Lexeme): boolean {
    return templatesAllNames(lexeme).some((n) => n === "grc-conj" || n.startsWith("grc-conj"));
}

export function hasGrcDeclTemplate(lexeme: Lexeme): boolean {
    return templatesAllNames(lexeme).some((n) => n === "grc-decl");
}

export function warnInflectionTableRef(lexeme: Lexeme, ref: unknown): string | undefined {
    if (ref !== null && ref !== undefined) return undefined;
    if (
        hasElConjugationTemplate(lexeme) ||
        hasElDeclensionTemplate(lexeme) ||
        hasGrcConjTemplate(lexeme) ||
        hasGrcDeclTemplate(lexeme)
    ) {
        return "Paradigm templates are present on this lexeme but inflection_table_ref was not populated (headword / table decoder gap).";
    }
    return undefined;
}

function conjugationValueEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value as object).length === 0;
    return false;
}

export function warnConjugate(lexeme: Lexeme, value: unknown): string | undefined {
    if (!isVerbLikeLexeme(lexeme)) return undefined;
    if (!conjugationValueEmpty(value)) return undefined;
    const hasEl = hasElConjugationTemplate(lexeme);
    if (hasEl) {
        return "A supported el-* conjugation template is present but conjugate() returned no forms (MediaWiki parse failure, unsupported table HTML, or criteria that match no cell).";
    }
    if (hasGrcConjTemplate(lexeme)) {
        return "conjugate() only expands Modern Greek el-conjug-*, el-verb-*, and el-conj-* templates via en.wiktionary; grc-conj paradigms are not supported here yet.";
    }
    if (templatesAllNames(lexeme).length > 0) {
        return "No supported Modern Greek conjugation template (el-conjug-*, el-verb-*, el-conj-*) on this lexeme; conjugate() has nothing to expand.";
    }
    return undefined;
}

export function warnDecline(lexeme: Lexeme, value: unknown): string | undefined {
    if (!isNominalLikeLexeme(lexeme)) return undefined;
    if (!conjugationValueEmpty(value)) return undefined;
    const hasEl = hasElDeclensionTemplate(lexeme);
    if (hasEl) {
        return "A supported el-* declension template is present but decline() returned no forms (parse failure, unsupported table HTML, or criteria mismatch).";
    }
    if (hasGrcDeclTemplate(lexeme)) {
        return "decline() only expands supported el-* declension templates; grc-decl is not handled by this path yet.";
    }
    if (templatesAllNames(lexeme).length > 0) {
        return "No supported el-* declension template on this lexeme; decline() has nothing to expand.";
    }
    return undefined;
}

export function warnPrincipalParts(lexeme: Lexeme, value: unknown): string | undefined {
    if (!isVerbLikeLexeme(lexeme)) return undefined;
    if (value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0)
        return undefined;
    if (hasElConjugationTemplate(lexeme) || hasGrcConjTemplate(lexeme)) {
        return "principalParts() reads decoded headword slots from el-conjugation decoders; grc-conj or partial decoder output may leave principal parts empty even when paradigms exist.";
    }
    return undefined;
}

const RELATION_TEMPLATE_NAMES: Record<keyof Pick<SemanticRelations, "synonyms" | "antonyms" | "hypernyms" | "hyponyms">, string> = {
    synonyms: "syn",
    antonyms: "ant",
    hypernyms: "hyper",
    hyponyms: "hypo",
};

export function warnSemanticRelationList<K extends keyof typeof RELATION_TEMPLATE_NAMES>(
    lexeme: Lexeme,
    field: K,
    terms: string[],
): string | undefined {
    if (terms.length > 0) return undefined;
    const tpl = RELATION_TEMPLATE_NAMES[field];
    if (hasRawTemplateInstances(lexeme, tpl)) {
        return `${field}: raw {{${tpl}|…}} calls exist on this lexeme but produced no decoded relations (unsupported parameters or decoder gap).`;
    }
    return undefined;
}

export function warnIpa(lexeme: Lexeme, ipa: string | null): string | undefined {
    if (ipa) return undefined;
    if (hasRawTemplateInstances(lexeme, "IPA")) {
        return "IPA template calls exist but no IPA string was decoded (unsupported layout or parameters).";
    }
    return undefined;
}

export function warnPronounce(lexeme: Lexeme, v: string | null): string | undefined {
    if (v) return undefined;
    const hasAudio = hasRawTemplateInstances(lexeme, "audio") || hasRawTemplateInstances(lexeme, "audio-pron");
    if (hasAudio || hasRawTemplateInstances(lexeme, "IPA")) {
        return "Pronunciation templates exist but pronounce() found no audio URL and no IPA (decoder or parameter gap).";
    }
    return undefined;
}

export function warnHyphenation(lexeme: Lexeme, syllables: string[] | null | undefined): string | undefined {
    if (syllables && syllables.length > 0) return undefined;
    if (hasRawTemplateInstances(lexeme, "hyphenation")) {
        return "hyphenation template calls exist but no syllable array was decoded (see hyphenation decoder rules).";
    }
    return undefined;
}

export function warnRhymes(lexeme: Lexeme, list: string[]): string | undefined {
    if (list.length > 0) return undefined;
    if (hasRawTemplateInstances(lexeme, "rhymes")) {
        return "{{rhymes}} is present but no rhyme list was extracted (empty parameters or decoder gap).";
    }
    return undefined;
}

export function warnHomophones(lexeme: Lexeme, list: string[]): string | undefined {
    if (list.length > 0) return undefined;
    if (hasRawTemplateInstances(lexeme, "homophones")) {
        return "{{homophones}} is present but no homophone list was extracted (empty parameters or decoder gap).";
    }
    return undefined;
}

export function warnTranslateGloss(lexeme: Lexeme, targetLang: string, terms: string[]): string | undefined {
    if (terms.length > 0) return undefined;
    const tr = lexeme.translations;
    if (tr && Object.keys(tr).length > 0 && !tr[targetLang]) {
        return `No ===Translations=== entries for target language code "${targetLang}" on this lexeme (other languages may be present).`;
    }
    if (tr && Object.keys(tr).length > 0 && tr[targetLang]?.length === 0) {
        return `Translations table lists "${targetLang}" but with no decoded terms (unsupported row markup).`;
    }
    return "No translations were decoded for this lexeme (missing ===Translations=== section or unsupported wikitext).";
}

export function warnEtymologySteps(lexeme: Lexeme, steps: unknown): string | undefined {
    if (steps !== null && Array.isArray(steps) && steps.length > 0) return undefined;
    const et = hasRawTemplateInstances(lexeme, "inh") || hasRawTemplateInstances(lexeme, "der") || hasRawTemplateInstances(lexeme, "bor") || hasRawTemplateInstances(lexeme, "cog");
    if (et) {
        return "Etymology templates (e.g. {{inh}}, {{der}}) appear in wikitext but no chain was decoded into structured steps.";
    }
    return undefined;
}

export function warnGender(lexeme: Lexeme, g: string | null): string | undefined {
    if (g) return undefined;
    if (!isNominalLikeLexeme(lexeme)) return undefined;
    if (
        hasRawTemplateInstances(lexeme, "el-noun") ||
        templatesAllNames(lexeme).some((n) => n.startsWith("el-n") || n === "grc-noun" || n.startsWith("grc-noun"))
    ) {
        return "Gender is absent in output though a headword template is present; the decoder may not expose gender for this template family.";
    }
    return undefined;
}

export function warnTransitivity(lexeme: Lexeme, t: string | null): string | undefined {
    if (t) return undefined;
    if (!isVerbLikeLexeme(lexeme)) return undefined;
    if (hasRawTemplateInstances(lexeme, "el-verb") || hasElConjugationTemplate(lexeme)) {
        return "Transitivity was not decoded for this verb lexeme (template may omit it or use an unsupported layout).";
    }
    return undefined;
}

export function warnMorphologyTraits(lexeme: Lexeme, traits: Record<string, unknown>): string | undefined {
    if (Object.keys(traits).length > 0) return undefined;
    if (lexeme.type === "INFLECTED_FORM" || lexeme.type === "FORM_OF") {
        return "morphology() returned no traits: form-of rows often need lemma resolution or templates this extractor does not map to GrammarTraits yet.";
    }
    if (isVerbLikeLexeme(lexeme) || isNominalLikeLexeme(lexeme)) {
        if (templatesAllNames(lexeme).length > 0) {
            return "morphology() returned no traits despite headword templates; inflection parameters may be unsupported for this lexeme.";
        }
    }
    return undefined;
}

export function warnSensesList(lexeme: Lexeme, glosses: string[], label: string): string | undefined {
    if (glosses.length > 0) return undefined;
    if (lexeme.senses && lexeme.senses.length > 0) {
        return `${label}: senses exist but no gloss strings were produced (unsupported sense line shape).`;
    }
    return `${label}: no senses were decoded for this lexeme.`;
}

export function warnLexemeArrayField(
    lexeme: Lexeme,
    items: unknown[],
    options: { label: string; templateNames?: string[] },
): string | undefined {
    if (items.length > 0) return undefined;
    const names = options.templateNames ?? [];
    const hit = names.some((n) => hasRawTemplateInstances(lexeme, n));
    if (hit) {
        return `${options.label}: matching wikitext templates exist but nothing was extracted (decoder or section gap).`;
    }
    return undefined;
}
