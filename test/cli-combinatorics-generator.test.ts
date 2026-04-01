import { describe, it, expect, vi } from "vitest";
import { invokeExtractWrapper } from "../cli/index";
import * as SDK from "../src/index";
import { generateCliCombinatoricsCases } from "./helpers/cli-combinatorics-generator";

describe("CLI combinatorics test generator", () => {
  it("expands wrapper matrix and validates CLI routing signatures", async () => {
    const wrappers = [
      { wrapperName: "translate", query: "logos" },
      { wrapperName: "wikipediaLink", query: "logos" },
      { wrapperName: "isInstance", query: "Socrates" },
      { wrapperName: "isSubclass", query: "dog" },
      { wrapperName: "conjugate", query: "γράφω" },
      { wrapperName: "decline", query: "λόγος" },
      { wrapperName: "hyphenate", query: "ανθρωπος" },
      { wrapperName: "richEntry", query: "logos" },
      { wrapperName: "synonyms", query: "dog" },
      { wrapperName: "ipa", query: "dog" },
      { wrapperName: "morphology", query: "γράφω" },
      { wrapperName: "etymologyText", query: "dog" },
    ];

    const cases = generateCliCombinatoricsCases(wrappers);
    expect(cases.length).toBe(wrappers.length * 3);

    for (const c of cases) {
      const spy = vi
        .spyOn(SDK as any, c.wrapperName)
        .mockImplementation(async (...args: any[]) => ({ args }));
      const got = await invokeExtractWrapper(c.wrapperName, c.query, {
        lang: c.opts.lang as any,
        targetLang: c.opts.targetLang,
        preferredPos: c.opts.preferredPos,
        props: c.opts.props as any,
      });
      expect(got.args, c.caseId).toEqual(c.expectedArgs);
      spy.mockRestore();
    }
  });
});

