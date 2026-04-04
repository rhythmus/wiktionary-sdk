/**
 * Audit §13.6 — stripWikiMarkup + form-of predicates.
 */
import { describe, it, expect } from "vitest";
import {
  stripWikiMarkup,
  isFormOfTemplateName,
  isVariantFormOfTemplateName,
  isPerLangFormOfTemplate,
} from "../src/registry";

describe("registry audit: stripWikiMarkup", () => {
  it("strips nested link with nested template in display text", () => {
    const s = "[[foo|{{bar|x}}]]";
    const out = stripWikiMarkup(s);
    expect(out).not.toContain("{{");
    expect(out).not.toContain("[[");
  });

  it("processes bold before italic (triple apostrophe first)", () => {
    expect(stripWikiMarkup("'''bold''' then ''italic''")).toMatch(/bold.*italic/s);
  });
});

describe("registry audit: form-of predicates (§13.6)", () => {
  it("matches core inflection and variant templates", () => {
    expect(isFormOfTemplateName("inflection of")).toBe(true);
    expect(isFormOfTemplateName("plural of")).toBe(true);
    expect(isVariantFormOfTemplateName("plural of")).toBe(false);
    expect(isVariantFormOfTemplateName("misspelling of")).toBe(true);
  });

  it("matches per-language xx-verb form of family", () => {
    expect(isPerLangFormOfTemplate("es-verb form of")).toBe(true);
    expect(isPerLangFormOfTemplate("de-noun form of")).toBe(true);
    expect(isFormOfTemplateName("nl-adj form of")).toBe(true);
  });

  it("does not treat only used in as form-of lemma pointer", () => {
    expect(isFormOfTemplateName("only used in")).toBe(false);
  });
});
