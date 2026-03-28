import { describe, it, expect } from 'vitest';
import { wiktionary, lemma } from '../src/index';

describe('Auto-discovery and PoS Filtering', () => {
  it('should auto-discover multiple languages for "bank"', async () => {
    const res = await wiktionary({ query: 'bank' });
    expect(res.entries.length).toBeGreaterThan(0);
    const languages = res.entries.map(e => e.language);
    expect(languages).toContain('en');
    // "bank" is also Dutch, German, etc.
    expect(languages.length).toBeGreaterThan(5); 
  });

  it('should filter by PoS for "bank" (verb only)', async () => {
    const res = await wiktionary({ query: 'test', pos: 'verb' });
    expect(res.entries.length).toBeGreaterThan(0);
    for (const entry of res.entries) {
      expect(entry.part_of_speech).toBe('verb');
    }
  });

  it('should handle "Auto" as explicit string for lang', async () => {
    const res = await wiktionary({ query: 'γράφω', lang: 'Auto' });
    expect(res.entries.some(e => e.language === 'el')).toBe(true);
  });

  it('should default to "Auto" for lemma()', async () => {
    const l = await lemma('bank');
    expect(l).toBe('bank');
  });

  it('should resolve lemma across languages in Auto mode', async () => {
    // "banks" (English) -> "bank"
    const l = await lemma('banks');
    expect(l).toBe('bank');
  });
});
