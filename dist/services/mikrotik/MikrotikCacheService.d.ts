/**
 * AGGRESSIVE CACHING SERVICE
 * Cache EVERYTHING from Mikrotik for INSTANT loading
 */
interface CacheStats {
    hits: number;
    misses: number;
    size: number;
}
export declare class MikrotikCacheService {
    private static cache;
    private static stats;
    private static readonly DEFAULT_TTL;
    private static readonly PROFILES_TTL;
    private static readonly ADDRESS_LIST_TTL;
    private static readonly QUEUES_TTL;
    /**
     * Get cached data
     */
    static get<T>(key: string): T | null;
    /**
     * Set cached data
     */
    static set<T>(key: string, data: T, ttl?: number): void;
    /**
     * Specialized cache methods
     */
    static getProfiles(mikrotikId: string): any[] | null;
    static setProfiles(mikrotikId: string, profiles: any[]): void;
    static getAddressList(mikrotikId: string, listName: string): any[] | null;
    static setAddressList(mikrotikId: string, listName: string, addresses: any[]): void;
    static getQueues(mikrotikId: string): any[] | null;
    static setQueues(mikrotikId: string, queues: any[]): void;
    /**
     * Clear specific cache
     */
    static clear(key: string): void;
    /**
     * Clear all cache
     */
    static clearAll(): void;
    /**
     * Clear by pattern
     */
    static clearByPattern(pattern: string): void;
    /**
     * Get cache stats
     */
    static getStats(): CacheStats;
    /**
     * Get cache info
     */
    static getInfo(): any;
}
export default MikrotikCacheService;
//# sourceMappingURL=MikrotikCacheService.d.ts.map