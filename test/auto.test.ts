import { describe, it, expect, vi } from 'vitest';
import { wiktionary, lemma } from '../src/index';

// Mock the main wiktionary function
vi.mock("../src/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/index")>();
  return {
    ...actual,
    wiktionary: vi.fn(),
  };
});

describe('Auto-discovery and PoS Filtering', () => {
  it('should auto-discover multiple languages for "bank"', async () => {
    const mockResult = {
      entries: [
        { id: "en:bank", language: "en", type: "LEXEME" },
        { id: "nl:bank", language: "nl", type: "LEXEME" },
        { id: "de:bank", language: "de", type: "LEXEME" },
        { id: "fr:bank", language: "fr", type: "LEXEME" },
        { id: "sv:bank", language: "sv", type: "LEXEME" },
        { id: "da:bank", language: "da", type: "LEXEME" }
      ]
    };
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);

    const res = await wiktionary({ query: 'bank' });
    expect(res.entries.length).toBeGreaterThan(0);
    const languages = res.entries.map(e => e.language);
    expect(languages).toContain('en');
    expect(languages.length).toBeGreaterThan(5); 
  });

  it('should filter by PoS for "bank" (verb only)', async () => {
    const mockResult = {
      entries: [
        { id: "en:bank#V", language: "en", part_of_speech: "verb" }
      ]
    };
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);

    const res = await wiktionary({ query: 'bank', pos: 'verb' });
    expect(res.entries.length).toBeGreaterThan(0);
    for (const entry of res.entries) {
      expect(entry.part_of_speech).toBe('verb');
    }
  });

  it('should handle "Auto" as explicit string for lang', async () => {
    const mockResult = {
      entries: [
        { id: "el:γράφω", language: "el" }
      ]
    };
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);

    const res = await wiktionary({ query: 'γράφω', lang: 'Auto' });
    expect(res.entries.some(e => e.language === 'el')).toBe(true);
  });

  it('should default to "Auto" for lemma()', async () => {
    const mockResult = {
      entries: [
        { id: "en:bank", language: "en", type: "LEXEME" }
      ]
    };
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);
    const l = await lemma('bank');
    expect(l).toBe('bank');
  });

  it('should resolve lemma across languages in Auto mode', async () => {
    const mockResult = {
      entries: [
        { id: "en:banks", language: "en", type: "INFLECTED_FORM", form_of: { lemma: "bank" } }
      ]
    };
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);

    const l = await lemma('banks');
    expect(l).toBe('bank');
  });
});
