"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerMonitoringService = void 0;
const databaseService_1 = require("./databaseService");
const billingDashboardService_1 = require("./billing/billingDashboardService");
const os_1 = __importDefault(require("os"));
class ServerMonitoringService {
    /**
     * Get comprehensive server monitoring status
     */
    static async getServerStatus() {
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
            const totalMemory = os_1.default.totalmem();
            const freeMemory = os_1.default.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsagePercent = (usedMemory / totalMemory) * 100;
            // Get CPU load average (1 minute)
            const loadAvg = os_1.default.loadavg();
            const cpuCores = os_1.default.cpus().length;
            // Calculate CPU usage percentage (load average / cores * 100)
            // Load average represents the average system load over 1, 5, and 15 minutes
            const cpuLoadPercent = cpuCores > 0 ? (loadAvg[0] / cpuCores) * 100 : 0;
            // Get database status
            const dbStatus = await (0, databaseService_1.getDatabaseStatus)();
            // Get system health
            let systemHealth;
            try {
                const healthMetrics = await billingDashboardService_1.BillingDashboardService.getSystemHealthMetrics();
                systemHealth = {
                    overall_status: healthMetrics.overall_status,
                    database: healthMetrics.database,
                    notifications: healthMetrics.notifications
                };
            }
            catch (error) {
                console.error('[ServerMonitoring] Error getting system health:', error);
                systemHealth = {
                    overall_status: 'unhealthy',
                    database: { connected: false, status: 'unknown' },
                    notifications: { failures_last_7_days: 0, status: 'unknown' }
                };
            }
            const status = {
                server: {
                    status: 'online',
                    uptime,
                    uptimeSeconds,
                    nodeVersion: process.version,
                    platform: `${os_1.default.type()} ${os_1.default.release()}`,
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
        }
        catch (error) {
            console.error('[ServerMonitoring] Error getting server status:', error);
            // Return error status
            const errorStatus = {
                server: {
                    status: 'offline',
                    uptime: '0s',
                    uptimeSeconds: 0,
                    nodeVersion: process.version,
                    platform: `${os_1.default.type()} ${os_1.default.release()}`,
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
    static formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        else {
            return `${secs}s`;
        }
    }
    /**
     * Format bytes to human-readable format
     */
    static formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}
exports.ServerMonitoringService = ServerMonitoringService;
ServerMonitoringService.lastCheckTime = 0;
ServerMonitoringService.cachedStatus = null;
ServerMonitoringService.CACHE_DURATION = 10000; // Cache for 10 seconds
//# sourceMappingURL=serverMonitoringService.js.map