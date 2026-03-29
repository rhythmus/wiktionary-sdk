import { wiktionary, richEntry } from "./src/index";
import { YAML } from "./src/formatter"; // Assuming YAML formatter exists

async function run() {
    console.log("--- Verifying v2 Schema Implementation ---");
    try {
        const query = "γράφω";
        const result = await wiktionary({ query, lang: "el" });
        const entry = result.entries[0];

        console.log("Entry ID:", entry.id);
        console.log("Aspect:", entry.headword_morphology?.aspect);
        console.log("Voice:", entry.headword_morphology?.voice);
        console.log("Pronunciation Romanization:", entry.pronunciation?.romanization);
        console.log("Inflection Table Ref:", entry.inflection_table_ref?.template_name);
        console.log("Anagrams:", entry.anagrams);
        console.log("Usage Notes:", entry.usage_notes);
        console.log("References:", entry.references);
        
        const rich = await richEntry(query, "el");
        if (rich) {
            console.log("\n--- Rich Entry (Partial) ---");
            console.log("Morphology Aspect:", rich.morphology?.aspect);
            console.log("Relations Coordinate Terms:", rich.relations?.coordinate_terms);
            console.log("Usage Notes:", rich.usage_notes);
        }

    } catch (e) {
        console.error("Verification failed:", e);
    }
}

run();
