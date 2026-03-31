/**
 * MikroTik Connection Pool Manager
 * Manages multiple persistent connections to different MikroTik routers
 * to prevent port exhaustion and improve performance.
 */
export type MikroTikConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    use_tls?: boolean;
};
declare class MikroTikPoolManager {
    private static instance;
    private connections;
    private cache;
    private defaultCacheTTL;
    private constructor();
    static getInstance(): MikroTikPoolManager;
    private getConnectionKey;
    private cleanupIdleConnections;
    execute<T = any>(config: MikroTikConfig, command: string, params?: string[], cacheKey?: string, cacheTTL?: number): Promise<T>;
    private getFromCache;
    private setCache;
    clearCache(): void;
}
export declare const mikrotikPool: MikroTikPoolManager;
export default mikrotikPool;
//# sourceMappingURL=MikroTikConnectionPool.d.ts.map