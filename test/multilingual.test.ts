import { describe, it, expect } from "vitest";
import { registry } from "../src/decode/registry";
import { wiktionaryRecursive } from "../src/index";

describe("multilingual and variant classification", () => {
    it("recognizes Dutch noun gender and POS", async () => {
        const mockCtx: any = {
            lang: "nl",
            query: "boom",
            templates: [{ name: "nl-noun", params: { positional: ["m", "-en", "boompje"], named: {} }, raw: "{{nl-noun|m|-en|boompje}}" }],
            posBlockWikitext: "===Noun===\n{{nl-noun|m|-en|boompje}}",
            lines: ["# tree"],
            etymology: {},
            posBlock: { posHeading: "Noun", wikitext: "" },
            page: { exists: true, title: "boom", wikitext: "", pageprops: {} }
        };
        
        const decoders = registry.getDecoders();
        let patch = {};
        for (const d of decoders) {
            if (d.id === "nl-noun-head" && d.matches(mockCtx)) {
                patch = Buffer.from(JSON.stringify(d.decode(mockCtx))).toJSON(); // clone-ish
                Object.assign(patch, d.decode(mockCtx));
            }
        }
        
        expect((patch as any).entry.part_of_speech).toBe("noun");
        expect((patch as any).entry.headword_morphology.gender).toBe("masculine");
    });

    it("recognizes German noun gender and POS", async () => {
        const mockCtx: any = {
            lang: "de",
            query: "Baum",
            templates: [{ name: "de-noun", params: { positional: ["m,(e)s,Bäume"], named: {} }, raw: "{{de-noun|m,(e)s,Bäume}}" }],
            posBlockWikitext: "===Noun===\n{{de-noun|m,(e)s,Bäume}}",
            lines: ["# tree"],
            etymology: {},
            posBlock: { posHeading: "Noun", wikitext: "" },
            page: { exists: true, title: "Baum", wikitext: "", pageprops: {} }
        };
        
        const decoders = registry.getDecoders();
        let patch: any = {};
        for (const d of decoders) {
            if (d.id === "de-noun-head" && d.matches(mockCtx)) {
                Object.assign(patch, d.decode(mockCtx));
            }
        }
        
        expect(patch.entry.part_of_speech).toBe("noun");
        expect(patch.entry.headword_morphology.gender).toBe("masculine");
    });

    it("classifies variants as FORM_OF and inflections as INFLECTED_FORM", () => {
        const variantCtx: any = {
            templates: [{ name: "alternative form of", params: { positional: ["en", "color"], named: {} }, raw: "{{alternative form of|en|color}}" }]
        };
        
        const inflectionCtx: any = {
            templates: [{ name: "infl of", params: { positional: ["el", "γράφω", "1", "s", "pres"], named: {} }, raw: "{{infl of|el|γράφω|1|s|pres}}" }]
        };

        const variantDecoder = registry.getDecoders().find(d => d.id === "form-of")!;
        const variantResult = variantDecoder.decode(variantCtx);
        expect(variantResult.entry.type).toBe("FORM_OF");

        const inflectionResult = variantDecoder.decode(inflectionCtx);
        expect(inflectionResult.entry.type).toBe("INFLECTED_FORM");
    });
});
