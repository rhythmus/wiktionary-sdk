import { describe, it, expect } from "vitest";
import { registry } from "../src/registry";

/**
 * Registration order is normative for merge semantics and debug tooling.
 * Update this list when adding a decoder (see docs/registry-inventory.md).
 */
const EXPECTED_DECODER_IDS: string[] = [
    "store-raw-templates",
    "ipa",
    "hyphenation",
    "alternative-forms-section",
    "el-adj-head",
    "el-noun-head",
    "el-verb-head",
    "el-pron-head",
    "el-numeral-head",
    "el-participle-head",
    "el-adv-head",
    "el-art-head",
    "nl-adj-head",
    "nl-noun-head",
    "nl-verb-head",
    "de-adj-head",
    "de-noun-head",
    "de-verb-head",
    "form-of",
    "wikidata-p31",
    "translations",
    "senses",
    "el-verb-morphology",
    "el-noun-gender",
    "la-noun-head",
    "semantic-relations",
    "etymology",
    "el-ipa",
    "audio",
    "romanization",
    "rhymes",
    "homophones",
    "section-links",
    "alternative-forms",
    "see-also",
    "anagrams",
    "usage-notes",
    "references",
    "inflection-table-ref",
    "el-verb-stems",
    "el-noun-stems",
];

describe("registry decoder registration order", () => {
    it("matches the canonical id sequence (phase 4.3)", () => {
        const actual = registry.getDecoders().map((d) => d.id);
        expect(actual).toEqual(EXPECTED_DECODER_IDS);
    });
});
