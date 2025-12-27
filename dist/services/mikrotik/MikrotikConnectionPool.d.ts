/**
 * Mikrotik Connection Pool & Cache
 * Reusable connections and aggressive caching for better performance
 */
interface MikrotikConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}
export declare class MikrotikConnectionPool {
    private static cache;
    private static CACHE_TTL;
    private static CONNECTION_TIMEOUT;
    /**
     * Get Mikrotik settings from database (cached)
     */
    static getMikrotikSettings(): Promise<MikrotikConfig | null>;
    /**
     * Execute Mikrotik command with timeout and caching
     */
    static executeCommand(command: string, params?: string[], cacheKey?: string, cacheTTL?: number): Promise<any>;
    /**
     * Get from cache
     */
    private static getFromCache;
    /**
     * Save to cache
     */
    private static saveToCache;
    /**
     * Clear cache
     */
    static clearCache(pattern?: string): void;
    /**
     * Get cache statistics
     */
    static getCacheStats(): {
        size: number;
        keys: string[];
    };
}
export default MikrotikConnectionPool;
//# sourceMappingURL=MikrotikConnectionPool.d.ts.map