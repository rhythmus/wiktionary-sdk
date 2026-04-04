import { describe, it, expect, vi } from "vitest";
import { parallelMap } from "../src/utils";

describe("parallelMap", () => {
  it("runs all items when concurrency is Infinity", async () => {
    const out = await parallelMap([1, 2, 3], Infinity, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6]);
  });

  it("respects a finite concurrency cap", async () => {
    let inFlight = 0;
    let maxSeen = 0;
    const delays = [30, 10, 20, 5];
    const results = await parallelMap(delays, 2, async (ms, i) => {
      inFlight++;
      maxSeen = Math.max(maxSeen, inFlight);
      await new Promise((r) => setTimeout(r, ms));
      inFlight--;
      return i;
    });
    expect(results).toEqual([0, 1, 2, 3]);
    expect(maxSeen).toBeLessThanOrEqual(2);
  });

  it("treats non-positive concurrency as unbounded", async () => {
    const spy = vi.fn(async (x: number) => x);
    await parallelMap([1, 2], 0, spy);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
