import { describe, it, expect } from "vitest";
import { registry } from "../src/registry";

/**
 * Duplicate decoder ids break merge order expectations, hide decoders from
 * decoder-coverage.test.ts (seen Set skips repeats), and confuse debug output.
 */
describe("registry decoder ids", () => {
  it("are unique", () => {
    const ids = registry.getDecoders().map((d) => d.id);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    expect(dupes, `duplicate decoder id(s): ${[...new Set(dupes)].join(", ")}`).toEqual([]);
  });
});
