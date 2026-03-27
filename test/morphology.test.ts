import { describe, it, expect, vi } from "vitest";
import { conjugate, decline } from "../src/morphology";
import * as indexModule from "../src/index";
import * as apiModule from "../src/api";

vi.mock("../src/index", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/index")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

vi.mock("../src/api", async (importOriginal) => {
    return {
        mwFetchJson: vi.fn(),
    };
});

describe("morphology conjugate", () => {
    it("should scrape inflected forms from expanded conjugation table", async () => {
        // Arrange
        const mockFetchWiktionaryResult = {
            entries: [{ type: "LEXEME", form: "έγραψα" }],
            rawLanguageBlock: "==Greek==\n===Verb===\n{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ}}"
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

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

        // Act & Assert 1
        const res1 = await conjugate("έγραψα", { person: "1", number: "singular", tense: "present", aspect: "imperfective", voice: "active" });
        expect(res1).toEqual(["γράφω"]);
        
        // Act & Assert 2
        const res2 = await conjugate("έγραψα", { person: "1", number: "plural", tense: "present", aspect: "imperfective", voice: "active" });
        expect(res2).toEqual(["γράφουμε", "γράφομε"]);
        
        // Act & Assert 3 (Future derived)
        const res3 = await conjugate("έγραψα", { person: "1", number: "singular", tense: "future", aspect: "perfective", voice: "active" });
        expect(res3).toEqual(["θα γράψω"]);
    });

    it("should extract grammatical properties natively with morphology()", async () => {
        // Arrange
        const mockFetchWiktionaryResult = {
            entries: [
                { 
                    type: "INFLECTED_FORM", 
                    form: "έγραψα", 
                    form_of: { tags: ["1s", "spast", "ind", "act"] } 
                }
            ]
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        // Act
        const { morphology } = await import("../src/morphology");
        const traits = await morphology("έγραψα");

        // Assert
        expect(traits).toEqual({
            person: "1",
            number: "singular",
            tense: "past",
            aspect: "perfective",
            mood: "indicative",
            voice: "active"
        });
    });

    it("should utilize smart defaults inside conjugate() based on inherent grammar", async () => {
        // Arrange
        const mockFetchWiktionaryResult = {
            entries: [
                { 
                    type: "INFLECTED_FORM", 
                    form: "έγραψες", // 2nd person singular
                    form_of: { tags: ["2s", "spast", "ind", "act"] } 
                }
            ],
            rawLanguageBlock: "==Greek==\n===Verb===\n{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ}}"
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);
        
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

        // Act: Request the plural of "έγραψες". 
        // We do not specify tense, aspect, voice, or person. They should magically inherit from "έγραψες"!
        const res = await conjugate("έγραψες", { number: "plural" });

        // Assert
        // "έγραψες" is past, perfective, person 2. 
        // We override number to "plural". We should get "γράψατε" (cells[2] for past perfective).
        expect(res).toEqual(["γράψατε"]);
    });
});

describe("morphology decline", () => {
    it("should scrape inflected nominal forms from expanded noun/adjective tables", async () => {
        // Arrange
        const mockFetchWiktionaryResult = {
            entries: [], // Lexeme fallback
            rawLanguageBlock: "==Greek==\n===Noun===\n{{el-nM-ος-οι-3b|άνθρωπ|ανθρώπ}}"
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);
        
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

        // Act & Assert 1
        const res1 = await decline("άνθρωπος", { case: "vocative" }); // fallback 1st col singular since vocative missing in mock! 
        // Wait, if vocative row is missing, it returns []. Let's test accusative.
        const res2 = await decline("άνθρωπος", { case: "accusative", number: "plural" });
        expect(res2).toEqual(["ανθρώπους"]);
        
        // Act & Assert 3
        const res3 = await decline("άνθρωπος", { case: "genitive", number: "singular" });
        expect(res3).toEqual(["ανθρώπου"]);
    });
});

