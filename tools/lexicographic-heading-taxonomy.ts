#!/usr/bin/env npx tsx
/**
 * Prints heading→taxonomy coverage stats (families, section slug count).
 * Source: `src/lexicographic-headings.ts`.
 */
import { getLexicographicTaxonomyStats } from "../src/parse/lexicographic-headings";

const s = getLexicographicTaxonomyStats();
console.log(JSON.stringify(s, null, 2));
