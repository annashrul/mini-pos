/**
 * Simple in-memory server-side cache with TTL and tag-based invalidation.
 * Works across all server actions without external dependencies.
 *
 * Usage:
 *   const data = await serverCache.get("products:list:page1", () => fetchFromDB(), { ttl: 30, tags: ["products"] });
 *   serverCache.invalidate("products"); // invalidates all entries tagged with "products"
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  tags: string[];
}

class ServerCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private tagIndex = new Map<string, Set<string>>(); // tag -> set of cache keys
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Get cached data or fetch & cache it.
   * @param key - Unique cache key
   * @param fetcher - Async function to fetch data if not cached
   * @param options - TTL in seconds (default: 30), tags for invalidation
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number; tags?: string[] } = {},
  ): Promise<T> {
    const { ttl = 30, tags = [] } = options;

    // Check cache
    const cached = this.store.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.delete(firstKey);
    }

    // Store in cache
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttl * 1000,
      tags,
    });

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(key);
    }

    return data;
  }

  /** Invalidate all entries matching any of the given tags */
  invalidate(...tags: string[]) {
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (!keys) continue;
      for (const key of keys) {
        this.store.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  /** Delete a specific cache key */
  private delete(key: string) {
    const entry = this.store.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
      this.store.delete(key);
    }
  }

  /** Get cache stats (for debugging) */
  stats() {
    let expired = 0;
    const now = Date.now();
    for (const entry of this.store.values()) {
      if (entry.expiresAt <= now) expired++;
    }
    return { size: this.store.size, expired, tags: this.tagIndex.size };
  }
}

// Singleton instance — persists across requests in the same server process
export const serverCache = new ServerCache();

/**
 * Helper to build cache key from params object.
 * Produces deterministic key regardless of property order.
 */
export function cacheKey(prefix: string, params: Record<string, unknown> = {}): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return sorted ? `${prefix}:${sorted}` : prefix;
}
