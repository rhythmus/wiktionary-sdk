/**
 * Multi-tier caching layer.
 *
 * L1: In-memory (transient, always available)
 * L2: Persistent (pluggable — IndexedDB for browser, file/SQLite for Node)
 * L3: Shared (pluggable — Redis or any external store)
 *
 * The engine remains agnostic: consumers inject L2/L3 adapters at init time.
 */

import { DEFAULT_CACHE_TTL_MS } from "./constants";

export interface CacheEntry<T> {
  value: T;
  created: number;
  ttl: number;
}

export interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

const DEFAULT_TTL = DEFAULT_CACHE_TTL_MS;

export class MemoryCache implements CacheAdapter {
  private store = new Map<string, { value: string; expires: number }>();
  private readonly maxEntries: number | null;

  constructor(opts?: { maxEntries?: number }) {
    const m = opts?.maxEntries;
    this.maxEntries = m != null && m > 0 ? Math.floor(m) : null;
  }

  private evictIfNeeded(): void {
    if (this.maxEntries == null) return;
    while (this.store.size > this.maxEntries) {
      const first = this.store.keys().next().value;
      if (first === undefined) break;
      this.store.delete(first);
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
    this.evictIfNeeded();
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export class TieredCache {
  private l1: MemoryCache;
  private l2: CacheAdapter | null;
  private l3: CacheAdapter | null;
  private defaultTtl: number;

  constructor(opts?: {
    l2?: CacheAdapter;
    l3?: CacheAdapter;
    defaultTtl?: number;
    /** Cap L1 entry count (FIFO eviction by insertion order). L2/L3 unchanged. */
    l1MaxEntries?: number;
  }) {
    this.l1 = new MemoryCache(
      opts?.l1MaxEntries != null ? { maxEntries: opts.l1MaxEntries } : undefined,
    );
    this.l2 = opts?.l2 ?? null;
    this.l3 = opts?.l3 ?? null;
    this.defaultTtl = opts?.defaultTtl ?? DEFAULT_TTL;
  }

  async get<T>(key: string): Promise<T | null> {
    const l1Val = await this.l1.get(key);
    if (l1Val !== null) {
      try {
        return JSON.parse(l1Val) as T;
      } catch {
        await this.l1.delete(key);
        return null;
      }
    }

    if (this.l2) {
      const l2Val = await this.l2.get(key);
      if (l2Val !== null) {
        let parsed: T;
        try {
          parsed = JSON.parse(l2Val) as T;
        } catch {
          await this.l2.delete(key);
          return null;
        }
        await this.l1.set(key, l2Val, this.defaultTtl);
        return parsed;
      }
    }

    if (this.l3) {
      const l3Val = await this.l3.get(key);
      if (l3Val !== null) {
        let parsed: T;
        try {
          parsed = JSON.parse(l3Val) as T;
        } catch {
          await this.l3.delete(key);
          return null;
        }
        await this.l1.set(key, l3Val, this.defaultTtl);
        if (this.l2) await this.l2.set(key, l3Val, this.defaultTtl);
        return parsed;
      }
    }

    return null;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtl;
    const serialized = JSON.stringify(value);
    await this.l1.set(key, serialized, ttl);
    if (this.l2) await this.l2.set(key, serialized, ttl);
    if (this.l3) await this.l3.set(key, serialized, ttl);
  }

  async delete(key: string): Promise<void> {
    await this.l1.delete(key);
    if (this.l2) await this.l2.delete(key);
    if (this.l3) await this.l3.delete(key);
  }

  async clear(): Promise<void> {
    await this.l1.clear();
    if (this.l2) await this.l2.clear();
    if (this.l3) await this.l3.clear();
  }
}

let globalCache: TieredCache | null = null;

export function getCache(): TieredCache {
  if (!globalCache) {
    globalCache = new TieredCache();
  }
  return globalCache;
}

export function configureCache(opts: {
  l2?: CacheAdapter;
  l3?: CacheAdapter;
  defaultTtl?: number;
  l1MaxEntries?: number;
}): TieredCache {
  globalCache = new TieredCache(opts);
  return globalCache;
}
