import { describe, it, expect } from "vitest";
import {
  registry,
  FORM_OF_TEMPLATES,
  isFormOfTemplateName,
  isVariantFormOfTemplateName,
} from "../src/registry";
import { parseTemplates } from "../src/parse/parser";
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

  it("detects la-noun headword gender from g= or subtype", () => {
    const g = makeCtx("{{la-noun|sēnsus<3.N>|g=n}}", { lang: "la" });
    expect((registry.decodeAll(g) as any).entry.headword_morphology?.gender).toBe("neuter");
    const subtype = makeCtx("{{la-noun|lemma<3.M>}}", { lang: "la" });
    expect((registry.decodeAll(subtype) as any).entry.headword_morphology?.gender).toBe("masculine");
  });

  it("detects es-verb form of (lemma in first positional, lang from template name)", () => {
    const ctx = makeCtx("{{head|es|verb form}}\n# {{es-verb form of|sensar}}", { lang: "es" });
    const entry = (registry.decodeAll(ctx) as any).entry;
    expect(entry.type).toBe("INFLECTED_FORM");
    expect(entry.form_of?.lemma).toBe("sensar");
    expect(entry.form_of?.lang).toBe("es");
    expect(entry.form_of?.label).toBe("Verb form");
    expect(entry.senses?.[0]?.gloss).toBe("Verb form of sensar");
  });

  it("expands template-only definition lines to plain glosses (combining form of)", () => {
    const ctx = makeCtx("{{head|en|prefix}}\n# {{combining form of|en|bio}}", { lang: "en" });
    const entry = (registry.decodeAll(ctx) as any).entry;
    expect(entry.senses?.[0]?.gloss).toBe("Combining form of bio");
  });

  it("expands construed with on template-only definition lines", () => {
    const ctx = makeCtx("{{head|en|noun}}\n# {{construed with|en|foo}}", { lang: "en" });
    const entry = (registry.decodeAll(ctx) as any).entry;
    expect(entry.senses?.[0]?.gloss).toBe("construed with foo");
  });

  it("matches semantic-relations when synonym heading uses variable equals (====)", () => {
    const wikitext = `{{el-verb}}
====Synonyms====
* {{l|el|δοκιμή}}`;
    const ctx = makeCtx(wikitext);
    const dec = registry.getDecoders().find((d) => d.id === "semantic-relations");
    expect(dec?.matches?.(ctx)).toBe(true);
    const result = registry.decodeAll(ctx);
    const rel = (result as any).entry.semantic_relations;
    expect(rel?.synonyms?.length).toBeGreaterThan(0);
  });

  it("extracts Collocations section into semantic_relations.collocations", () => {
    const wikitext = `{{en-noun}}
====Collocations====
* {{l|en|heavy rain}}`;
    const ctx = makeCtx(wikitext, { lang: "en" });
    const result = registry.decodeAll(ctx);
    const rel = (result as any).entry.semantic_relations;
    expect(rel?.collocations?.[0]?.term).toBe("heavy rain");
  });

  it("decodes only used in to plain gloss and structured only_used_in", () => {
    const ctx = makeCtx("{{head|nl|noun}}\n# {{only used in|nl|sense maken}}", { lang: "nl" });
    const entry = (registry.decodeAll(ctx) as any).entry;
    expect(entry.senses?.[0]?.gloss).toBe("only used in sense maken");
    expect(entry.senses?.[0]?.only_used_in).toMatchObject({
      lang: "nl",
      terms: ["sense maken"],
    });
    expect(entry.senses?.[0]?.only_used_in?.raw).toContain("only used in");
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

describe("isFormOfTemplateName / isVariantFormOfTemplateName", () => {
  it("treats Category-style … of templates as form-of", () => {
    expect(isFormOfTemplateName("comparative of")).toBe(true);
    expect(isFormOfTemplateName("combining form of")).toBe(true);
    expect(isFormOfTemplateName("rfform")).toBe(true);
    expect(isFormOfTemplateName("iupac-1")).toBe(true);
  });

  it("does not treat only used in as form-of lemma pointer", () => {
    expect(isFormOfTemplateName("only used in")).toBe(false);
  });

  it("classifies comparatives as inflected vs archaic spelling as variant", () => {
    expect(isVariantFormOfTemplateName("comparative of")).toBe(false);
    expect(isVariantFormOfTemplateName("archaic spelling of")).toBe(true);
  });

  it("decodes comparative of as INFLECTED_FORM", () => {
    const ctx = makeCtx("{{comparative of|en|large}}", { lang: "en" });
    const entry = (registry.decodeAll(ctx) as any).entry;
    expect(entry.type).toBe("INFLECTED_FORM");
    expect(entry.form_of?.lemma).toBe("large");
  });

  it("decodes archaic spelling of as FORM_OF", () => {
    const ctx = makeCtx("{{archaic spelling of|en|foo}}", { lang: "en" });
    const entry = (registry.decodeAll(ctx) as any).entry;
    expect(entry.type).toBe("FORM_OF");
    expect(entry.form_of?.lemma).toBe("foo");
  });
});
