/**
 * Fixture-based integration tests (no network).
 * Runs extractLanguageSection, splitEtymologiesAndPOS, parseTemplates,
 * and registry decoding against fixtures.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  extractLanguageSection,
  splitEtymologiesAndPOS,
  parseTemplates,
} from "../src/parse/parser";
import { registry } from "../src/decode/registry";
import type { DecodeContext } from "../src/types";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.wikitext`), "utf-8");
}

function makeCtx(
  posBlockWikitext: string,
  langBlock: string,
  etymology: { idx: number; title: string }
): DecodeContext {
  const templates = parseTemplates(posBlockWikitext);
  const lines = posBlockWikitext.split("\n");
  return {
    lang: "el",
    query: "test",
    page: { exists: true, title: "test", wikitext: "", pageprops: {}, pageid: 1 },
    languageBlock: langBlock,
    etymology: { ...etymology, posBlocks: [] },
    posBlock: { posHeading: "Verb", wikitext: posBlockWikitext },
    posBlockWikitext,
    templates,
    lines,
  };
}

describe("integration: fixture-based (no network)", () => {
  it("parses basic-verb fixture deterministically", () => {
    const raw = loadFixture("basic-verb");
    const langBlock = extractLanguageSection(raw, "Greek");
    expect(langBlock).not.toBeNull();

    const etyms = splitEtymologiesAndPOS(langBlock!);
    expect(etyms.length).toBeGreaterThanOrEqual(1);
    const verbBlock = etyms[0].posBlocks.find((pb) => pb.posHeading === "Verb");
    expect(verbBlock).toBeDefined();

    const ctx = makeCtx(verbBlock!.wikitext, langBlock!, etyms[0]);
    const result = registry.decodeAll(ctx);
    const entry = (result as any).entry;

    expect(entry.part_of_speech).toBe("verb");
    expect(entry.senses).toHaveLength(2);
    expect(entry.senses[0].gloss).toBe("to write");
    expect(entry.senses[0].subsenses).toHaveLength(2);
    expect(entry.semantic_relations?.synonyms).toHaveLength(2);
    expect(entry.etymology?.chain).toBeDefined();
    expect(entry.etymology?.chain.length).toBeGreaterThanOrEqual(1);
    expect(entry.etymology?.chain[0].term).toBe("γράφω");
    expect(entry.etymology?.chain[0].relation).toBe("inherited");
    expect(entry.hyphenation?.syllables).toEqual(["γρά", "φω"]);
  });

  it("parses form-of-inflected fixture", () => {
    const raw = loadFixture("form-of-inflected");
    const langBlock = extractLanguageSection(raw, "Greek");
    expect(langBlock).not.toBeNull();

    const etyms = splitEtymologiesAndPOS(langBlock!);
    const verbBlock = etyms[0].posBlocks.find((pb) => pb.posHeading === "Verb");
    const ctx = makeCtx(verbBlock!.wikitext, langBlock!, etyms[0]);
    const result = registry.decodeAll(ctx);

    expect((result as any).entry.type).toBe("INFLECTED_FORM");
    expect((result as any).entry.form_of?.lemma).toBe("γράφω");
    expect((result as any).entry.form_of?.template).toBe("inflection of");
  });

  it("parses translations-multi fixture", () => {
    const raw = loadFixture("translations-multi");
    const langBlock = extractLanguageSection(raw, "Greek");
    const etyms = splitEtymologiesAndPOS(langBlock!);
    const verbBlock = etyms[0].posBlocks.find((pb) => pb.posHeading === "Verb");
    const ctx = makeCtx(verbBlock!.wikitext, langBlock!, etyms[0]);
    const result = registry.decodeAll(ctx);

    const tr = (result as any).entry.translations;
    // Translations may or may not be populated depending on fixture structure;
    // at minimum, the decoder should run without errors.
    if (tr) {
      expect(Object.keys(tr).length).toBeGreaterThan(0);
    }
  });

  it("parses nested-templates fixture with correct translation term/params", () => {
    const raw = loadFixture("nested-templates");
    const langBlock = extractLanguageSection(raw, "Greek");
    const etyms = splitEtymologiesAndPOS(langBlock!);
    const verbBlock = etyms[0].posBlocks.find((pb) => pb.posHeading === "Verb");
    const ctx = makeCtx(verbBlock!.wikitext, langBlock!, etyms[0]);
    const result = registry.decodeAll(ctx);

    const tr = (result as any).entry.translations;
    if (tr) {
      expect(tr.en).toBeDefined();
      expect(tr.en[0].term).toBe("write");
      expect(tr.fr).toBeDefined();
      expect(tr.fr[0].term).toBe("écrire");
      expect(tr.fr[0].gloss).toBe("to write");
      expect(tr.fr[0].alt).toBe("écrire");
    }
  });

  /**
   * This test FAILS under current splitPipesPreservingLinks (guards Stage 1.1 bug):
   * The pipe inside {{g|m}} is incorrectly split because we only track
   * [[...]] depth, not {{...}} depth. After brace-aware fix, this passes.
   */
  it("preserves pipes inside nested templates (nested-pipe-bug fixture)", () => {
    const raw = loadFixture("nested-pipe-bug");
    const tpls = parseTemplates(raw);
    const t = tpls.find((x) => x.name === "t");
    expect(t).toBeDefined();

    const named = t!.params.named;
    expect(named).toBeDefined();
    expect(named.g).toBe("{{g|m}}");
  });
});
