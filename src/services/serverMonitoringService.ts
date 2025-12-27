import { databasePool } from '../db/pool';
import { getDatabaseStatus, DatabaseStatus } from './databaseService';
import { BillingDashboardService } from './billing/billingDashboardService';
import os from 'os';

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

export class ServerMonitoringService {
    private static lastCheckTime: number = 0;
    private static cachedStatus: ServerMonitoringStatus | null = null;
    private static CACHE_DURATION = 10000; // Cache for 10 seconds

    /**
     * Get comprehensive server monitoring status
     */
    static async getServerStatus(): Promise<ServerMonitoringStatus> {
        const now = Date.now();

        // Return cached status if recent
        if (this.cachedStatus && (now - this.lastCheckTime) < this.CACHE_DURATION) {
            return this.cachedStatus;
        }

        try {
            // Get server information
            const uptimeSeconds = Math.floor(process.uptime());
            const uptime = this.formatUptime(uptimeSeconds);
            const memoryUsage = process.memoryUsage();
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsagePercent = (usedMemory / totalMemory) * 100;

            // Get CPU load average (1 minute)
            const loadAvg = os.loadavg();
            const cpuCores = os.cpus().length;
            
            // Calculate CPU usage percentage (load average / cores * 100)
            // Load average represents the average system load over 1, 5, and 15 minutes
            const cpuLoadPercent = cpuCores > 0 ? (loadAvg[0] / cpuCores) * 100 : 0;

            // Get database status
            const dbStatus = await getDatabaseStatus();

            // Get system health
            let systemHealth;
            try {
                const healthMetrics = await BillingDashboardService.getSystemHealthMetrics();
                systemHealth = {
                    overall_status: healthMetrics.overall_status,
                    database: healthMetrics.database,
                    notifications: healthMetrics.notifications
                };
            } catch (error) {
                console.error('[ServerMonitoring] Error getting system health:', error);
                systemHealth = {
                    overall_status: 'unhealthy',
                    database: { connected: false, status: 'unknown' },
                    notifications: { failures_last_7_days: 0, status: 'unknown' }
                };
            }

            const status: ServerMonitoringStatus = {
                server: {
                    status: 'online',
                    uptime,
                    uptimeSeconds,
                    nodeVersion: process.version,
                    platform: `${os.type()} ${os.release()}`,
                    memory: {
                        total: totalMemory,
                        used: usedMemory,
                        free: freeMemory,
                        usagePercent: Math.round(memoryUsagePercent * 100) / 100
                    },
                    cpu: {
                        loadAverage: loadAvg,
                        cores: cpuCores,
                        loadPercent: Math.round(cpuLoadPercent * 100) / 100
                    }
                },
                database: dbStatus,
                systemHealth,
                lastCheck: new Date()
            };

            // Cache the result
            this.cachedStatus = status;
            this.lastCheckTime = now;

            return status;
        } catch (error) {
            console.error('[ServerMonitoring] Error getting server status:', error);
            
            // Return error status
            const errorStatus: ServerMonitoringStatus = {
                server: {
                    status: 'offline',
                    uptime: '0s',
                    uptimeSeconds: 0,
                    nodeVersion: process.version,
                    platform: `${os.type()} ${os.release()}`,
                    memory: {
                        total: 0,
                        used: 0,
                        free: 0,
                        usagePercent: 0
                    },
                    cpu: {
                        loadAverage: [0, 0, 0],
                        cores: 0,
                        loadPercent: 0
                    }
                },
                database: {
                    connected: false,
                    version: 'Unknown',
                    uptime: 'Disconnected',
                    totalTables: 0,
                    totalRows: 0
                },
                systemHealth: {
                    overall_status: 'unhealthy',
                    database: { connected: false, status: 'unknown' },
                    notifications: { failures_last_7_days: 0, status: 'unknown' }
                },
                lastCheck: new Date()
            };

            return errorStatus;
        }
    }

    /**
     * Format uptime in human-readable format
     */
    private static formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    /**
     * Format bytes to human-readable format
     */
    static formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

