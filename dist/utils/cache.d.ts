/**
 * Simple in-memory cache utility for frequently accessed data
 * Helps reduce database queries for static or semi-static data
 */
declare class Cache {
    private cache;
    private defaultTTL;
    /**
     * Get cached data
     */
    get<T>(key: string): T | null;
    /**
     * Set cached data
     */
    set<T>(key: string, data: T, ttl?: number): void;
    /**
     * Delete cached data
     */
    delete(key: string): void;
    /**
     * Clear all cache
     */
    clear(): void;
    /**
     * Clear expired entries
     */
    cleanup(): void;
    /**
     * Get cache size
     */
    size(): number;
}
export declare const cache: Cache;
export {};
//# sourceMappingURL=cache.d.ts.map