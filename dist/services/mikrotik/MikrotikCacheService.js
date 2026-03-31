"use strict";
/**
 * AGGRESSIVE CACHING SERVICE
 * Cache EVERYTHING from Mikrotik for INSTANT loading
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikCacheService = void 0;
class MikrotikCacheService {
    /**
     * Get cached data
     */
    static get(key) {
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
        console.log(`[Cache] HIT: ${key} (age: ${Math.round(age / 1000)}s)`);
        return entry.data;
    }
    /**
     * Set cached data
     */
    static set(key, data, ttl) {
        const entry = {
            data,
            timestamp: Date.now(),
            ttl: ttl || this.DEFAULT_TTL
        };
        this.cache.set(key, entry);
        this.stats.size = this.cache.size;
        console.log(`[Cache] SET: ${key} (ttl: ${Math.round(entry.ttl / 1000)}s)`);
    }
    /**
     * Specialized cache methods
     */
    static getProfiles(mikrotikId) {
        return this.get(`profiles:${mikrotikId}`);
    }
    static setProfiles(mikrotikId, profiles) {
        this.set(`profiles:${mikrotikId}`, profiles, this.PROFILES_TTL);
    }
    static getAddressList(mikrotikId, listName) {
        return this.get(`addresslist:${mikrotikId}:${listName}`);
    }
    static setAddressList(mikrotikId, listName, addresses) {
        this.set(`addresslist:${mikrotikId}:${listName}`, addresses, this.ADDRESS_LIST_TTL);
    }
    static getQueues(mikrotikId) {
        return this.get(`queues:${mikrotikId}`);
    }
    static setQueues(mikrotikId, queues) {
        this.set(`queues:${mikrotikId}`, queues, this.QUEUES_TTL);
    }
    /**
     * Clear specific cache
     */
    static clear(key) {
        this.cache.delete(key);
        console.log(`[Cache] CLEAR: ${key}`);
    }
    /**
     * Clear all cache
     */
    static clearAll() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, size: 0 };
        console.log('[Cache] CLEARED ALL');
    }
    /**
     * Clear by pattern
     */
    static clearByPattern(pattern) {
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
    static getStats() {
        return { ...this.stats };
    }
    /**
     * Get cache info
     */
    static getInfo() {
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
exports.MikrotikCacheService = MikrotikCacheService;
MikrotikCacheService.cache = new Map();
MikrotikCacheService.stats = { hits: 0, misses: 0, size: 0 };
// AGGRESSIVE TTL - Cache longer!
MikrotikCacheService.DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes (was 60s)
MikrotikCacheService.PROFILES_TTL = 10 * 60 * 1000; // 10 minutes
MikrotikCacheService.ADDRESS_LIST_TTL = 3 * 60 * 1000; // 3 minutes
MikrotikCacheService.QUEUES_TTL = 5 * 60 * 1000; // 5 minutes
exports.default = MikrotikCacheService;
//# sourceMappingURL=MikrotikCacheService.js.map