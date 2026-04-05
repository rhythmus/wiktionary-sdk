import { describe, it, expect } from "vitest";
import { registry } from "../src/decode/registry";
import { parseTemplates } from "../src/parse/parser";
import type { DecodeContext } from "../src/model";

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

describe("Phase 2.1: Sense-level structuring", () => {
  it("parses basic definition lines into senses", () => {
    const ctx = makeCtx("# to [[write]]\n# to [[record]]");
    const result = registry.decodeAll(ctx);
    const senses = (result as any).entry.senses;
    expect(senses).toHaveLength(2);
    expect(senses[0].id).toBe("S1");
    expect(senses[0].gloss).toBe("to write");
    expect(senses[1].id).toBe("S2");
    expect(senses[1].gloss).toBe("to record");
  });

  it("parses subsenses (## lines)", () => {
    const ctx = makeCtx("# to [[write]]\n## to write by hand\n## to type");
    const result = registry.decodeAll(ctx);
    const senses = (result as any).entry.senses;
    expect(senses).toHaveLength(1);
    expect(senses[0].subsenses).toHaveLength(2);
    expect(senses[0].subsenses[0].id).toBe("S1.1");
    expect(senses[0].subsenses[1].id).toBe("S1.2");
  });

  it("parses examples (#: lines)", () => {
    const ctx = makeCtx("# to [[write]]\n#: He writes every day.");
    const result = registry.decodeAll(ctx);
    const senses = (result as any).entry.senses;
    expect(senses[0].examples).toEqual(["He writes every day."]);
  });

  it("strips wiki markup from glosses", () => {
    const ctx = makeCtx("# to [[make|produce]] a '''written''' work");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.senses[0].gloss).toBe("to produce a written work");
  });

  it("brace-aware stripping: [[link]] does not duplicate text", () => {
    const ctx = makeCtx("# to [[write]]");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.senses[0].gloss).toBe("to write");
  });

  it("brace-aware stripping: [[link|display]] uses display only", () => {
    const ctx = makeCtx("# [[make|produce]]");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.senses[0].gloss).toBe("produce");
  });

  it("brace-aware stripping: nested templates removed correctly", () => {
    const ctx = makeCtx("# word {{t|el|fr|écrire|g={{g|m}}}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.senses[0].gloss).toBe("word");
  });
});

describe("Phase 2.2: Semantic relations", () => {
  it("parses synonym templates", () => {
    const ctx = makeCtx("{{syn|el|σημειώνω|καταγράφω}}");
    const result = registry.decodeAll(ctx);
    const rels = (result as any).entry.semantic_relations;
    expect(rels.synonyms).toHaveLength(2);
    expect(rels.synonyms[0].term).toBe("σημειώνω");
    expect(rels.synonyms[1].term).toBe("καταγράφω");
  });

  it("parses antonym templates", () => {
    const ctx = makeCtx("{{ant|el|σβήνω}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.semantic_relations.antonyms[0].term).toBe("σβήνω");
  });

  it("parses hypernym templates", () => {
    const ctx = makeCtx("{{hyper|el|δημιουργώ}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.semantic_relations.hypernyms[0].term).toBe("δημιουργώ");
  });

  it("parses hyponym templates", () => {
    const ctx = makeCtx("{{hypo|el|χαράζω}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.semantic_relations.hyponyms[0].term).toBe("χαράζω");
  });

  it("handles qualifier parameter", () => {
    const ctx = makeCtx("{{syn|el|σημειώνω|q=formal}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.semantic_relations.synonyms[0].qualifier).toBe("formal");
  });
});

describe("Phase 2.3: Structured etymology & cognates", () => {
  it("parses inh template", () => {
    const ctx = makeCtx("{{inh|el|grc|γράφω|t=to write}}");
    const result = registry.decodeAll(ctx);
    const etym = (result as any).entry.etymology;
    expect(etym.chain).toHaveLength(1);
    expect(etym.chain[0].template).toBe("inh");
    expect(etym.chain[0].relation).toBe("inherited");
    expect(etym.chain[0].source_lang).toBe("grc");
    expect(etym.chain[0].term).toBe("γράφω");
    expect(etym.chain[0].gloss).toBe("to write");
  });

  it("parses der template", () => {
    const ctx = makeCtx("{{der|el|la|scrībō}}");
    const result = registry.decodeAll(ctx);
    const etym = (result as any).entry.etymology;
    expect(etym.chain[0].template).toBe("der");
    expect(etym.chain[0].relation).toBe("derived");
    expect(etym.chain[0].source_lang).toBe("la");
    expect(etym.chain[0].term).toBe("scrībō");
  });

  it("strips wikilinks in etymology term", () => {
    const ctx = makeCtx("{{der|en|fro|[[sens]], [[sen]], [[san]]}}");
    const result = registry.decodeAll(ctx);
    const etym = (result as any).entry.etymology;
    expect(etym.chain[0].term).toBe("sens, sen, san");
  });

  it("uses named alt when etymology term slot is empty", () => {
    const ctx = makeCtx("{{der|en|gem||alt=*sinn}}");
    const result = registry.decodeAll(ctx);
    const etym = (result as any).entry.etymology;
    expect(etym.chain[0].source_lang).toBe("gem");
    expect(etym.chain[0].term).toBe("*sinn");
  });

  it("parses bor template", () => {
    const ctx = makeCtx("{{bor|el|fr|écrire}}");
    const result = registry.decodeAll(ctx);
    const etym = (result as any).entry.etymology;
    expect(etym.chain[0].template).toBe("bor");
    expect(etym.chain[0].relation).toBe("borrowed");
  });

  it("parses cog template into cognates (not chain)", () => {
    const ctx = makeCtx("{{cog|de|schreiben}}");
    const result = registry.decodeAll(ctx);
    const etym = (result as any).entry.etymology;
    expect(etym.cognates[0].template).toBe("cog");
    expect(etym.cognates[0].relation).toBe("cognate");
    expect(etym.cognates[0].term).toBe("schreiben");
    expect(etym.chain).toBeUndefined();
  });

  it("handles mixed ancestor + cognate templates", () => {
    const ctx = makeCtx("{{inh|el|grc|γράφω}} and {{cog|la|graphō}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.etymology.chain).toHaveLength(1);
    expect((result as any).entry.etymology.cognates).toHaveLength(1);
  });
});

describe("Phase 2.4: Advanced pronunciation", () => {
  it("parses el-IPA template", () => {
    const ctx = makeCtx("{{el-IPA|γράφω}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.pronunciation.IPA).toBe("γράφω");
  });

  it("parses audio template", () => {
    const ctx = makeCtx("{{audio|el|El-γράφω.ogg|Audio}}");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.pronunciation.audio).toBe("El-γράφω.ogg");
  });
});

describe("Phase 2.5: Usage notes", () => {
  it("extracts usage notes section", () => {
    const wikitext = `{{el-verb}}
# to write

===Usage notes===
* Used in formal contexts.
* Can also mean "to compose".

===Synonyms===
{{syn|el|σημειώνω}}`;
    const ctx = makeCtx(wikitext);
    const result = registry.decodeAll(ctx);
    const notes = (result as any).entry.usage_notes;
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("formal contexts");
    expect(notes[1]).toContain("compose");
  });

  it("does not extract if no usage notes section", () => {
    const ctx = makeCtx("{{el-verb}}\n# to write");
    const result = registry.decodeAll(ctx);
    expect((result as any).entry.usage_notes).toBeUndefined();
  });
});
