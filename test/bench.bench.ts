import { bench, describe } from "vitest";
import { parseTemplates, extractLanguageSection, splitEtymologiesAndPOS } from "../src/parser";

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
* {{t+|es|escribir}}
* {{t+|it|scrivere}}
* {{t+|pt|escrever}}

===Etymology 2===
From {{bor|el|fr|graphe}}.

===Noun===
{{el-noun|f}}

# [[graph]]

===Usage notes===
* This word is primarily used in mathematical contexts.

`.repeat(5);

const NESTED_TEMPLATES = `{{inflection of|el|γράφω||1|s|pres|ind|act|form={{el-verb|f=passive|a=imperfective}}}}`;

describe("Parser Benchmarks", () => {
  bench("parseTemplates — large entry", () => {
    parseTemplates(LARGE_WIKITEXT);
  });

  bench("parseTemplates — nested templates", () => {
    parseTemplates(NESTED_TEMPLATES);
  });

  bench("extractLanguageSection", () => {
    const full = `==English==\nHello\n\n${LARGE_WIKITEXT}\n\n==French==\nBonjour\n`;
    extractLanguageSection(full, "Greek");
  });

  bench("splitEtymologiesAndPOS", () => {
    splitEtymologiesAndPOS(LARGE_WIKITEXT);
  });
});
