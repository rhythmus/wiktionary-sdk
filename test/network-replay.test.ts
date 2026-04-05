import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";
import { normalizeWiktionaryQueryPage, mwFetchJson } from "../src/ingress/api";

const recordingPath = resolve(__dirname, "fixtures/api-recordings/minimal-query.json");

describe("offline API recording replay", () => {
  it("normalizeWiktionaryQueryPage matches fetchWikitext shape for fixture JSON", () => {
    const recording = JSON.parse(readFileSync(recordingPath, "utf-8"));
    const page = recording.query.pages[0];
    const r = normalizeWiktionaryQueryPage(page, "SnapshotLemma");
    expect(r.exists).toBe(true);
    expect(r.title).toBe("SnapshotLemma");
    expect(r.wikitext).toContain("==Greek==");
    expect(r.wikitext).toContain("{{el-verb}}");
    expect(r.pageid).toBe(999001);
  });
});

describe.skipIf(!process.env.WIKT_TEST_LIVE)("live MediaWiki sanity (opt-in)", () => {
  it("fetches one en.wiktionary page JSON", async () => {
    const j = await mwFetchJson("https://en.wiktionary.org/w/api.php", {
      action: "query",
      format: "json",
      formatversion: "2",
      origin: "*",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
      titles: "γράφω",
    });
    const page = j?.query?.pages?.[0];
    expect(page?.missing).not.toBe(true);
    const r = normalizeWiktionaryQueryPage(page, "γράφω");
    expect(r.exists).toBe(true);
    expect(r.wikitext.length).toBeGreaterThan(50);
  });
});
