import { describe, it, expect, vi } from "vitest";
import { conjugate, decline } from "../src/convenience/morphology";
import * as coreModule from "../src/pipeline/wiktionary-core";
import * as apiModule from "../src/ingress/api";
import { asLexemeRows } from "../src/convenience";

vi.mock("../src/pipeline/wiktionary-core", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/pipeline/wiktionary-core")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

vi.mock("../src/ingress/api", async (importOriginal) => {
    return {
        mwFetchJson: vi.fn(),
    };
});

describe("morphology conjugate", () => {
    it("should scrape inflected forms from expanded conjugation table", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [{
                id: "el:έγραψα#E1#verb#LEXEME",
                language: "el",
                type: "LEXEME",
                form: "έγραψα",
                part_of_speech_heading: "Verb",
                templates_all: [{
                    name: "el-conjug-1st",
                    raw: "{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ}}",
                    params: { positional: [], named: { present: "γράφ", "a-imperfect": "έγραφ" } }
                }]
            }],
            rawLanguageBlock: "==Greek==\n===Verb===\n{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ}}"
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        const mockApiHtml = `
<table class="inflection-table">
  <tr><td>Non-past tenses</td></tr>
  <tr>
    <td>1 sg</td>
    <td><a href="/wiki/γράφω">γράφω</a></td>
    <td><a href="/wiki/γράψω">γράψω</a></td>
    <td><a href="/wiki/γράφομαι">γράφομαι</a></td>
    <td><a href="/wiki/γραφτώ">γραφτώ</a></td>
  </tr>
  <tr>
    <td>1 pl</td>
    <td>γράφουμε, [γράφομε]</td>
    <td><a href="/wiki/γράψουμε">γράψουμε</a></td>
    <td><a href="/wiki/γραφόμαστε">γραφόμαστε</a></td>
    <td><a href="/wiki/γραφτούμε">γραφτούμε</a></td>
  </tr>
</table>`;

        vi.mocked(apiModule.mwFetchJson).mockResolvedValue({
            parse: { text: { "*": mockApiHtml } }
        });

        const res1 = await conjugate("έγραψα", { person: "1", number: "singular", tense: "present", aspect: "imperfective", voice: "active" });
        expect(res1[0].value).toEqual(["γράφω"]);
        
        const res2 = await conjugate("έγραψα", { person: "1", number: "plural", tense: "present", aspect: "imperfective", voice: "active" });
        expect(res2[0].value).toEqual(["γράφουμε", "γράφομε"]);
        
        const res3 = await conjugate("έγραψα", { person: "1", number: "singular", tense: "future", aspect: "perfective", voice: "active" });
        expect(res3[0].value).toEqual(["θα γράψω"]);
        expect(apiModule.mwFetchJson).toHaveBeenCalledWith(
            "https://en.wiktionary.org/w/api.php",
            expect.objectContaining({ action: "parse", title: "έγραψα" }),
        );
    });

    it("should extract grammatical properties natively with morphology()", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [
                { 
                    id: "el:έγραψα#E1#verb#INFLECTED_FORM",
                    language: "el",
                    type: "INFLECTED_FORM", 
                    form: "έγραψα",
                    part_of_speech_heading: "Verb",
                    form_of: { tags: ["1s", "spast", "ind", "act"] } 
                }
            ]
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        const { morphology } = await import("../src/convenience/morphology");
        const results = await morphology("έγραψα");

        expect(asLexemeRows(results as any)[0].value).toEqual({
            person: "1",
            number: "singular",
            tense: "past",
            aspect: "perfective",
            mood: "indicative",
            voice: "active"
        });
    });

    it("should utilize smart defaults inside conjugate() based on inherent grammar", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [
                { 
                    id: "el:έγραψες#E1#verb#INFLECTED_FORM",
                    language: "el",
                    type: "INFLECTED_FORM", 
                    form: "έγραψες",
                    part_of_speech_heading: "Verb",
                    form_of: { tags: ["2s", "spast", "ind", "act"] },
                    templates_all: [{
                        name: "el-conjug-1st",
                        raw: "{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ}}",
                        params: { positional: [], named: { present: "γράφ", "a-imperfect": "έγραφ" } }
                    }]
                }
            ],
            rawLanguageBlock: "==Greek==\n===Verb===\n{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ}}"
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);
        
        const mockApiHtml = `
<table class="inflection-table">
  <tr><td>Past tenses</td></tr>
  <tr>
    <td>2 pl</td>
    <td><a href="/wiki/γράφατε">γράφατε</a></td>
    <td><a href="/wiki/γράψατε">γράψατε</a></td>
  </tr>
</table>`;
        vi.mocked(apiModule.mwFetchJson).mockResolvedValue({ parse: { text: { "*": mockApiHtml } } });

        const res = await conjugate("έγραψες", { number: "plural" });
        expect(res[0].value).toEqual(["γράψατε"]);
    });

    it("should only expand non-el conjugation templates when explicit prefixes are provided", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [{
                id: "xx:test#E1#verb#LEXEME",
                language: "xx",
                type: "LEXEME",
                form: "test",
                part_of_speech_heading: "Verb",
                templates_all: [{
                    name: "xx-conj-1",
                    raw: "{{xx-conj-1|...}}",
                    params: { positional: [], named: {} }
                }]
            }],
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);
        vi.mocked(apiModule.mwFetchJson).mockResolvedValue({
            parse: { text: { "*": "<table><tr><td>Non-past tenses</td></tr><tr><td>1 sg</td><td>foo</td><td>bar</td></tr></table>" } }
        });

        const withoutPrefixes = await conjugate("test");
        expect(withoutPrefixes[0].value).toBeNull();

        const withPrefixes = await conjugate("test", {}, "Auto", { conjugationTemplatePrefixes: ["xx-conj-"] });
        expect(withPrefixes[0].value).toEqual({
            active: { indicative: { present: { "1sg": ["foo"] }, past: {} } },
            passive: { indicative: { present: {}, past: {} } }
        });
    });
});

describe("morphology decline", () => {
    it("should scrape inflected nominal forms from expanded noun/adjective tables", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [{
                id: "el:άνθρωπος#E1#noun#LEXEME",
                language: "el",
                type: "LEXEME",
                form: "άνθρωπος",
                part_of_speech_heading: "Noun",
                templates_all: [{
                    name: "el-nM-ος-οι-3b",
                    raw: "{{el-nM-ος-οι-3b|άνθρωπ|ανθρώπ}}",
                    params: { positional: ["άνθρωπ", "ανθρώπ"], named: {} }
                }]
            }],
            rawLanguageBlock: "==Greek==\n===Noun===\n{{el-nM-ος-οι-3b|άνθρωπ|ανθρώπ}}"
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);
        
        const mockApiHtml = `
<table class="inflection-table">
  <tr>
    <th>nominative</th>
    <td><a href="/wiki/άνθρωπος">άνθρωπος</a></td>
    <td><a href="/wiki/άνθρωποι">άνθρωποι</a></td>
  </tr>
  <tr>
    <th>genitive</th>
    <td><a href="/wiki/ανθρώπου">ανθρώπου</a></td>
    <td><a href="/wiki/ανθρώπων">ανθρώπων</a></td>
  </tr>
  <tr>
    <th>accusative</th>
    <td><a href="/wiki/άνθρωπο">άνθρωπο</a></td>
    <td><a href="/wiki/ανθρώπους">ανθρώπους</a></td>
  </tr>
</table>`;
        vi.mocked(apiModule.mwFetchJson).mockResolvedValue({ parse: { text: { "*": mockApiHtml } } });

        const res2 = await decline("άνθρωπος", { case: "accusative", number: "plural" });
        expect(res2[0].value).toEqual(["ανθρώπους"]);
        
        const res3 = await decline("άνθρωπος", { case: "genitive", number: "singular" });
        expect(res3[0].value).toEqual(["ανθρώπου"]);
        expect(apiModule.mwFetchJson).toHaveBeenCalledWith(
            "https://en.wiktionary.org/w/api.php",
            expect.objectContaining({ action: "parse", title: "άνθρωπος" }),
        );
    });

    it("should only expand non-el declension templates when explicit prefixes are provided", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [{
                id: "xx:test#E1#noun#LEXEME",
                language: "xx",
                type: "LEXEME",
                form: "test",
                part_of_speech_heading: "Noun",
                templates_all: [{
                    name: "xx-decl-1",
                    raw: "{{xx-decl-1|...}}",
                    params: { positional: [], named: {} }
                }]
            }],
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);
        vi.mocked(apiModule.mwFetchJson).mockResolvedValue({
            parse: { text: { "*": "<table><tr><th>nominative</th><td>test</td><td>tests</td></tr></table>" } }
        });

        const withoutPrefixes = await decline("test");
        expect(withoutPrefixes[0].value).toBeNull();

        const withPrefixes = await decline("test", {}, "Auto", { declensionTemplatePrefixes: ["xx-decl-"] });
        expect(withPrefixes[0].value).toEqual({
            singular: { nominative: ["test"] },
            plural: { nominative: ["tests"] }
        });
    });
});
