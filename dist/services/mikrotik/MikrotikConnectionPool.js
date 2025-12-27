"use strict";
/**
 * Mikrotik Connection Pool & Cache
 * Reusable connections and aggressive caching for better performance
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikConnectionPool = void 0;
const node_routeros_1 = require("node-routeros");
const pool_1 = __importDefault(require("../../db/pool"));
class MikrotikConnectionPool {
    /**
     * Get Mikrotik settings from database (cached)
     */
    static async getMikrotikSettings() {
        const cacheKey = 'mikrotik_settings';
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('[MikrotikPool] Using cached settings');
            return cached;
        }
        try {
            const [rows] = await pool_1.default.query('SELECT host, port, username, password FROM mikrotik_settings WHERE is_active = 1 LIMIT 1');
            if (rows.length === 0) {
                // Try any settings
                const [anyRows] = await pool_1.default.query('SELECT host, port, username, password FROM mikrotik_settings LIMIT 1');
                if (anyRows.length === 0 || !anyRows[0]) {
                    return null;
                }
                const settings = {
                    host: anyRows[0].host,
                    port: anyRows[0].port || anyRows[0].api_port || 8728,
                    username: anyRows[0].username,
                    password: anyRows[0].password,
                };
                this.saveToCache(cacheKey, settings);
                return settings;
            }
            if (!rows[0]) {
                return null;
            }
            const settings = {
                host: rows[0].host,
                port: rows[0].port || rows[0].api_port || 8728,
                username: rows[0].username,
                password: rows[0].password,
            };
            this.saveToCache(cacheKey, settings);
            return settings;
        }
        catch (error) {
            console.error('[MikrotikPool] Error getting settings:', error);
            return null;
        }
    }
    /**
     * Execute Mikrotik command with timeout and caching
     */
    static async executeCommand(command, params = [], cacheKey, cacheTTL) {
        // Check cache first
        if (cacheKey) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.log(`[MikrotikPool] Cache HIT: ${cacheKey}`);
                return cached;
            }
        }
        const settings = await this.getMikrotikSettings();
        if (!settings) {
            throw new Error('Mikrotik not configured');
        }
        const api = new node_routeros_1.RouterOSAPI({
            host: settings.host,
            port: settings.port,
            user: settings.username,
            password: settings.password,
            timeout: this.CONNECTION_TIMEOUT
        });
        try {
            console.log(`[MikrotikPool] Connecting to ${settings.host}:${settings.port}...`);
            // Connect with timeout
            const connectPromise = api.connect();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), this.CONNECTION_TIMEOUT));
            await Promise.race([connectPromise, timeoutPromise]);
            console.log('[MikrotikPool] Connected');
            // Execute command with timeout
            const commandPromise = api.write(command, params);
            const commandTimeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Command timeout')), this.CONNECTION_TIMEOUT));
            const result = await Promise.race([commandPromise, commandTimeoutPromise]);
            api.close();
            // Save to cache
            if (cacheKey) {
                this.saveToCache(cacheKey, result, cacheTTL);
                console.log(`[MikrotikPool] Cached: ${cacheKey}`);
            }
            return result;
        }
        catch (error) {
            console.error('[MikrotikPool] Command error:', error);
            // Try to close connection
            try {
                api.close();
            }
            catch (e) {
                // Ignore
            }
            throw error;
        }
    }
    /**
     * Get from cache
     */
    static getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        const now = Date.now();
        const age = now - entry.timestamp;
        if (age > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Save to cache
     */
    static saveToCache(key, data, ttl) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    /**
     * Clear cache
     */
    static clearCache(pattern) {
        if (pattern) {
            // Clear specific pattern
            const keys = Array.from(this.cache.keys());
            keys.forEach(key => {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            });
            console.log(`[MikrotikPool] Cleared cache pattern: ${pattern}`);
        }
        else {
            // Clear all
            this.cache.clear();
            console.log('[MikrotikPool] Cleared all cache');
        }
    }
    /**
     * Get cache statistics
     */
    static getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
exports.MikrotikConnectionPool = MikrotikConnectionPool;
MikrotikConnectionPool.cache = new Map();
MikrotikConnectionPool.CACHE_TTL = 120000; // 2 minutes (aggressive caching)
MikrotikConnectionPool.CONNECTION_TIMEOUT = 3000; // 3 seconds (faster timeout)
exports.default = MikrotikConnectionPool;
//# sourceMappingURL=MikrotikConnectionPool.js.map