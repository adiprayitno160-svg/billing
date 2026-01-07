/**
 * MikroTik Connection Pool Manager
 * Manages multiple persistent connections to different MikroTik routers
 * to prevent port exhaustion and improve performance.
 */

import { RouterOSAPI } from 'routeros-api';

export type MikroTikConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    use_tls?: boolean;
};

interface CacheEntry {
    data: any;
    timestamp: number;
}

class MikroTikConnection {
    public api: RouterOSAPI | null = null;
    public isConnected: boolean = false;
    public lastActivity: number = 0;
    private config: MikroTikConfig;
    private connectionPromise: Promise<void> | null = null;

    constructor(config: MikroTikConfig) {
        this.config = config;
        this.lastActivity = Date.now();
    }

    public async connect(): Promise<void> {
        if (this.isConnected && this.api) return;
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = (async () => {
            console.log(`[MikroTikPool] Connecting to ${this.config.host}:${this.config.port}...`);
            this.api = new RouterOSAPI({
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
            } catch (err: any) {
                this.isConnected = false;
                this.api = null;
                throw err;
            } finally {
                this.connectionPromise = null;
            }
        })();

        return this.connectionPromise;
    }

    public async disconnect(): Promise<void> {
        if (this.api) {
            try { await this.api.close(); } catch (e) { }
            this.api = null;
        }
        this.isConnected = false;
    }
}

class MikroTikPoolManager {
    private static instance: MikroTikPoolManager;
    private connections: Map<string, MikroTikConnection> = new Map();
    private cache: Map<string, CacheEntry> = new Map();
    private defaultCacheTTL: number = 30000;

    private constructor() {
        // Cleanup idle connections
        setInterval(() => this.cleanupIdleConnections(), 60000);
    }

    public static getInstance(): MikroTikPoolManager {
        if (!MikroTikPoolManager.instance) {
            MikroTikPoolManager.instance = new MikroTikPoolManager();
        }
        return MikroTikPoolManager.instance;
    }

    private getConnectionKey(config: MikroTikConfig): string {
        return `${config.host}:${config.port}:${config.username}`;
    }

    private cleanupIdleConnections(): void {
        const now = Date.now();
        for (const [key, conn] of this.connections.entries()) {
            if (conn.isConnected && now - conn.lastActivity > 300000) { // 5 minutes idle
                console.log(`[MikroTikPool] Closing idle connection: ${key}`);
                conn.disconnect();
            }
        }
    }

    public async execute<T = any>(config: MikroTikConfig, command: string, params: string[] = [], cacheKey?: string, cacheTTL?: number): Promise<T> {
        const fullCacheKey = cacheKey ? `${this.getConnectionKey(config)}:${cacheKey}` : null;

        // Check cache
        if (fullCacheKey) {
            const cached = this.getFromCache(fullCacheKey);
            if (cached !== null) return cached as T;
        }

        const key = this.getConnectionKey(config);
        let conn = this.connections.get(key);

        if (!conn) {
            conn = new MikroTikConnection(config);
            this.connections.set(key, conn);
        }

        await conn.connect();

        if (!conn.api) throw new Error(`Failed to initialize API for ${config.host}`);

        conn.lastActivity = Date.now();

        try {
            const result = await conn.api.write(command, params);

            if (fullCacheKey) {
                this.setCache(fullCacheKey, result, cacheTTL);
            }

            return result as T;
        } catch (error: any) {
            if (error.message?.includes('closed') || error.message?.includes('timeout')) {
                conn.isConnected = false;
                await conn.connect();
                if (conn.api) return await conn.api.write(command, params) as T;
            }
            throw error;
        }
    }

    private getFromCache(key: string): any | null {
        const entry = this.cache.get(key);
        if (entry && Date.now() - entry.timestamp < this.defaultCacheTTL) return entry.data;
        this.cache.delete(key);
        return null;
    }

    private setCache(key: string, data: any, ttl?: number): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    public clearCache(): void {
        this.cache.clear();
    }
}

export const mikrotikPool = MikroTikPoolManager.getInstance();
export default mikrotikPool;
