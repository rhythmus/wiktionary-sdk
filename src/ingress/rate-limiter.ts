/**
 * MediaWiki API etiquette: request throttling and User-Agent management.
 *
 * - Default: max 1 request per 100ms (10 req/s) per Wikimedia guidelines.
 * - Custom User-Agent header.
 * - `proxyUrl` is **reserved**: it is stored for API compatibility but **not** applied to `fetch`.
 *   Use an HTTP proxy via your runtime (env `HTTP_PROXY`, reverse proxy, etc.) until explicit
 *   proxy support is implemented.
 */

import { DEFAULT_RATE_LIMIT_MIN_INTERVAL_MS } from "../infra/constants";

const DEFAULT_MIN_INTERVAL_MS = DEFAULT_RATE_LIMIT_MIN_INTERVAL_MS;
const DEFAULT_USER_AGENT =
  "Wiktionary SDK/1.0 (https://github.com/woutersoudan/wiktionary-fetch; wiktionary-fetch@example.com)";

export interface RateLimiterConfig {
  minIntervalMs?: number;
  userAgent?: string;
  /** Stored only; not wired to `fetch` — see module doc. */
  proxyUrl?: string;
  /**
   * When set, `throttle()` throws if the wait queue already has this many pending waiters
   * (after the current slot). Default: unlimited.
   */
  maxQueue?: number;
}

export class RateLimiter {
  private minInterval: number;
  private lastRequestTime = 0;
  private queue: Array<() => void> = [];
  private processing = false;
  readonly userAgent: string;
  readonly proxyUrl: string | null;
  private maxQueue: number | null;

  constructor(config?: RateLimiterConfig) {
    this.minInterval = config?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.userAgent = config?.userAgent ?? DEFAULT_USER_AGENT;
    this.proxyUrl = config?.proxyUrl ?? null;
    this.maxQueue =
      config?.maxQueue != null && config.maxQueue > 0 ? Math.floor(config.maxQueue) : null;
  }

  async throttle(): Promise<void> {
    if (this.maxQueue != null && this.queue.length >= this.maxQueue) {
      throw new Error(`Rate limiter queue exceeded (max ${this.maxQueue} pending)`);
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.minInterval) {
        await new Promise((r) => setTimeout(r, this.minInterval - elapsed));
      }
      this.lastRequestTime = Date.now();
      const next = this.queue.shift();
      if (next) next();
    }
    this.processing = false;
  }

  getHeaders(): Record<string, string> {
    return {
      "User-Agent": this.userAgent,
      Accept: "application/json",
    };
  }
}

let globalLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!globalLimiter) {
    globalLimiter = new RateLimiter();
  }
  return globalLimiter;
}

export function configureRateLimiter(config: RateLimiterConfig): RateLimiter {
  globalLimiter = new RateLimiter(config);
  return globalLimiter;
}
