import { 
    lemma, ipa, hyphenate, synonyms, antonyms, derivedTerms, relatedTerms, 
    partOfSpeech, etymology, morphology, conjugate, decline, pronounce, 
    translate, richEntry 
} from "../src/convenience";
import { format } from "../src/present/formatter";

async function inspect(word: string, lang: any = "el") {
    console.log(`\n=== Inspecting: "${word}" (${lang}) ===\n`);

    const rich = await richEntry(word, lang);
    if (rich) {
        console.log(format(rich, { mode: "ansi" }));
    } else {
        console.log("Failed to fetch rich entry.");
    }
    
    console.log("\n============================\n");
}

async function run() {
    await inspect("γράφω");
    await inspect("βιβλίο");
}

run().catch(console.error);
