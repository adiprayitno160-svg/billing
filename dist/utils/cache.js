"use strict";
/**
 * Simple in-memory cache utility for frequently accessed data
 * Helps reduce database queries for static or semi-static data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
class Cache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
    }
    /**
     * Get cached data
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Set cached data
     */
    set(key, data, ttl) {
        const expiresAt = Date.now() + (ttl || this.defaultTTL);
        this.cache.set(key, { data, expiresAt });
    }
    /**
     * Delete cached data
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Clear expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
}
// Singleton instance
exports.cache = new Cache();
// Auto cleanup every 10 minutes
setInterval(() => {
    exports.cache.cleanup();
}, 10 * 60 * 1000);
//# sourceMappingURL=cache.js.map