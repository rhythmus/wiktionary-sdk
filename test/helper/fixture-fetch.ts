import { readFileSync } from "fs";
import { resolve } from "path";
import { vi } from "vitest";
import type { fetchWikitextEnWiktionary } from "../../src/ingress/api";

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

function emptyPage(title: string) {
  return {
    exists: false,
    title,
    wikitext: "",
    pageprops: {},
    categories: [],
    images: [],
    page_links: [],
    external_links: [],
    langlinks: [],
    info: {},
    pageid: null,
  };
}

export function readFixtureWikitext(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.wikitext`), "utf-8");
}

export function loadFixtureByWordVariants(word: string): string {
  const variants = [word.normalize("NFD"), word.normalize("NFC"), word];
  for (const variant of variants) {
    try {
      const data = readFixtureWikitext(variant);
      if (data) return data;
    } catch {
      // try next normalization variant
    }
  }
  return "";
}

export function stubSingleTitleToFixture(
  fetchFn: typeof fetchWikitextEnWiktionary,
  title: string,
  fixtureName: string
): void {
  const wikitext = readFixtureWikitext(fixtureName).normalize("NFC");
  vi.mocked(fetchFn).mockImplementation(async (requestedTitle: string) => {
    if (requestedTitle.normalize("NFC") !== title.normalize("NFC")) {
      return emptyPage(requestedTitle);
    }
    return {
      exists: true,
      title,
      wikitext,
      pageprops: {},
      categories: [],
      images: [],
      page_links: [],
      external_links: [],
      langlinks: [],
      info: {},
      pageid: 1,
    };
  });
}
