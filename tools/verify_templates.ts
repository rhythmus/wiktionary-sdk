import { format } from "../src/formatter";
import * as fs from "fs";
import * as yaml from "js-yaml";
import path from "path";

async function verify() {
    const yamlPath = path.join(__dirname, "../docs/mockups/dictionary-entry-v2.yaml");
    const doc = yaml.load(fs.readFileSync(yamlPath, "utf8")) as any;

    // Map Entry fields to RichEntry fields for the formatter guard
    const richEntry = {
        ...doc,
        headword: doc.form || doc.query,
        inflection_table: doc.inflection_table || {}
    };
    
    console.log("--- HTML Output (Standalone) ---");
    const html = format(richEntry, { mode: "html" });
    fs.writeFileSync("/tmp/premium_entry_test.html", html);
    console.log("Saved to /tmp/premium_entry_test.html");

    console.log("\n--- Markdown Output ---");
    const md = format(richEntry, { mode: "markdown" });
    fs.writeFileSync("/tmp/premium_entry_test.md", md);
    console.log("Saved to /tmp/premium_entry_test.md");
    console.log(md.substring(0, 1000));
}

verify();
