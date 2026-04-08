/**
 * Central defaults for API behaviour, caching, and sort priority.
 * Library `wiktionary()` defaults differ from the HTTP server in some cases — see JSDoc.
 */

/** Used when `sort: "priority"` (lower runs first; unlisted languages use 100). */
export const LANG_PRIORITY: Record<string, number> = {
    el: 1,
    grc: 2,
    en: 3,
};

/**
 * Default `lang` query param for `GET /api/fetch` when omitted.
 * The programmatic API defaults to `"Auto"` instead.
 */
export const SERVER_DEFAULT_WIKI_LANG = "el";

/** Default L1/L2/L3 TTL when `configureCache` does not override (ms). */
export const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Default minimum spacing between MediaWiki API calls (ms).
 * Wikimedia guideline is max 200 req/s for bot-identified traffic, but browser
 * contexts cannot set a proper User-Agent, so servers apply stricter limits.
 * 200ms (5 req/s) provides headroom against 429 responses.
 */
export const DEFAULT_RATE_LIMIT_MIN_INTERVAL_MS = 200;
