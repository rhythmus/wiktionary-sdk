/**
 * Optional: refresh test/fixtures/api-recordings/minimal-query.json from the live API.
 *
 *   npx tsx tools/refresh-api-recording.ts
 *
 * Requires network. Commit the JSON only after reviewing the diff (wikitext is large).
 */
import { writeFileSync } from "fs";
import { resolve } from "path";

const TITLE = process.argv[2] || "γράφω";
const OUT = resolve(__dirname, "../test/fixtures/api-recordings/minimal-query.json");

async function main() {
  const u = new URL("https://en.wiktionary.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("formatversion", "2");
  u.searchParams.set("origin", "*");
  u.searchParams.set("prop", "revisions|info");
  u.searchParams.set("rvprop", "content");
  u.searchParams.set("rvslots", "main");
  u.searchParams.set("redirects", "1");
  u.searchParams.set("titles", TITLE);

  const res = await fetch(u.toString(), {
    headers: { "User-Agent": "Wiktionary-SDK-test-recording/1.0 (dev; offline fixtures)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const page = j?.query?.pages?.[0];
  if (!page || page.missing) throw new Error("Page missing in API response");

  const minimal = {
    query: {
      pages: [
        {
          pageid: page.pageid,
          title: page.title,
          touched: page.touched,
          length: page.length,
          lastrevid: page.lastrevid,
          revisions: page.revisions,
        },
      ],
    },
  };

  writeFileSync(OUT, JSON.stringify(minimal, null, 2) + "\n", "utf-8");
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
