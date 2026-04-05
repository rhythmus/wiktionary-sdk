import { fetchWikitextEnWiktionary } from "../src/ingress/api";

async function dump(word: string) {
    const data = await fetchWikitextEnWiktionary(word);
    console.log(JSON.stringify(data, null, 2));
}

dump(process.argv[2] || "γράφω").catch(console.error);
