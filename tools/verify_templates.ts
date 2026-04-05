import { richEntry } from "../src/convenience";
import { format } from "../src/present/formatter";
import * as fs from "fs";
import * as yaml from "js-yaml";
import path from "path";

async function verify() {
    const query = process.argv[2];
    let data: any;

    if (query) {
        console.log(`Fetching live data for: ${query}...`);
        data = await richEntry(query);
        if (!data) {
            console.error(`Error: Could not find entry for ${query}`);
            process.exit(1);
        }
    } else {
        const yamlPath = path.join(__dirname, "../docs/mockups/dictionary-entry-v2.yaml");
        const doc = yaml.load(fs.readFileSync(yamlPath, "utf8")) as any;
        data = {
            ...doc,
            headword: doc.form || doc.query,
            inflection_table: doc.inflection_table || {}
        };
    }
    
    console.log("--- HTML Output ---");
    const html = format(data, { mode: "html" });
    fs.writeFileSync("/tmp/premium_entry_test.html", html);
    console.log("Saved to /tmp/premium_entry_test.html");

    console.log("\n--- Markdown Output ---");
    const md = format(data, { mode: "markdown" });
    fs.writeFileSync("/tmp/premium_entry_test.md", md);
    console.log("Saved to /tmp/premium_entry_test.md");
    console.log(md.substring(0, 1000));
}

verify();
