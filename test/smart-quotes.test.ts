import { describe, it, expect } from "vitest";
import { smartQuotes } from "../src/present/smart-quotes";

describe("smartQuotes", () => {
    it("converts straight double quotes to English curly quotes", () => {
        expect(smartQuotes('"hello"', "en")).toBe("\u201Chello\u201D");
    });

    it("handles apostrophes (mid-word single quotes) correctly", () => {
        expect(smartQuotes("don't", "en")).toBe("don\u2019t");
        expect(smartQuotes("it's", "en")).toBe("it\u2019s");
    });

    it("converts single quotes around words", () => {
        expect(smartQuotes("'hello'", "en")).toBe("\u2018hello\u2019");
    });

    it("handles mixed double and single quotes", () => {
        const input = 'She said "it\'s a \'test\' of time"';
        const result = smartQuotes(input, "en");
        expect(result).toContain("\u201C");
        expect(result).toContain("\u201D");
        expect(result).toContain("\u2019");
    });

    it("uses Greek guillemets for el", () => {
        expect(smartQuotes('"word"', "el")).toBe("\u00ABword\u00BB");
    });

    it("uses German low-high quotes for de", () => {
        expect(smartQuotes('"Wort"', "de")).toBe("\u201EWort\u201C");
    });

    it("uses French guillemets with narrow no-break spaces for fr", () => {
        const result = smartQuotes('"mot"', "fr");
        expect(result).toBe("\u00AB\u202Fmot\u202F\u00BB");
    });

    it("uses Spanish/Italian guillemets for es", () => {
        expect(smartQuotes('"palabra"', "es")).toBe("\u00ABpalabra\u00BB");
    });

    it("uses Danish reversed guillemets for da", () => {
        expect(smartQuotes('"ord"', "da")).toBe("\u00BBord\u00AB");
    });

    it("uses Japanese corner brackets for ja", () => {
        expect(smartQuotes('"word"', "ja")).toBe("\u300Cword\u300D");
    });

    it("uses Russian guillemets for ru", () => {
        expect(smartQuotes('"слово"', "ru")).toBe("\u00ABслово\u00BB");
    });

    it("falls back to English for unknown language codes", () => {
        expect(smartQuotes('"hello"', "xx")).toBe("\u201Chello\u201D");
    });

    it("falls back to English when no language provided", () => {
        expect(smartQuotes('"hello"')).toBe("\u201Chello\u201D");
    });

    it("returns empty/falsy input unchanged", () => {
        expect(smartQuotes("")).toBe("");
        expect(smartQuotes(null as any)).toBe(null);
        expect(smartQuotes(undefined as any)).toBe(undefined);
    });

    it("leaves text without quotes unchanged", () => {
        expect(smartQuotes("no quotes here", "en")).toBe("no quotes here");
    });

    it("handles closing quote after punctuation (e.g. period)", () => {
        const result = smartQuotes('"Hello."', "en");
        expect(result).toBe("\u201CHello.\u201D");
    });

    it("handles the God usage note case: 'The word \"God\" is capitalized'", () => {
        const input = 'The word "God" is capitalized in reference to the Abrahamic deity';
        const result = smartQuotes(input, "en");
        expect(result).toBe("The word \u201CGod\u201D is capitalized in reference to the Abrahamic deity");
    });

    it("handles quote at sentence start followed by space", () => {
        const result = smartQuotes('"Hello," she said.', "en");
        expect(result).toBe("\u201CHello,\u201D she said.");
    });

    it("handles Unicode word characters for quote detection", () => {
        const result = smartQuotes('"γράφω"', "el");
        expect(result).toBe("\u00ABγράφω\u00BB");
    });
});
