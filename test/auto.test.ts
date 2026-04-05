import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { lemma } from '../src/index';
import * as wc from '../src/wiktionary-core';
import * as api from '../src/ingress/api';

const FIXTURES_DIR = resolve(__dirname, 'fixtures');

vi.mock("../src/wiktionary-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/wiktionary-core")>();
  return {
    ...actual,
    wiktionary: vi.fn(),
  };
});

// lemma() uses the same wiktionary binding as wc; stub API for live fetches.
vi.mock("../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ingress/api")>();
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
  };
});

function emptyPage(title: string) {
  return {
    exists: false as const,
    title,
    wikitext: '',
    pageprops: {} as Record<string, unknown>,
    categories: [] as string[],
    langlinks: [] as { lang: string; title: string }[],
    info: {} as Record<string, unknown>,
    pageid: null as null,
  };
}

describe('Auto-discovery and PoS Filtering', () => {
  beforeEach(() => {
    const grafw = readFileSync(resolve(FIXTURES_DIR, 'γράφω.wikitext'), 'utf-8');
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null);
    vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
      const t = title.normalize('NFC');
      if (t === 'γράφω') {
        return {
          exists: true,
          title: 'γράφω',
          wikitext: grafw.normalize('NFC'),
          pageprops: {},
          pageid: 1,
          categories: [] as string[],
          langlinks: [] as { lang: string; title: string }[],
          info: {},
        };
      }
      if (t === 'bank') {
        return {
          exists: true,
          title: 'bank',
          wikitext: `==English==
===Noun===
# [[financial]] institution

==Dutch==
===Noun===
# [[bank]]

==German==
===Noun===
# [[Bank]]

==French==
===Noun===
# [[banque]]

==Swedish==
===Noun===
# [[bank]]

==Danish==
===Noun===
# [[bank]]
`,
          pageprops: {},
          pageid: 2,
          categories: [] as string[],
          langlinks: [] as { lang: string; title: string }[],
          info: {},
        };
      }
      if (t === 'banks') {
        return {
          exists: true,
          title: 'banks',
          wikitext: `==English==
===Noun===
{{inflection of|en|bank||p}}

# plural of [[bank]]
`,
          pageprops: {},
          pageid: 3,
          categories: [] as string[],
          langlinks: [] as { lang: string; title: string }[],
          info: {},
        };
      }
      return emptyPage(t);
    });
  });

  it('should auto-discover multiple languages for "bank"', async () => {
    const mockResult = {
      lexemes: [
        { id: "en:bank", language: "en", type: "LEXEME" },
        { id: "nl:bank", language: "nl", type: "LEXEME" },
        { id: "de:bank", language: "de", type: "LEXEME" },
        { id: "fr:bank", language: "fr", type: "LEXEME" },
        { id: "sv:bank", language: "sv", type: "LEXEME" },
        { id: "da:bank", language: "da", type: "LEXEME" }
      ]
    };
    vi.mocked(wc.wiktionary).mockResolvedValue(mockResult as any);

    const res = await wc.wiktionary({ query: 'bank' });
    expect(res.lexemes.length).toBeGreaterThan(0);
    const languages = res.lexemes.map(e => e.language);
    expect(languages).toContain('en');
    expect(languages.length).toBeGreaterThan(5); 
  });

  it('should filter by PoS for "bank" (verb only)', async () => {
    const mockResult = {
      lexemes: [
        { id: "en:bank#V", language: "en", part_of_speech: "verb" }
      ]
    };
    vi.mocked(wc.wiktionary).mockResolvedValue(mockResult as any);

    const res = await wc.wiktionary({ query: 'bank', pos: 'verb' });
    expect(res.lexemes.length).toBeGreaterThan(0);
    for (const lex of res.lexemes) {
      expect(lex.part_of_speech).toBe('verb');
    }
  });

  it('should handle "Auto" as explicit string for lang', async () => {
    const mockResult = {
      lexemes: [
        { id: "el:γράφω", language: "el" }
      ]
    };
    vi.mocked(wc.wiktionary).mockResolvedValue(mockResult as any);

    const res = await wc.wiktionary({ query: 'γράφω', lang: 'Auto' });
    expect(res.lexemes.some(e => e.language === 'el')).toBe(true);
  });

  it('should default to "Auto" for lemma()', async () => {
    const mockResult = {
      lexemes: [
        { id: "en:bank", language: "en", type: "LEXEME" }
      ]
    };
    vi.mocked(wc.wiktionary).mockResolvedValue(mockResult as any);
    const l = await lemma('bank');
    expect(l).toBe('bank');
  });

  it('should resolve lemma across languages in Auto mode', async () => {
    const mockResult = {
      lexemes: [
        { id: "en:banks", language: "en", type: "INFLECTED_FORM", form_of: { lemma: "bank" } }
      ]
    };
    vi.mocked(wc.wiktionary).mockResolvedValue(mockResult as any);

    const l = await lemma('banks');
    expect(l).toBe('bank');
  });
});
