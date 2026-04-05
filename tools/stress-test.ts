#!/usr/bin/env tsx
/**
 * Stress-test harness for wiktionary-sdk.
 * Exercises the full API surface across diverse queries and validates outputs.
 * Run: npx tsx tools/stress-test.ts
 */

import { wiktionary } from "../src/index";
import * as SDK from "../src/index";
import type { FetchResult, Lexeme, LexemeResult, RichEntry } from "../src/model";
import { writeFileSync } from "fs";

// ─── Test Query Matrix ───────────────────────────────────────────────────────
interface TestQuery {
    term: string;
    lang: string;
    description: string;
    expectedPos?: string;
    expectedType?: string;
}

const QUERIES: TestQuery[] = [
    // English: broad PoS coverage + entities likely to enrich
    { term: "water", lang: "en", description: "English noun/verb, rich multi-etymology", expectedType: "LEXEME" },
    { term: "run", lang: "en", description: "English verb/noun/adjective polysemy", expectedPos: "verb", expectedType: "LEXEME" },
    { term: "beautiful", lang: "en", description: "English adjective", expectedPos: "adjective", expectedType: "LEXEME" },
    { term: "quickly", lang: "en", description: "English adverb", expectedPos: "adverb", expectedType: "LEXEME" },
    { term: "he", lang: "en", description: "English pronoun", expectedPos: "pronoun", expectedType: "LEXEME" },
    { term: "the", lang: "en", description: "English article/determiner", expectedType: "LEXEME" },
    { term: "and", lang: "en", description: "English conjunction", expectedPos: "conjunction", expectedType: "LEXEME" },
    { term: "under", lang: "en", description: "English preposition/adverb", expectedType: "LEXEME" },
    { term: "oh", lang: "en", description: "English interjection", expectedPos: "interjection", expectedType: "LEXEME" },
    { term: "seven", lang: "en", description: "English numeral", expectedType: "LEXEME" },
    { term: "ad hoc", lang: "en", description: "Multi-word expression", expectedType: "LEXEME" },
    { term: "New York", lang: "en", description: "Proper noun likely with Wikidata links", expectedType: "LEXEME" },
    { term: "Socrates", lang: "en", description: "Proper noun likely with QID/media", expectedType: "LEXEME" },
    { term: "Earth", lang: "en", description: "Proper noun with likely QID/image", expectedType: "LEXEME" },
    { term: "cat", lang: "en", description: "High-coverage common noun", expectedPos: "noun", expectedType: "LEXEME" },

    // Greek
    { term: "γράφω", lang: "el", description: "Greek verb", expectedPos: "verb", expectedType: "LEXEME" },
    { term: "έγραψα", lang: "el", description: "Greek inflected form", expectedType: "INFLECTED_FORM" },
    { term: "γρήγορα", lang: "el", description: "Greek adverb/non-lemma overlap", expectedType: "LEXEME" },
    { term: "και", lang: "el", description: "Greek conjunction", expectedPos: "conjunction", expectedType: "LEXEME" },
    { term: "εγώ", lang: "el", description: "Greek pronoun", expectedPos: "pronoun", expectedType: "LEXEME" },
    { term: "Αθήνα", lang: "el", description: "Greek proper noun (entity)", expectedType: "LEXEME" },

    // Romance + Germanic + Slavic + Semitic + East Asian
    { term: "écrire", lang: "fr", description: "French verb", expectedPos: "verb", expectedType: "LEXEME" },
    { term: "bonjour", lang: "fr", description: "French interjection/noun", expectedType: "LEXEME" },
    { term: "Haus", lang: "de", description: "German noun", expectedPos: "noun", expectedType: "LEXEME" },
    { term: "und", lang: "de", description: "German conjunction", expectedPos: "conjunction", expectedType: "LEXEME" },
    { term: "casa", lang: "es", description: "Spanish noun", expectedPos: "noun", expectedType: "LEXEME" },
    { term: "rápidamente", lang: "es", description: "Spanish adverb", expectedPos: "adverb", expectedType: "LEXEME" },
    { term: "ciao", lang: "it", description: "Italian interjection", expectedPos: "interjection", expectedType: "LEXEME" },
    { term: "aqua", lang: "la", description: "Latin noun", expectedPos: "noun", expectedType: "LEXEME" },
    { term: "et", lang: "la", description: "Latin conjunction", expectedPos: "conjunction", expectedType: "LEXEME" },
    { term: "дом", lang: "ru", description: "Russian noun", expectedPos: "noun", expectedType: "LEXEME" },
    { term: "и", lang: "ru", description: "Russian conjunction", expectedPos: "conjunction", expectedType: "LEXEME" },
    { term: "كتاب", lang: "ar", description: "Arabic noun", expectedPos: "noun", expectedType: "LEXEME" },
    { term: "و", lang: "ar", description: "Arabic conjunction", expectedPos: "conjunction", expectedType: "LEXEME" },
    { term: "食べる", lang: "ja", description: "Japanese verb", expectedPos: "verb", expectedType: "LEXEME" },
    { term: "そして", lang: "ja", description: "Japanese conjunction", expectedPos: "conjunction", expectedType: "LEXEME" },

    // Auto language expansion / maximal output variability
    { term: "set", lang: "Auto", description: "High-polysemy, huge multi-PoS coverage", expectedType: "LEXEME" },
    { term: "bank", lang: "Auto", description: "Semantic ambiguity noun/verb", expectedType: "LEXEME" },
    { term: "light", lang: "Auto", description: "Noun/verb/adjective/adverb richness", expectedType: "LEXEME" },
    { term: "state of the art", lang: "Auto", description: "multi-word expression", expectedType: "LEXEME" },

    // Negative control
    { term: "xyzzyplugh", lang: "en", description: "Non-existent term", expectedType: undefined },
];

// ─── Bug Collector ───────────────────────────────────────────────────────────
interface Bug {
    severity: "error" | "warning" | "info";
    query: string;
    function: string;
    field?: string;
    message: string;
    actual?: any;
    expected?: any;
}

const bugs: Bug[] = [];

function reportBug(bug: Bug) {
    bugs.push(bug);
    const icon = bug.severity === "error" ? "🔴" : bug.severity === "warning" ? "🟡" : "🔵";
    console.error(`  ${icon} [${bug.function}] ${bug.message}`);
}

// ─── Validators ──────────────────────────────────────────────────────────────

function validateFetchResult(result: FetchResult, q: TestQuery) {
    const fn = "wiktionary()";

    // schema_version present
    if (!result.schema_version) {
        reportBug({ severity: "error", query: q.term, function: fn, field: "schema_version", message: "Missing schema_version", actual: result.schema_version });
    }

    // For non-existent terms, lexemes should be empty
    if (q.term === "xyzzyplugh") {
        if (result.lexemes.length > 0) {
            reportBug({ severity: "error", query: q.term, function: fn, message: `Expected no lexemes for nonexistent term, got ${result.lexemes.length}` });
        }
        return;
    }

    // At least one lexeme expected
    if (result.lexemes.length === 0) {
        reportBug({ severity: "error", query: q.term, function: fn, message: "No lexemes returned for existing term", actual: result.notes });
        return;
    }

    for (const lex of result.lexemes) {
        validateLexeme(lex, q);
    }

    // metadata presence
    if (!result.metadata) {
        reportBug({ severity: "warning", query: q.term, function: fn, field: "metadata", message: "Missing top-level metadata object" });
    }
}

function validateLexeme(lex: Lexeme, q: TestQuery) {
    const fn = `wiktionary() → lexeme[${lex.id}]`;

    // Required fields
    if (!lex.id) reportBug({ severity: "error", query: q.term, function: fn, field: "id", message: "Missing lexeme id" });
    if (!lex.language) reportBug({ severity: "error", query: q.term, function: fn, field: "language", message: "Missing language" });
    if (!lex.type) reportBug({ severity: "error", query: q.term, function: fn, field: "type", message: "Missing type" });
    if (!lex.form) reportBug({ severity: "error", query: q.term, function: fn, field: "form", message: "Missing form" });
    if (lex.etymology_index === undefined || lex.etymology_index === null) {
        reportBug({ severity: "warning", query: q.term, function: fn, field: "etymology_index", message: "Missing etymology_index" });
    }
    if (!lex.part_of_speech_heading) {
        reportBug({ severity: "warning", query: q.term, function: fn, field: "part_of_speech_heading", message: "Missing part_of_speech_heading", actual: lex.part_of_speech_heading });
    }

    // Type validity
    if (lex.type && !["LEXEME", "INFLECTED_FORM", "FORM_OF"].includes(lex.type)) {
        reportBug({ severity: "error", query: q.term, function: fn, field: "type", message: `Invalid type: ${lex.type}`, actual: lex.type, expected: "LEXEME|INFLECTED_FORM|FORM_OF" });
    }

    // INFLECTED_FORM should have form_of
    if (lex.type === "INFLECTED_FORM") {
        if (!lex.form_of) {
            reportBug({ severity: "error", query: q.term, function: fn, field: "form_of", message: "INFLECTED_FORM missing form_of" });
        } else {
            if (!lex.form_of.lemma && lex.form_of.lemma !== null) {
                reportBug({ severity: "warning", query: q.term, function: fn, field: "form_of.lemma", message: "INFLECTED_FORM has form_of but lemma is missing/undefined", actual: lex.form_of.lemma });
            }
        }
    }
    
    // FORM_OF should have form_of
    if (lex.type === "FORM_OF") {
        if (!lex.form_of) {
            reportBug({ severity: "warning", query: q.term, function: fn, field: "form_of", message: "FORM_OF missing form_of structure" });
        }
    }

    // LEXEME should typically have senses
    if (lex.type === "LEXEME" && (!lex.senses || lex.senses.length === 0)) {
        const heading = (lex.part_of_speech_heading || "").toLowerCase();
        const metaHeadings = ["pronunciation", "etymology", "references", "anagrams", "alternative forms"];
        if (!metaHeadings.includes(heading)) {
            reportBug({ severity: "warning", query: q.term, function: fn, field: "senses", message: `LEXEME has no senses (heading: ${lex.part_of_speech_heading})` });
        }
    }

    // Senses validation
    if (lex.senses) {
        for (let i = 0; i < lex.senses.length; i++) {
            const sense = lex.senses[i];
            if (!sense.id) {
                reportBug({ severity: "warning", query: q.term, function: fn, field: `senses[${i}].id`, message: `Sense at index ${i} has no id`, actual: sense });
            }
            if (!sense.gloss && sense.gloss !== "") {
                reportBug({ severity: "warning", query: q.term, function: fn, field: `senses[${i}].gloss`, message: `Sense ${sense.id || i} has no gloss` });
            }
        }
    }

    // source.wiktionary required
    if (!lex.source?.wiktionary) {
        reportBug({ severity: "error", query: q.term, function: fn, field: "source.wiktionary", message: "Missing source.wiktionary" });
    } else {
        if (!lex.source.wiktionary.site) reportBug({ severity: "error", query: q.term, function: fn, field: "source.wiktionary.site", message: "Missing site" });
        if (!lex.source.wiktionary.title) reportBug({ severity: "error", query: q.term, function: fn, field: "source.wiktionary.title", message: "Missing title" });
        if (!lex.source.wiktionary.language_section) reportBug({ severity: "error", query: q.term, function: fn, field: "source.wiktionary.language_section", message: "Missing language_section" });
    }

    // part_of_speech should be lowercase normalized (when set)
    if (lex.part_of_speech) {
        if (lex.part_of_speech !== lex.part_of_speech.toLowerCase()) {
            reportBug({ severity: "warning", query: q.term, function: fn, field: "part_of_speech", message: `part_of_speech not lowercase: "${lex.part_of_speech}"`, actual: lex.part_of_speech });
        }
    }

    // templates should be an object
    if (lex.templates === undefined || lex.templates === null) {
        reportBug({ severity: "warning", query: q.term, function: fn, field: "templates", message: "Missing templates field" });
    }

    // Etymology structure validation
    if (lex.etymology) {
        if (lex.etymology.chain) {
            for (const link of lex.etymology.chain) {
                if (!link.source_lang) {
                    reportBug({ severity: "warning", query: q.term, function: fn, field: "etymology.chain[].source_lang", message: "Etymology chain link missing source_lang", actual: link });
                }
                if (!link.raw) {
                    reportBug({ severity: "warning", query: q.term, function: fn, field: "etymology.chain[].raw", message: "Etymology chain link missing raw", actual: link });
                }
            }
        }
    }

    // Pronunciation structure
    if (lex.pronunciation) {
        if (lex.pronunciation.IPA && !lex.pronunciation.IPA.startsWith("/") && !lex.pronunciation.IPA.startsWith("[")) {
            reportBug({ severity: "warning", query: q.term, function: fn, field: "pronunciation.IPA", message: `IPA doesn't start with / or [: "${lex.pronunciation.IPA}"`, actual: lex.pronunciation.IPA });
        }
    }

    // translations structure
    if (lex.translations) {
        for (const [lang, items] of Object.entries(lex.translations)) {
            if (!Array.isArray(items)) {
                reportBug({ severity: "error", query: q.term, function: fn, field: `translations.${lang}`, message: `Translations for ${lang} is not an array`, actual: typeof items });
            }
        }
    }
}

// ─── Convenience Function Validators ─────────────────────────────────────────

function validateLexemeResultArray(results: any, q: TestQuery, funcName: string) {
    if (!Array.isArray(results)) {
        reportBug({ severity: "error", query: q.term, function: funcName, message: `Expected array, got ${typeof results}`, actual: typeof results });
        return;
    }
    for (const r of results) {
        if (!r.lexeme_id) {
            reportBug({ severity: "warning", query: q.term, function: funcName, field: "lexeme_id", message: "Missing lexeme_id in result row", actual: r });
        }
        if (r.value === undefined) {
            reportBug({ severity: "warning", query: q.term, function: funcName, field: "value", message: "value is undefined (should be null or meaningful)", actual: r });
        }
    }
    // Check for grouped properties
    if ("order" in results && "lexemes" in results) {
        const grouped = results as any;
        if (!Array.isArray(grouped.order)) {
            reportBug({ severity: "error", query: q.term, function: funcName, field: "order", message: "GroupedLexemeResults.order is not an array" });
        }
        if (typeof grouped.lexemes !== "object") {
            reportBug({ severity: "error", query: q.term, function: funcName, field: "lexemes", message: "GroupedLexemeResults.lexemes is not an object" });
        }
    }
}

function validateRichEntryResults(results: any, q: TestQuery) {
    const fn = "richEntry()";
    if (!Array.isArray(results)) {
        reportBug({ severity: "error", query: q.term, function: fn, message: `Expected array, got ${typeof results}` });
        return;
    }
    for (const r of results) {
        const entry: RichEntry | null = r.value;
        if (!entry) continue;

        if (!entry.headword) reportBug({ severity: "error", query: q.term, function: fn, field: "headword", message: "RichEntry missing headword" });
        if (!entry.pos) reportBug({ severity: "warning", query: q.term, function: fn, field: "pos", message: "RichEntry missing pos" });
        if (!entry.source) reportBug({ severity: "error", query: q.term, function: fn, field: "source", message: "RichEntry missing source" });

        // type should be set
        if (!entry.type) {
            reportBug({ severity: "warning", query: q.term, function: fn, field: "type", message: "RichEntry missing type discriminator" });
        }

        // relations shape check
        if (entry.relations) {
            const relKeys = Object.keys(entry.relations);
            const expectedRelKeys = ["synonyms", "antonyms", "coordinate_terms", "holonyms", "meronyms", "troponyms"];
            for (const key of relKeys) {
                if (!expectedRelKeys.includes(key) && key !== "hypernyms" && key !== "hyponyms") {
                    reportBug({ severity: "info", query: q.term, function: fn, field: `relations.${key}`, message: `Unexpected relation key: ${key}` });
                }
            }
        }

        // Check that richEntry preserves hypernyms/hyponyms (they are in SemanticRelations but richEntry maps to relations)
        // richEntry explicitly maps synonyms, antonyms, coordinate_terms, holonyms, meronyms, troponyms
        // but NOT hypernyms and hyponyms - potential bug!
        if (entry.relations && !("hypernyms" in entry.relations) && !("hyponyms" in entry.relations)) {
            // This is expected based on code, but is it intentional?
        }
    }
}

// ─── Test Runners ────────────────────────────────────────────────────────────

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function testCoreWiktionary(q: TestQuery): Promise<FetchResult | null> {
    try {
        const result = await wiktionary({ query: q.term, lang: q.lang as any, enrich: true, sort: "source" });
        validateFetchResult(result, q);
        return result;
    } catch (e: any) {
        reportBug({ severity: "error", query: q.term, function: "wiktionary()", message: `Exception: ${e.message}` });
        return null;
    }
}

async function testConvenienceFunctions(q: TestQuery): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const lang = q.lang as any;

    const safeCall = async (name: string, fn: () => Promise<any>) => {
        try {
            const r = await fn();
            results[name] = r;
            return r;
        } catch (e: any) {
            reportBug({ severity: "error", query: q.term, function: name, message: `Exception: ${e.message}` });
            results[name] = { __error: e.message };
            return null;
        }
    };

    // Scalar utility
    await safeCall("lemma", () => SDK.lemma(q.term, lang));

    // Part of speech
    const posResult = await safeCall("partOfSpeech", () => SDK.partOfSpeech(q.term, lang));
    if (posResult) validateLexemeResultArray(posResult, q, "partOfSpeech()");

    // IPA
    const ipaResult = await safeCall("ipa", () => SDK.ipa(q.term, lang));
    if (ipaResult) validateLexemeResultArray(ipaResult, q, "ipa()");

    // Pronounce (should prefer audio URL over IPA)
    const pronounceResult = await safeCall("pronounce", () => SDK.pronounce(q.term, lang));
    if (pronounceResult) validateLexemeResultArray(pronounceResult, q, "pronounce()");

    // Hyphenate
    const hyphenResult = await safeCall("hyphenate", () => SDK.hyphenate(q.term, lang));
    if (hyphenResult) validateLexemeResultArray(hyphenResult, q, "hyphenate()");

    // Hyphenate with options
    await safeCall("hyphenate_string", () => SDK.hyphenate(q.term, lang, { format: "string", separator: "·" }));
    await safeCall("hyphenate_array", () => SDK.hyphenate(q.term, lang, { format: "array" }));

    // Syllable count
    const syllResult = await safeCall("syllableCount", () => SDK.syllableCount(q.term, lang));
    if (syllResult) {
        validateLexemeResultArray(syllResult, q, "syllableCount()");
        for (const r of (syllResult as any[])) {
            if (typeof r.value !== "number") {
                reportBug({ severity: "error", query: q.term, function: "syllableCount()", field: "value", message: `Expected number, got ${typeof r.value}`, actual: r.value });
            }
        }
    }

    // Etymology
    const etymResult = await safeCall("etymology", () => SDK.etymology(q.term, lang));
    if (etymResult) {
        validateLexemeResultArray(etymResult, q, "etymology()");
        for (const r of (etymResult as any[])) {
            if (r.value !== null && !Array.isArray(r.value)) {
                reportBug({ severity: "error", query: q.term, function: "etymology()", field: "value", message: `Expected array or null, got ${typeof r.value}`, actual: r.value });
            }
            if (Array.isArray(r.value)) {
                for (const step of r.value) {
                    if (!step.lang || !step.form) {
                        reportBug({ severity: "warning", query: q.term, function: "etymology()", message: `EtymologyStep missing lang or form`, actual: step });
                    }
                }
            }
        }
    }

    // Etymology sub-functions
    await safeCall("etymologyChain", () => SDK.etymologyChain(q.term, lang));
    await safeCall("etymologyCognates", () => SDK.etymologyCognates(q.term, lang));
    await safeCall("etymologyText", () => SDK.etymologyText(q.term, lang));

    // Synonyms
    await safeCall("synonyms", () => SDK.synonyms(q.term, lang));

    // Antonyms
    await safeCall("antonyms", () => SDK.antonyms(q.term, lang));

    // Hypernyms
    await safeCall("hypernyms", () => SDK.hypernyms(q.term, lang));

    // Hyponyms
    await safeCall("hyponyms", () => SDK.hyponyms(q.term, lang));

    // Translate to English
    await safeCall("translate_en", () => SDK.translate(q.term, lang, "en"));

    // Translate with senses mode
    await safeCall("translate_senses", () => SDK.translate(q.term, lang, "en", { mode: "senses" }));

    // Morphology
    const morphResult = await safeCall("morphology", () => SDK.morphology(q.term, lang));
    if (morphResult) validateLexemeResultArray(morphResult, q, "morphology()");

    // Gender
    await safeCall("gender", () => SDK.gender(q.term, lang));

    // Transitivity (for verbs)
    if (q.expectedPos === "verb") {
        await safeCall("transitivity", () => SDK.transitivity(q.term, lang));
        await safeCall("principalParts", () => SDK.principalParts(q.term, lang));
    }

    // Stem
    await safeCall("stem", () => SDK.stem(q.term, lang));
    await safeCall("stemByLexeme", () => SDK.stemByLexeme(q.term, lang));

    // Rich entry
    const richResult = await safeCall("richEntry", () => SDK.richEntry(q.term, lang));
    if (richResult) validateRichEntryResults(richResult, q);

    // Wikidata
    await safeCall("wikidataQid", () => SDK.wikidataQid(q.term, lang));
    await safeCall("image", () => SDK.image(q.term, lang));
    await safeCall("allImages", () => SDK.allImages(q.term, lang));
    await safeCall("wikipediaLink", () => SDK.wikipediaLink(q.term, lang, "en"));

    // Categories & links
    await safeCall("categories", () => SDK.categories(q.term, lang));
    await safeCall("langlinks", () => SDK.langlinks(q.term, lang));
    await safeCall("externalLinks", () => SDK.externalLinks(q.term, lang));
    await safeCall("internalLinks", () => SDK.internalLinks(q.term, lang));

    // Semantic sections
    await safeCall("derivedTerms", () => SDK.derivedTerms(q.term, lang));
    await safeCall("relatedTerms", () => SDK.relatedTerms(q.term, lang));
    await safeCall("descendants", () => SDK.descendants(q.term, lang));
    await safeCall("seeAlso", () => SDK.seeAlso(q.term, lang));
    await safeCall("anagrams", () => SDK.anagrams(q.term, lang));
    await safeCall("usageNotes", () => SDK.usageNotes(q.term, lang));
    await safeCall("referencesSection", () => SDK.referencesSection(q.term, lang));
    await safeCall("alternativeForms", () => SDK.alternativeForms(q.term, lang));

    // Audio
    await safeCall("audioGallery", () => SDK.audioGallery(q.term, lang));
    await safeCall("rhymes", () => SDK.rhymes(q.term, lang));
    await safeCall("homophones", () => SDK.homophones(q.term, lang));

    // Examples
    await safeCall("exampleDetails", () => SDK.exampleDetails(q.term, lang));
    await safeCall("citations", () => SDK.citations(q.term, lang));

    // Boolean checks
    await safeCall("isCategory_lemmas", () => SDK.isCategory(q.term, "lemmas", lang));
    await safeCall("isInstance_Q5", () => SDK.isInstance(q.term, "Q5", lang));

    // Page metadata
    await safeCall("pageMetadata", () => SDK.pageMetadata(q.term, lang));

    // Inflection table ref
    await safeCall("inflectionTableRef", () => SDK.inflectionTableRef(q.term, lang));

    // Format tests (on richEntry output)
    if (richResult && Array.isArray(richResult) && richResult.length > 0 && richResult[0].value) {
        for (const mode of ["text", "markdown", "html", "ansi"] as const) {
            await safeCall(`format_${mode}`, async () => {
                const output = SDK.format(richResult[0].value, { mode });
                if (!output || output === "[object Object]" || output === "{}") {
                    reportBug({ severity: "warning", query: q.term, function: `format(${mode})`, message: `Format returned unhelpful output: "${output.slice(0, 100)}"` });
                }
                return output.length;
            });
        }
    }

    return results;
}

async function testConjugateDecline(q: TestQuery): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const lang = q.lang as any;

    const safeCall = async (name: string, fn: () => Promise<any>) => {
        try {
            const r = await fn();
            results[name] = r;
            return r;
        } catch (e: any) {
            reportBug({ severity: "error", query: q.term, function: name, message: `Exception: ${e.message}` });
            results[name] = { __error: e.message };
            return null;
        }
    };

    if (q.expectedPos === "verb" && q.lang === "el") {
        await safeCall("conjugate_full", () => SDK.conjugate(q.term, lang));
        await safeCall("conjugate_1sg_present", () => SDK.conjugate(q.term, lang, { person: "1", number: "singular", tense: "present" }));
        await safeCall("conjugate_3pl_past", () => SDK.conjugate(q.term, lang, { person: "3", number: "plural", tense: "past" }));
    }

    if ((q.expectedPos === "noun" || q.expectedPos === "adjective") && q.lang === "el") {
        await safeCall("decline_full", () => SDK.decline(q.term, lang));
        await safeCall("decline_gen_sg", () => SDK.decline(q.term, lang, { case: "genitive", number: "singular" }));
        await safeCall("decline_nom_pl", () => SDK.decline(q.term, lang, { case: "nominative", number: "plural" }));
    }

    return results;
}

// ─── Cross-Validation Checks ─────────────────────────────────────────────────

function crossValidate(coreResult: FetchResult, convResults: Record<string, any>, q: TestQuery) {
    // Check: lemma() for a LEXEME should return the same term
    if (q.expectedType === "LEXEME" && convResults.lemma) {
        const lemmaVal = convResults.lemma;
        if (typeof lemmaVal === "string" && lemmaVal !== q.term) {
            reportBug({ severity: "info", query: q.term, function: "cross-validate:lemma", message: `lemma("${q.term}") returned "${lemmaVal}" instead of self`, actual: lemmaVal });
        }
    }

    // Check: partOfSpeech output should match expected
    if (q.expectedPos && convResults.partOfSpeech && Array.isArray(convResults.partOfSpeech)) {
        const posValues = (convResults.partOfSpeech as LexemeResult<string | null>[])
            .filter(r => r.value)
            .map(r => r.value?.toLowerCase());
        if (posValues.length > 0 && !posValues.some(p => p?.includes(q.expectedPos!))) {
            reportBug({ severity: "warning", query: q.term, function: "cross-validate:partOfSpeech", message: `Expected "${q.expectedPos}" in PoS values, got: [${posValues.join(", ")}]`, actual: posValues, expected: q.expectedPos });
        }
    }

    // Check: gender for non-verb Greek should return something
    if (q.lang === "el" && q.expectedPos === "noun" && convResults.gender && Array.isArray(convResults.gender)) {
        const genders = (convResults.gender as LexemeResult<string | null>[]).filter(r => r.value);
        if (genders.length === 0) {
            reportBug({ severity: "warning", query: q.term, function: "cross-validate:gender", message: "Expected gender for Greek noun, got none" });
        }
    }

    // Check: richEntry hypernyms/hyponyms not in relations
    if (convResults.richEntry && Array.isArray(convResults.richEntry)) {
        for (const row of convResults.richEntry) {
            const entry = row.value as RichEntry;
            if (!entry) continue;
            if (entry.relations && !("hypernyms" in entry.relations) && !("hyponyms" in entry.relations)) {
                // Check if there are hypernyms/hyponyms in the core result
                const coreLex = coreResult.lexemes.find(l => l.type === "LEXEME");
                if (coreLex?.semantic_relations?.hypernyms?.length || coreLex?.semantic_relations?.hyponyms?.length) {
                    reportBug({
                        severity: "error",
                        query: q.term,
                        function: "cross-validate:richEntry.relations",
                        message: "richEntry drops hypernyms/hyponyms from relations - they exist in raw lexeme but are not mapped to RichEntry.relations",
                        actual: Object.keys(entry.relations || {}),
                        expected: "Should include hypernyms and hyponyms"
                    });
                }
            }
        }
    }

    // Check: translate should return arrays of strings
    if (convResults.translate_en && Array.isArray(convResults.translate_en)) {
        for (const r of convResults.translate_en) {
            if (r.value !== undefined && !Array.isArray(r.value)) {
                reportBug({ severity: "error", query: q.term, function: "translate(en)", field: "value", message: `Expected string[], got ${typeof r.value}`, actual: r.value });
            }
        }
    }

    // Check: syllableCount should be consistent with hyphenate
    if (convResults.syllableCount && convResults.hyphenate_array) {
        const syllCounts = (convResults.syllableCount as any[]).filter(r => r.value > 0);
        const hyphenArrays = (convResults.hyphenate_array as any[]).filter(r => Array.isArray(r.value) && r.value.length > 0);
        if (syllCounts.length > 0 && hyphenArrays.length > 0) {
            const count = syllCounts[0].value;
            const arrLen = hyphenArrays[0].value.length;
            if (count !== arrLen) {
                reportBug({ severity: "error", query: q.term, function: "cross-validate:syllableCount", message: `syllableCount=${count} but hyphenate array length=${arrLen}`, actual: count, expected: arrLen });
            }
        }
    }
}

// ─── Main Runner ─────────────────────────────────────────────────────────────

async function main() {
    console.log("╔═══════════════════════════════════════════════════════════════════╗");
    console.log("║  Wiktionary SDK — Comprehensive Stress Test                      ║");
    console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

    const allOutputs: Record<string, any> = {};
    const startTime = Date.now();

    for (let i = 0; i < QUERIES.length; i++) {
        const q = QUERIES[i];
        const qStart = Date.now();
        console.log(`\n[${i + 1}/${QUERIES.length}] "${q.term}" (${q.lang}) — ${q.description}`);
        console.log("─".repeat(60));

        // Core wiktionary()
        const core = await testCoreWiktionary(q);
        allOutputs[`${q.term}__core`] = core ? {
            schema_version: core.schema_version,
            lexeme_count: core.lexemes.length,
            lexeme_ids: core.lexemes.map(l => l.id),
            lexeme_types: core.lexemes.map(l => l.type),
            lexeme_pos: core.lexemes.map(l => l.part_of_speech || l.part_of_speech_heading),
            lexeme_languages: core.lexemes.map(l => l.language),
            notes: core.notes,
            has_metadata: !!core.metadata,
        } : null;

        if (q.term === "xyzzyplugh") {
            console.log("  (non-existent term — skipping convenience functions)");
            await sleep(200);
            continue;
        }

        // Convenience functions
        const convResults = await testConvenienceFunctions(q);
        allOutputs[`${q.term}__convenience`] = summarizeConvenienceResults(convResults);

        // Cross-validate
        if (core) {
            crossValidate(core, convResults, q);
        }

        // Conjugate/decline for Greek
        if (q.lang === "el" && (q.expectedPos === "verb" || q.expectedPos === "noun" || q.expectedPos === "adjective")) {
            const morphResults = await testConjugateDecline(q);
            allOutputs[`${q.term}__morph`] = summarizeConvenienceResults(morphResults);
        }

        const elapsed = Date.now() - qStart;
        console.log(`  ✓ Completed in ${elapsed}ms`);
        await sleep(300);
    }

    // Final report
    console.log("\n\n");
    console.log("╔═══════════════════════════════════════════════════════════════════╗");
    console.log("║  BUG REPORT SUMMARY                                             ║");
    console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

    const errors = bugs.filter(b => b.severity === "error");
    const warnings = bugs.filter(b => b.severity === "warning");
    const infos = bugs.filter(b => b.severity === "info");

    console.log(`Total issues found: ${bugs.length}`);
    console.log(`  🔴 Errors:   ${errors.length}`);
    console.log(`  🟡 Warnings: ${warnings.length}`);
    console.log(`  🔵 Info:     ${infos.length}`);
    console.log();

    // Group by function
    const byFunction = new Map<string, Bug[]>();
    for (const b of bugs) {
        const key = b.function;
        if (!byFunction.has(key)) byFunction.set(key, []);
        byFunction.get(key)!.push(b);
    }

    for (const [func, funcBugs] of byFunction) {
        console.log(`\n── ${func} ──`);
        for (const b of funcBugs) {
            const icon = b.severity === "error" ? "🔴" : b.severity === "warning" ? "🟡" : "🔵";
            console.log(`  ${icon} [${b.query}] ${b.message}`);
            if (b.actual !== undefined) console.log(`     actual: ${JSON.stringify(b.actual)?.slice(0, 200)}`);
            if (b.expected !== undefined) console.log(`     expected: ${JSON.stringify(b.expected)?.slice(0, 200)}`);
        }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\nTotal time: ${(totalTime / 1000).toFixed(1)}s`);

    // Write full report
    const report = {
        timestamp: new Date().toISOString(),
        total_queries: QUERIES.length,
        total_bugs: bugs.length,
        errors: errors.length,
        warnings: warnings.length,
        infos: infos.length,
        bugs,
        outputs: allOutputs,
    };
    writeFileSync("tools/stress-test-report.json", JSON.stringify(report, null, 2), "utf-8");
    console.log("\nFull report written to tools/stress-test-report.json");
}

function summarizeConvenienceResults(results: Record<string, any>): Record<string, any> {
    const summary: Record<string, any> = {};
    for (const [key, value] of Object.entries(results)) {
        if (value?.__error) {
            summary[key] = { error: value.__error };
        } else if (Array.isArray(value)) {
            summary[key] = {
                count: value.length,
                values: value.map((v: any) => ({
                    lexeme_id: v.lexeme_id,
                    value_type: typeof v.value,
                    value_preview: JSON.stringify(v.value)?.slice(0, 200),
                })),
            };
        } else if (typeof value === "string") {
            summary[key] = { type: "string", value: value.slice(0, 200) };
        } else if (typeof value === "number") {
            summary[key] = { type: "number", value };
        } else {
            summary[key] = { type: typeof value, preview: JSON.stringify(value)?.slice(0, 200) };
        }
    }
    return summary;
}

main().catch(console.error);
