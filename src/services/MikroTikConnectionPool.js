"use strict";
/**
 * MikroTik Connection Pool Manager
 * Manages multiple persistent connections to different MikroTik routers
 * to prevent port exhaustion and improve performance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mikrotikPool = void 0;
const routeros_api_1 = require("routeros-api");
class MikroTikConnection {
    constructor(config) {
        this.api = null;
        this.isConnected = false;
        this.lastActivity = 0;
        this.connectionPromise = null;
        this.config = config;
        this.lastActivity = Date.now();
    }
    async connect() {
        if (this.isConnected && this.api)
            return;
        if (this.connectionPromise)
            return this.connectionPromise;
        this.connectionPromise = (async () => {
            console.log(`[MikroTikPool] Connecting to ${this.config.host}:${this.config.port}...`);
            this.api = new routeros_api_1.RouterOSAPI({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password,
                timeout: 30000,
                keepalive: true
            });
            try {
                await this.api.connect();
                this.isConnected = true;
                this.lastActivity = Date.now();
                this.api.on('error', (err) => {
                    console.error(`[MikroTikPool] Connection error (${this.config.host}):`, err.message);
                    this.isConnected = false;
                });
                this.api.on('close', () => {
                    this.isConnected = false;
                });
            }
            catch (err) {
                this.isConnected = false;
                this.api = null;
                throw err;
            }
            finally {
                this.connectionPromise = null;
            }
        })();
        return this.connectionPromise;
    }
    async disconnect() {
        if (this.api) {
            try {
                await this.api.close();
            }
            catch (e) { }
            this.api = null;
        }
        this.isConnected = false;
    }
}
class MikroTikPoolManager {
    constructor() {
        this.connections = new Map();
        this.cache = new Map();
        this.defaultCacheTTL = 30000;
        // Cleanup idle connections
        setInterval(() => this.cleanupIdleConnections(), 60000);
    }
    static getInstance() {
        if (!MikroTikPoolManager.instance) {
            MikroTikPoolManager.instance = new MikroTikPoolManager();
        }
        return MikroTikPoolManager.instance;
    }
    getConnectionKey(config) {
        return `${config.host}:${config.port}:${config.username}:${config.password}`;
    }
    cleanupIdleConnections() {
        const now = Date.now();
        for (const [key, conn] of this.connections.entries()) {
            if (conn.isConnected && now - conn.lastActivity > 300000) { // 5 minutes idle
                console.log(`[MikroTikPool] Closing idle connection: ${key}`);
                conn.disconnect();
            }
        }
    }
    async execute(config, command, params = [], cacheKey, cacheTTL) {
        const fullCacheKey = cacheKey ? `${this.getConnectionKey(config)}:${cacheKey}` : null;
        // Check cache
        if (fullCacheKey) {
            const cached = this.getFromCache(fullCacheKey);
            if (cached !== null)
                return cached;
        }
        const key = this.getConnectionKey(config);
        let conn = this.connections.get(key);
        if (!conn) {
            conn = new MikroTikConnection(config);
            this.connections.set(key, conn);
        }
        await conn.connect();
        if (!conn.api)
            throw new Error(`Failed to initialize API for ${config.host}`);
        conn.lastActivity = Date.now();
        try {
            const result = await conn.api.write(command, params);
            if (fullCacheKey) {
                this.setCache(fullCacheKey, result, cacheTTL);
            }
            return result;
        }
        catch (error) {
            if (error.message?.includes('closed') || error.message?.includes('timeout')) {
                conn.isConnected = false;
                await conn.connect();
                if (conn.api)
                    return await conn.api.write(command, params);
            }
            throw error;
        }
    }
    getFromCache(key) {
        const entry = this.cache.get(key);
        if (entry && Date.now() - entry.timestamp < this.defaultCacheTTL)
            return entry.data;
        this.cache.delete(key);
        return null;
    }
    setCache(key, data, ttl) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    clearCache() {
        this.cache.clear();
    }
}
exports.mikrotikPool = MikroTikPoolManager.getInstance();
exports.default = exports.mikrotikPool;
