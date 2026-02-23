import { describe, it, expect } from "vitest";
import { registry, FORM_OF_TEMPLATES } from "../src/registry";
import { parseTemplates } from "../src/parser";
import type { DecodeContext } from "../src/types";

function makeCtx(wikitext: string, overrides?: Partial<DecodeContext>): DecodeContext {
  const templates = parseTemplates(wikitext);
  const lines = wikitext.split("\n");
  return {
    lang: "el",
    query: "test",
    page: { exists: true, title: "test", wikitext: "", pageprops: {}, pageid: 1 },
    languageBlock: wikitext,
    etymology: { idx: 1, title: "Etymology", posBlocks: [] },
    posBlock: { posHeading: "Verb", wikitext },
    posBlockWikitext: wikitext,
    templates,
    lines,
    ...overrides,
  };
}

describe("DecoderRegistry", () => {
  it("stores raw templates for every context", () => {
    const ctx = makeCtx("{{el-verb}}\n{{IPA|el|/ˈɣra.fo/}}");
    const result = registry.decodeAll(ctx);
    expect(result).toHaveProperty("entry.templates");
    const tpls = (result as any).entry.templates;
    expect(tpls["el-verb"]).toHaveLength(1);
    expect(tpls["IPA"]).toHaveLength(1);
  });

  it("extracts IPA pronunciation", () => {
    const ctx = makeCtx("{{IPA|el|/ˈɣra.fo/}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.pronunciation?.IPA).toBe("/ˈɣra.fo/");
  });

  it("detects el-verb headword template", () => {
    const ctx = makeCtx("{{el-verb}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.part_of_speech).toBe("verb");
  });

  it("detects el-noun headword template", () => {
    const ctx = makeCtx("{{el-noun}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.part_of_speech).toBe("noun");
  });

  it("detects el-adj headword template", () => {
    const ctx = makeCtx("{{el-adj}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.part_of_speech).toBe("adjective");
  });

  it("parses form-of template as INFLECTED_FORM", () => {
    const ctx = makeCtx("{{inflection of|el|γράφω||1|s|pres|ind|act}}");
    const result = registry.decodeAll(ctx);
    const entry = (result as any).entry;
    expect(entry.type).toBe("INFLECTED_FORM");
    expect(entry.form_of.template).toBe("inflection of");
    expect(entry.form_of.lemma).toBe("γράφω");
    expect(entry.form_of.lang).toBe("el");
    expect(entry.form_of.tags).toContain("1");
    expect(entry.form_of.tags).toContain("pres");
  });

  it("parses hyphenation", () => {
    const ctx = makeCtx("{{hyphenation|γρά|φω}}");
    const result = registry.decodeAll(ctx);
    const hyph = (result as any).entry.hyphenation;
    expect(hyph).toBeDefined();
    expect(hyph.syllables).toEqual(["γρά", "φω"]);
  });

  it("extracts derived/related terms and descendants from {{l}}/{{link}} sections", () => {
    const wikitext = `{{el-verb}}
# to write
====Derived terms====
* {{l|el|αντιγράφω|gloss=to copy}}
* {{link|el|γραφή}}
====Related terms====
* {{l|el|γράφημα}}
====Descendants====
* {{l|en|graph|gloss=to write}}`;
    const ctx = makeCtx(wikitext);
    const result = registry.decodeAll(ctx);
    const entry = (result as any).entry;
    expect(entry.derived_terms).toBeDefined();
    expect(entry.derived_terms.raw_text).toContain("{{l|el|αντιγράφω");
    expect(entry.derived_terms.items).toHaveLength(2);
    expect(entry.derived_terms.items[0]).toEqual({
      term: "αντιγράφω",
      lang: "el",
      gloss: "to copy",
      template: "l",
      raw: "{{l|el|αντιγράφω|gloss=to copy}}",
    });
    expect(entry.derived_terms.items[1].term).toBe("γραφή");
    expect(entry.derived_terms.items[1].template).toBe("link");
    expect(entry.related_terms.items).toHaveLength(1);
    expect(entry.related_terms.items[0].term).toBe("γράφημα");
    expect(entry.descendants.items).toHaveLength(1);
    expect(entry.descendants.items[0]).toMatchObject({
      term: "graph",
      lang: "en",
      gloss: "to write",
    });
  });
});

describe("FORM_OF_TEMPLATES", () => {
  it("recognizes inflection of", () => {
    expect(FORM_OF_TEMPLATES.has("inflection of")).toBe(true);
    expect(FORM_OF_TEMPLATES.has("infl of")).toBe(true);
  });

  it("recognizes alternative form of", () => {
    expect(FORM_OF_TEMPLATES.has("alternative form of")).toBe(true);
  });

  it("does not include headword templates", () => {
    expect(FORM_OF_TEMPLATES.has("el-verb")).toBe(false);
  });
});
