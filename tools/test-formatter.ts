import { format, registerStyle } from "../src/present/formatter";
import { GrammarTraits } from "../src/convenience/morphology";

async function test() {
    console.log("--- Testing Formatter (Empty Results & Styles) ---\n");

    // 1. String Arrays
    const translations = ["write", "spell", "record"];
    console.log("Translations (default):", format(translations));
    console.log("Translations (empty):", format([]));
    console.log("");

    // 2. Syllables (joined test)
    const syllables = ["έ", "γρα", "ψε"];
    console.log("Syllables (dots):", format(syllables, { separator: "‧" }));
    console.log("");

    // 3. Grammar Traits
    const traits: Partial<GrammarTraits> = {
        person: "3",
        number: "singular",
        tense: "past",
        voice: "active"
    };
    console.log("Grammar (text):", format(traits));
    console.log("Grammar (empty):", format({}));
    console.log("");

    // 4. Stems
    const stems = {
        aliases: ["γράφ", "γραψ"],
        verb: { present: ["γράφ"], simple_past: ["γραψ"] }
    };
    console.log("Stems (text):", format(stems));
    console.log("Stems (empty):", format({ aliases: [] }));
    console.log("");

    // 5. Etymology
    const etym = [
        { lang: "grk-pro", form: "*grépʰō" },
        { lang: "el", form: "γράφω" }
    ];
    console.log("Etymology (text):", format(etym));
    console.log("Etymology (empty):", format([]));
    console.log("");

    // 6. null / undefined
    console.log("Null (text):", format(null));
    console.log("Null (ansi):", format(null, { mode: "ansi" }));
    console.log("Null (terminal-html):", format(null, { mode: "terminal-html" }));
    console.log("");

    // 7. Custom Style (The new templating system)
    registerStyle("upper", {
        array: (arr) => arr.length === 0 ? "NONE" : arr.join(" | ").toUpperCase(),
        grammar: (traits: Partial<GrammarTraits>) => "GRAMMAR: " + (format(traits) || "NONE").toUpperCase(),
        stems: (stems: any) => "STEMS: " + (stems.aliases.length === 0 ? "NONE" : stems.aliases.join("/").toUpperCase()),
        etymology: (steps: any) => steps.length === 0 ? "NONE" : steps.map((s: any) => s.form).join("...").toUpperCase(),
        senses: (senses: any) => senses.length === 0 ? "NONE" : senses.map((s: any) => s.gloss.toUpperCase()).join(" / "),
        nullValue: () => "VOID"
    });

    console.log("Custom Style 'upper':");
    console.log("Array Mapping:", format(translations, { mode: "upper" }));
    console.log("Null Mapping:", format(null, { mode: "upper" }));
    console.log("Empty Array:", format([], { mode: "upper" }));
    console.log("");

    console.log("--- Verification Complete ---");
}

test().catch(console.error);
