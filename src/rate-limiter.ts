/**
 * MediaWiki API etiquette: request throttling and User-Agent management.
 *
 * - Default: max 1 request per 100ms (10 req/s) per Wikimedia guidelines.
 * - Custom User-Agent header.
 * - Optional proxy support for high-volume batch processing.
 */

const DEFAULT_MIN_INTERVAL_MS = 100;
const DEFAULT_USER_AGENT =
  "WiktionaryFetch/1.0 (https://github.com/woutersoudan/wiktionary-fetch; wiktionary-fetch@example.com)";

export interface RateLimiterConfig {
  minIntervalMs?: number;
  userAgent?: string;
  proxyUrl?: string;
}

export class RateLimiter {
  private minInterval: number;
  private lastRequestTime = 0;
  private queue: Array<() => void> = [];
  private processing = false;
  readonly userAgent: string;
  readonly proxyUrl: string | null;

  constructor(config?: RateLimiterConfig) {
    this.minInterval = config?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.userAgent = config?.userAgent ?? DEFAULT_USER_AGENT;
    this.proxyUrl = config?.proxyUrl ?? null;
  }

  async throttle(): Promise<void> {
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
