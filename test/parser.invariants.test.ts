import { describe, it, expect } from "vitest";
import { parseTemplates, type TemplateCallWithLocation } from "../src/parser";

function tplsWithLoc(w: string) {
  return parseTemplates(w, true) as TemplateCallWithLocation[];
}

describe("parseTemplates invariants", () => {
  it("raw slice matches source for every located template", () => {
    const w = "a {{foo|x}} b {{nested|{{inner}}}} c";
    const t = tplsWithLoc(w);
    for (const x of t) {
      expect(x.start).toBeDefined();
      expect(x.end).toBeDefined();
      expect(w.slice(x.start!, x.end!)).toBe(x.raw);
    }
  });

  it("located templates are non-overlapping in document order", () => {
    const w = "{{a|1}}{{b|{{c}}}}";
    const t = tplsWithLoc(w);
    let prevEnd = 0;
    for (const x of t) {
      expect(x.start! >= prevEnd).toBe(true);
      prevEnd = x.end!;
    }
  });

  it("nested template raw includes inner braces", () => {
    const w = "{{outer|{{inner|p}}}}";
    const t = tplsWithLoc(w);
    expect(t).toHaveLength(1);
    expect(t[0].raw).toBe("{{outer|{{inner|p}}}}");
  });

  it("unbalanced braces do not throw; advances past bad opener", () => {
    const w = "{{broken";
    const t = parseTemplates(w);
    expect(t).toEqual([]);
  });

  it("empty and whitespace-only inner names are skipped", () => {
    expect(parseTemplates("{{}}")).toEqual([]);
    expect(parseTemplates("{{  }}")).toEqual([]);
  });
});
