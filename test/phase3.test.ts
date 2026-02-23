import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCache, TieredCache, type CacheAdapter } from "../src/cache";
import { RateLimiter } from "../src/rate-limiter";

describe("Phase 3.2: MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  it("stores and retrieves values", async () => {
    await cache.set("key1", "value1", 60_000);
    expect(await cache.get("key1")).toBe("value1");
  });

  it("returns null for missing keys", async () => {
    expect(await cache.get("nonexistent")).toBeNull();
  });

  it("expires entries", async () => {
    await cache.set("key1", "value1", 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get("key1")).toBeNull();
  });

  it("deletes entries", async () => {
    await cache.set("key1", "value1", 60_000);
    await cache.delete("key1");
    expect(await cache.get("key1")).toBeNull();
  });

  it("clears all entries", async () => {
    await cache.set("a", "1", 60_000);
    await cache.set("b", "2", 60_000);
    await cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe("Phase 3.2: TieredCache", () => {
  it("falls through from L1 to L2", async () => {
    const l2: CacheAdapter = new MemoryCache();
    await l2.set("key", JSON.stringify({ x: 1 }), 60_000);
    const tiered = new TieredCache({ l2 });

    const result = await tiered.get<{ x: number }>("key");
    expect(result).toEqual({ x: 1 });
  });

  it("promotes L2 hits to L1", async () => {
    const l2 = new MemoryCache();
    await l2.set("key", JSON.stringify("hello"), 60_000);
    const tiered = new TieredCache({ l2 });

    await tiered.get("key");
    // Second hit should come from L1 (we can verify by clearing L2)
    await l2.clear();
    expect(await tiered.get("key")).toBe("hello");
  });

  it("writes to all tiers", async () => {
    const l2 = new MemoryCache();
    const tiered = new TieredCache({ l2 });

    await tiered.set("key", { data: true });
    expect(await l2.get("key")).not.toBeNull();
  });
});

describe("Phase 3.3: RateLimiter", () => {
  it("provides headers with User-Agent", () => {
    const limiter = new RateLimiter({ userAgent: "TestBot/1.0" });
    const headers = limiter.getHeaders();
    expect(headers["User-Agent"]).toBe("TestBot/1.0");
    expect(headers["Accept"]).toBe("application/json");
  });

  it("throttles sequential calls", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 50 });
    const start = Date.now();
    await limiter.throttle();
    await limiter.throttle();
    await limiter.throttle();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it("stores proxy config", () => {
    const limiter = new RateLimiter({ proxyUrl: "http://proxy:8080" });
    expect(limiter.proxyUrl).toBe("http://proxy:8080");
  });
});
