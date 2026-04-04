/**
 * Manual smoke check against the live API (not run in CI).
 * Usage from repo root: `npx tsx tools/verify_v2.ts`
 */
import { richEntry, wiktionary } from "../src/index";

async function run() {
  console.log("--- Manual schema smoke check (tools/verify_v2.ts) ---");
  try {
    const query = "γράφω";
    const result = await wiktionary({ query, lang: "el", enrich: false });
    const lexeme = result.lexemes[0];
    if (!lexeme) {
      console.log("No lexemes returned.");
      return;
    }

    console.log("Lexeme ID:", lexeme.id);
    console.log("Aspect:", lexeme.headword_morphology?.aspect);
    console.log("Voice:", lexeme.headword_morphology?.voice);
    console.log("Pronunciation Romanization:", lexeme.pronunciation?.romanization);
    console.log("Inflection Table Ref:", lexeme.inflection_table_ref?.template_name);
    console.log("Anagrams:", lexeme.anagrams);
    console.log("Usage Notes:", lexeme.usage_notes);
    console.log("References:", lexeme.references);

    const richRows = await richEntry(query, "el");
    const rich = richRows[0]?.value;
    if (rich) {
      console.log("\n--- Rich Entry (first row) ---");
      console.log("Morphology Aspect:", rich.morphology?.aspect);
      console.log("Relations Coordinate Terms:", rich.relations?.coordinate_terms);
      console.log("Usage Notes:", rich.usage_notes);
    }
  } catch (e) {
    console.error("Verification failed:", e);
    process.exitCode = 1;
  }
}

void run();
