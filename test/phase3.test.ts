import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCache, TieredCache, type CacheAdapter } from "../src/ingress/cache";
import { RateLimiter } from "../src/ingress/rate-limiter";

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

  it("evicts oldest entries when maxEntries is set (L1 cap)", async () => {
    const capped = new MemoryCache({ maxEntries: 2 });
    await capped.set("a", "1", 60_000);
    await capped.set("b", "2", 60_000);
    await capped.set("c", "3", 60_000);
    expect(await capped.get("a")).toBeNull();
    expect(await capped.get("b")).toBe("2");
    expect(await capped.get("c")).toBe("3");
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

  it("treats corrupt L1 JSON as a miss and drops the key (§13.3)", async () => {
    const tiered = new TieredCache();
    const l1 = (tiered as any).l1 as MemoryCache;
    await l1.set("bad", "{ not-json", 60_000);
    expect(await tiered.get("bad")).toBeNull();
    expect(await l1.get("bad")).toBeNull();
  });

  it("treats corrupt L2 JSON as a miss and deletes L2 key (§13.3)", async () => {
    const l2 = new MemoryCache();
    await l2.set("bad", "undefined", 60_000);
    const tiered = new TieredCache({ l2 });
    expect(await tiered.get("bad")).toBeNull();
    expect(await l2.get("bad")).toBeNull();
  });

  it("respects l1MaxEntries on TieredCache", async () => {
    const tiered = new TieredCache({ l1MaxEntries: 2 });
    await tiered.set("a", 1);
    await tiered.set("b", 2);
    await tiered.set("c", 3);
    const l1 = (tiered as any).l1 as MemoryCache;
    expect(l1.size).toBe(2);
    expect(await tiered.get("a")).toBeNull();
    expect(await tiered.get("b")).toBe(2);
    expect(await tiered.get("c")).toBe(3);
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

  it("spaces concurrent throttle calls by minIntervalMs (§13.4)", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 40 });
    const start = Date.now();
    await Promise.all([limiter.throttle(), limiter.throttle(), limiter.throttle(), limiter.throttle()]);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(3 * 40 - 5);
  });

  it("leaves processing false after queue drains (§13.4)", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 1 });
    await Promise.all([limiter.throttle(), limiter.throttle()]);
    expect((limiter as any).processing).toBe(false);
    expect((limiter as any).queue.length).toBe(0);
  });

  it("throws when maxQueue would be exceeded (§13.4)", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 50, maxQueue: 2 });
    const noop = () => {};
    (limiter as any).queue.push(noop, noop);
    await expect(limiter.throttle()).rejects.toThrow(/queue exceeded/);
    (limiter as any).queue.length = 0;
  });
});
