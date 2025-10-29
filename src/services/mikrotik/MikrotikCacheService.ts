/**
 * AGGRESSIVE CACHING SERVICE
 * Cache EVERYTHING from Mikrotik for INSTANT loading
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export class MikrotikCacheService {
  private static cache = new Map<string, CacheEntry<any>>();
  private static stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  
  // AGGRESSIVE TTL - Cache longer!
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes (was 60s)
  private static readonly PROFILES_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly ADDRESS_LIST_TTL = 3 * 60 * 1000; // 3 minutes
  private static readonly QUEUES_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get cached data
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Check if expired
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    console.log(`[Cache] HIT: ${key} (age: ${Math.round(age/1000)}s)`);
    return entry.data as T;
  }
  
  /**
   * Set cached data
   */
  static set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    };
    
    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
    
    console.log(`[Cache] SET: ${key} (ttl: ${Math.round(entry.ttl/1000)}s)`);
  }
  
  /**
   * Specialized cache methods
   */
  static getProfiles(mikrotikId: string): any[] | null {
    return this.get(`profiles:${mikrotikId}`);
  }
  
  static setProfiles(mikrotikId: string, profiles: any[]): void {
    this.set(`profiles:${mikrotikId}`, profiles, this.PROFILES_TTL);
  }
  
  static getAddressList(mikrotikId: string, listName: string): any[] | null {
    return this.get(`addresslist:${mikrotikId}:${listName}`);
  }
  
  static setAddressList(mikrotikId: string, listName: string, addresses: any[]): void {
    this.set(`addresslist:${mikrotikId}:${listName}`, addresses, this.ADDRESS_LIST_TTL);
  }
  
  static getQueues(mikrotikId: string): any[] | null {
    return this.get(`queues:${mikrotikId}`);
  }
  
  static setQueues(mikrotikId: string, queues: any[]): void {
    this.set(`queues:${mikrotikId}`, queues, this.QUEUES_TTL);
  }
  
  /**
   * Clear specific cache
   */
  static clear(key: string): void {
    this.cache.delete(key);
    console.log(`[Cache] CLEAR: ${key}`);
  }
  
  /**
   * Clear all cache
   */
  static clearAll(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
    console.log('[Cache] CLEARED ALL');
  }
  
  /**
   * Clear by pattern
   */
  static clearByPattern(pattern: string): void {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    this.stats.size = this.cache.size;
    console.log(`[Cache] CLEARED ${cleared} entries matching: ${pattern}`);
  }
  
  /**
   * Get cache stats
   */
  static getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * Get cache info
   */
  static getInfo(): any {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((Date.now() - entry.timestamp) / 1000),
      ttl: Math.round(entry.ttl / 1000),
      size: JSON.stringify(entry.data).length
    }));
    
    return {
      stats: this.getStats(),
      entries,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }
}

export default MikrotikCacheService;

