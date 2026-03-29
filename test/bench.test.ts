import { describe, it, expect } from "vitest";
import { parseTemplates, extractLanguageSection } from "../src/parser";

const LARGE_WIKITEXT = `==Greek==

===Etymology 1===
From {{inh|el|grc|γράφω||to write, to scratch}}, from {{inh|el|ine-pro|*gerbʰ-||to scratch}}.

===Verb===
{{el-verb}}

# to [[write]], to [[record]]
#: {{ux|el|Γράφω ένα γράμμα.|I am writing a letter.}}
# to [[compose]], to [[author]]
## to write literature
## to write music
# to [[prescribe]] (a medicine)

{{syn|el|σημειώνω|καταγράφω}}
{{ant|el|σβήνω|διαγράφω}}

====Translations====
* {{t+|fr|écrire|g=m}}
* {{t+|de|schreiben}}

===Etymology 2===
From {{bor|el|fr|graphe}}.

===Noun===
{{el-noun|f}}

# [[graph]]

`.repeat(5);

/** CI and shared runners are slower; keep local defaults strict. */
const PERF_SLACK = process.env.CI ? 5 : 1;

describe("Parser performance assertions", () => {
  it("parses a large entry in under 10ms (avg over 100 runs)", () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      parseTemplates(LARGE_WIKITEXT);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 100;
    expect(avgMs).toBeLessThan(10 * PERF_SLACK);
  });

  it("extracts language section in under 1ms (avg over 1000 runs)", () => {
    const full = `==English==\nHello\n\n${LARGE_WIKITEXT}\n\n==French==\nBonjour\n`;
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      extractLanguageSection(full, "Greek");
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 1000;
    expect(avgMs).toBeLessThan(1 * PERF_SLACK);
  });
});
