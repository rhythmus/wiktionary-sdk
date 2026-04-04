import { describe, it, expect } from "vitest";
import {
  extractFormOfMorphLinesFromParsedHtml,
  formOfTemplateUsesMwParseInflectionTree,
} from "../src/form-of-parse-enrich";

describe("form-of-parse-enrich", () => {
  it("extracts nested ol li gloss lines from MW parser HTML", () => {
    const html = `<div class="mw-parser-output"><ol><li><span>inflection of sensar:</span><ol><li><span>first/third-person singular present subjunctive</span></li><li><span>third-person singular imperative</span></li></ol></li></ol></div>`;
    expect(extractFormOfMorphLinesFromParsedHtml(html)).toEqual([
      "first/third-person singular present subjunctive",
      "third-person singular imperative",
    ]);
  });

  it("recognizes per-language verb/noun/adj form-of template names (any ll code)", () => {
    expect(formOfTemplateUsesMwParseInflectionTree("es-verb form of")).toBe(true);
    expect(formOfTemplateUsesMwParseInflectionTree("de-noun form of")).toBe(true);
    expect(formOfTemplateUsesMwParseInflectionTree("fr-adj form of")).toBe(true);
    expect(formOfTemplateUsesMwParseInflectionTree("plural of")).toBe(false);
    expect(formOfTemplateUsesMwParseInflectionTree("verb form of")).toBe(false);
  });
});
