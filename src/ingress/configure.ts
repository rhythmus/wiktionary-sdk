import { configureRateLimiter, type RateLimiterConfig } from "./rate-limiter";
import { configureCache, type CacheAdapter } from "./cache";

export { configureRateLimiter, type RateLimiterConfig } from "./rate-limiter";
export { configureCache, type CacheAdapter } from "./cache";

/**
 * Unified SDK configuration — call once at startup before any `wiktionary()` calls.
 * All fields are optional; only provided values override their respective defaults.
 */
export interface SdkConfig {
  /** Rate limiter settings (interval, User-Agent, retry policy). */
  rateLimiter?: RateLimiterConfig;
  /** Cache tier settings (L2/L3 adapters, TTL, L1 capacity). */
  cache?: {
    l2?: CacheAdapter;
    l3?: CacheAdapter;
    defaultTtl?: number;
    l1MaxEntries?: number;
  };
}

/**
 * Configure SDK infrastructure (rate limiter, cache) in one call.
 * Safe to call multiple times; each call replaces the global singletons.
 *
 * ```ts
 * import { configureSdk } from "wiktionary-sdk";
 * configureSdk({
 *   rateLimiter: { minIntervalMs: 250, maxRetries429: 5 },
 *   cache: { defaultTtl: 60_000 },
 * });
 * ```
 */
export function configureSdk(config: SdkConfig): void {
  if (config.rateLimiter) configureRateLimiter(config.rateLimiter);
  if (config.cache) configureCache(config.cache);
}
