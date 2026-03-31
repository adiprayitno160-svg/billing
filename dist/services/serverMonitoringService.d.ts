import { DatabaseStatus } from './databaseService';
export interface ServerMonitoringStatus {
    server: {
        status: 'online' | 'offline';
        uptime: string;
        uptimeSeconds: number;
        nodeVersion: string;
        platform: string;
        memory: {
            total: number;
            used: number;
            free: number;
            usagePercent: number;
        };
        cpu: {
            loadAverage: number[];
            cores: number;
            loadPercent: number;
        };
    };
    database: DatabaseStatus;
    systemHealth: {
        overall_status: 'healthy' | 'warning' | 'unhealthy';
        database: {
            connected: boolean;
            status: string;
        };
        notifications: {
            failures_last_7_days: number;
            status: string;
        };
    };
    lastCheck: Date;
}
export declare class ServerMonitoringService {
    private static lastCheckTime;
    private static cachedStatus;
    private static CACHE_DURATION;
    /**
     * Get comprehensive server monitoring status
     */
    static getServerStatus(): Promise<ServerMonitoringStatus>;
    /**
     * Format uptime in human-readable format
     */
    private static formatUptime;
    /**
     * Format bytes to human-readable format
     */
    static formatBytes(bytes: number): string;
}
//# sourceMappingURL=serverMonitoringService.d.ts.map