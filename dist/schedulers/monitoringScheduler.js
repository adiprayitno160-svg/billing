"use strict";
/**
 * Monitoring Scheduler - Automated Data Collection and SLA Monitoring
 * Uses node-cron for scheduled tasks
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringScheduler = exports.MonitoringScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const pingService_1 = __importDefault(require("../services/pingService"));
const bandwidthLogService_1 = __importDefault(require("../services/bandwidthLogService"));
const alertRoutingService_1 = __importDefault(require("../services/alertRoutingService"));
const NetworkMonitoringService_1 = __importDefault(require("../services/monitoring/NetworkMonitoringService"));
const TwoHourNotificationService_1 = require("../services/monitoring/TwoHourNotificationService");
const AdvancedMonitoringService_1 = require("../services/monitoring/AdvancedMonitoringService");
class MonitoringScheduler {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }
    /**
     * Start all monitoring schedulers
     */
    async start() {
        try {
            if (this.isRunning) {
                console.log('[MonitoringScheduler] Already running');
                return;
            }
            console.log('[MonitoringScheduler] Initializing services...');
            try {
                await NetworkMonitoringService_1.default.initialize();
                console.log('[MonitoringScheduler] ✓ NetworkMonitoringService initialized');
            }
            catch (initError) {
                console.error('[MonitoringScheduler] Failed to initialize NetworkMonitoringService:', initError);
            }
            console.log('[MonitoringScheduler] Starting all schedulers...');
            // 0. Live Monitoring (High Priority) - Every 30 seconds
            this.startRealtimeMonitoring();
            // 1. Static IP Ping Monitoring - Every 10 minutes
            this.startPingMonitoring();
            // 2. PPPoE Bandwidth Collection - Every 5 minutes
            this.startBandwidthCollection();
            // 3. SLA Monitoring & Incident Detection - Every 5 minutes
            // DISABLED: Sends downtime alerts
            // this.startSLAMonitoring();
            // 4. Daily Summary Report - Every day at 8:00 AM
            // DISABLED: Sends daily summary reports
            // this.startDailySummaryReport();
            // 6. Prepaid Expiry Check - Every 1 hour
            this.startPrepaidCheck();
            // 7. Prepaid Expiry Warnings (H-3, H-1) - Every day at 9:00 AM
            // DISABLED: Sends expiry warnings via WhatsApp
            // this.startPrepaidExpiryWarnings();
            // 8. Enhanced Customer Monitoring (Timeout/Recovery Detection) - Every 15 minutes
            // DISABLED: Sends timeout/recovery notifications
            // this.startEnhancedCustomerMonitoring();
            // 9. Two Hour Notification Service - Every 2 hours
            // DISABLED: Sends 2-hour offline notifications
            // this.startTwoHourNotificationService();
            // 10. GenieACS Device Sync - Every 1 hour
            this.startGenieacsSync();
            this.isRunning = true;
            console.log('[MonitoringScheduler] All schedulers started successfully');
        }
        catch (error) {
            console.error('[MonitoringScheduler] FATAL ERROR during start():', error);
        }
    }
    /**
     * Stop all schedulers
     */
    stop() {
        console.log('[MonitoringScheduler] Stopping all schedulers...');
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`[MonitoringScheduler] Stopped: ${name}`);
        });
        this.jobs.clear();
        this.isRunning = false;
        console.log('[MonitoringScheduler] All schedulers stopped');
    }
    startRealtimeMonitoring() {
        const runTask = async () => {
            try {
                if (typeof AdvancedMonitoringService_1.AdvancedMonitoringService.runOptimizedMonitoringCycle !== 'function') {
                    console.error('[RealtimeMonitoring] ERROR: runOptimizedMonitoringCycle is NOT a function!', typeof AdvancedMonitoringService_1.AdvancedMonitoringService.runOptimizedMonitoringCycle);
                    return;
                }
                await AdvancedMonitoringService_1.AdvancedMonitoringService.runOptimizedMonitoringCycle();
            }
            catch (error) {
                console.error('[RealtimeMonitoring] Error:', error);
            }
        };
        try {
            const job = node_cron_1.default.schedule('*/30 * * * * *', runTask);
            this.jobs.set('realtime-monitoring', job);
            console.log('[MonitoringScheduler] ✓ Realtime Monitoring scheduled (every 30 seconds)');
        }
        catch (cronError) {
            console.error('[MonitoringScheduler] ERROR scheduling Realtime Monitoring:', cronError);
            console.log('[MonitoringScheduler] Falling back to setInterval for 30s');
            const interval = setInterval(runTask, 30000);
            // We can't easily put setInterval into this.jobs as ScheduledTask, but we can manage it
        }
    }
    /**
     * 1. Static IP Ping Monitoring - Every 10 minutes
     */
    startPingMonitoring() {
        const job = node_cron_1.default.schedule('*/10 * * * *', async () => {
            try {
                console.log('[PingMonitoring] Starting ping check...');
                await pingService_1.default.monitorAllStaticIPs();
            }
            catch (error) {
                console.error('[PingMonitoring] Error:', error);
            }
        });
        this.jobs.set('ping-monitoring', job);
        console.log('[MonitoringScheduler] ✓ Ping Monitoring scheduled (every 10 minutes)');
    }
    /**
     * 2. PPPoE Bandwidth Collection - Every 5 minutes
     */
    startBandwidthCollection() {
        const job = node_cron_1.default.schedule('*/5 * * * *', async () => {
            try {
                console.log('[BandwidthCollection] Starting bandwidth collection...');
                await bandwidthLogService_1.default.collectAllBandwidth();
            }
            catch (error) {
                console.error('[BandwidthCollection] Error:', error);
            }
        });
        this.jobs.set('bandwidth-collection', job);
        console.log('[MonitoringScheduler] ✓ Bandwidth Collection scheduled (every 5 minutes)');
    }
    /**
     * 4. Daily Summary Report - Every day at 8:00 AM
     * Sends both the basic alert summary
     */
    startDailySummaryReport() {
        const job = node_cron_1.default.schedule('0 8 * * *', async () => {
            try {
                console.log('[DailySummary] Sending daily summary report...');
                // Send basic summary
                await alertRoutingService_1.default.sendDailySummaryReport();
            }
            catch (error) {
                console.error('[DailySummary] Error:', error);
            }
        });
        this.jobs.set('daily-summary', job);
        console.log('[MonitoringScheduler] ✓ Daily Summary Report scheduled (daily at 8:00 AM)');
    }
    /**
     * 6. Prepaid Expiry Check - Every hour
     */
    startPrepaidCheck() {
        // Run every hour at minute 0
        const job = node_cron_1.default.schedule('0 * * * *', async () => {
            try {
                console.log('[PrepaidCheck] Checking for expired prepaid customers...');
                const { PrepaidService } = await Promise.resolve().then(() => __importStar(require('../services/billing/PrepaidService')));
                const result = await PrepaidService.processExpiredCustomers();
                if (result.isolatedCount > 0) {
                    console.log(`[PrepaidCheck] Isolated ${result.isolatedCount} expired customers.`);
                }
                if (result.errors.length > 0) {
                    console.error('[PrepaidCheck] Errors occurred during isolation:', result.errors);
                }
            }
            catch (error) {
                console.error('[PrepaidCheck] Error:', error);
            }
        });
        this.jobs.set('prepaid-check', job);
        console.log('[MonitoringScheduler] ✓ Prepaid Expiry Check scheduled (every 1 hour)');
    }
    /**
     * 8. Enhanced Customer Monitoring - Timeout/Recovery Detection - Every 15 minutes
     */
    startEnhancedCustomerMonitoring() {
        const job = node_cron_1.default.schedule('*/15 * * * *', async () => {
            try {
                console.log('[EnhancedMonitoring] Starting enhanced customer monitoring...');
                // Detect timeout issues
                await NetworkMonitoringService_1.default.detectTimeoutIssues();
                // Detect degraded performance
                await NetworkMonitoringService_1.default.detectDegradedPerformance();
                // Update trouble customers with notifications
                await NetworkMonitoringService_1.default.getTroubleCustomers(true);
                console.log('[EnhancedMonitoring] Enhanced monitoring cycle completed');
            }
            catch (error) {
                console.error('[EnhancedMonitoring] Error:', error);
            }
        });
        this.jobs.set('enhanced-customer-monitoring', job);
        console.log('[MonitoringScheduler] ✓ Enhanced Customer Monitoring scheduled (every 15 minutes)');
    }
    /**
     * 9. Two Hour Notification Service - Every 2 hours
     */
    startTwoHourNotificationService() {
        const job = node_cron_1.default.schedule('0 */2 * * *', async () => {
            try {
                console.log('[TwoHourNotification] Starting 2-hour notification cycle...');
                const notificationService = TwoHourNotificationService_1.TwoHourNotificationService.getInstance();
                // Process customers that have been offline for 2+ hours
                await notificationService.processLongTermOfflineCustomers();
                // Process customers that have recovered
                await notificationService.processRecoveredCustomers();
                console.log('[TwoHourNotification] 2-hour notification cycle completed');
            }
            catch (error) {
                console.error('[TwoHourNotification] Error:', error);
            }
        });
        this.jobs.set('two-hour-notification-service', job);
        console.log('[MonitoringScheduler] ✓ Two Hour Notification Service scheduled (every 2 hours)');
    }
    /**
     * 10. GenieACS Device Sync - Every 1 hour
     */
    startGenieacsSync() {
        const job = node_cron_1.default.schedule('0 * * * *', async () => {
            try {
                console.log('[GenieacsSync] Starting GenieACS device sync...');
                await NetworkMonitoringService_1.default.syncDevicesFromGenieACS();
                console.log('[GenieacsSync] Sync completed');
            }
            catch (error) {
                console.error('[GenieacsSync] Error:', error);
            }
        });
        this.jobs.set('genieacs-sync', job);
        console.log('[MonitoringScheduler] ✓ GenieACS Sync scheduled (every 1 hour)');
    }
    startPrepaidExpiryWarnings() {
        const job = node_cron_1.default.schedule('0 9 * * *', async () => {
            try {
                console.log('[PrepaidWarnings] Sending H-3 and H-1 expiry warnings...');
                const { PrepaidService } = await Promise.resolve().then(() => __importStar(require('../services/billing/PrepaidService')));
                const result = await PrepaidService.sendExpiryWarnings();
                console.log(`[PrepaidWarnings] Completed - H-3: ${result.h3Sent}, H-1: ${result.h1Sent}`);
                if (result.errors.length > 0) {
                    console.error('[PrepaidWarnings] Errors:', result.errors);
                }
            }
            catch (error) {
                console.error('[PrepaidWarnings] Error:', error);
            }
        });
        this.jobs.set('prepaid-expiry-warnings', job);
        console.log('[MonitoringScheduler] ✓ Prepaid Expiry Warnings scheduled (daily at 9:00 AM)');
    }
    /**
     * Run specific scheduler manually
     */
    async runManually(jobName) {
        console.log(`[MonitoringScheduler] Running ${jobName} manually...`);
        try {
            switch (jobName) {
                case 'ping':
                    await pingService_1.default.monitorAllStaticIPs();
                    break;
                case 'bandwidth':
                    await bandwidthLogService_1.default.collectAllBandwidth();
                    break;
                case 'daily-summary':
                    await alertRoutingService_1.default.sendDailySummaryReport();
                    break;
                case 'prepaid-check':
                    const { PrepaidService } = await Promise.resolve().then(() => __importStar(require('../services/billing/PrepaidService')));
                    await PrepaidService.processExpiredCustomers();
                    break;
                case 'prepaid-warnings':
                    const { PrepaidService: PrepaidSvc } = await Promise.resolve().then(() => __importStar(require('../services/billing/PrepaidService')));
                    await PrepaidSvc.sendExpiryWarnings();
                    break;
                case 'enhanced-monitoring':
                    await NetworkMonitoringService_1.default.detectTimeoutIssues();
                    await NetworkMonitoringService_1.default.detectDegradedPerformance();
                    await NetworkMonitoringService_1.default.getTroubleCustomers(true);
                    break;
                case 'genieacs-sync':
                    await NetworkMonitoringService_1.default.syncDevicesFromGenieACS();
                    break;
                default:
                    throw new Error(`Unknown job: ${jobName}`);
            }
            console.log(`[MonitoringScheduler] ${jobName} completed successfully`);
        }
        catch (error) {
            console.error(`[MonitoringScheduler] Error running ${jobName}:`, error);
            throw error;
        }
    }
    /**
     * Get scheduler status
     */
    getStatus() {
        const jobs = [];
        const nextRuns = {};
        this.jobs.forEach((job, name) => {
            jobs.push(name);
            // Note: node-cron doesn't provide next run time directly
            nextRuns[name] = 'See cron expression';
        });
        return {
            isRunning: this.isRunning,
            jobs,
            nextRuns
        };
    }
}
exports.MonitoringScheduler = MonitoringScheduler;
// Singleton instance
exports.monitoringScheduler = new MonitoringScheduler();
// Auto-start schedulers when module is loaded (can be disabled via env var)
// Disabled auto-start to give control to server.ts
/*
if (process.env.AUTO_START_MONITORING !== 'false') {
    // Delay start by 10 seconds to allow database connections to be ready
    setTimeout(() => {
        console.log('[MonitoringScheduler] Auto-starting schedulers in 10 seconds...');
        monitoringScheduler.start();
    }, 10000);
}
*/
exports.default = exports.monitoringScheduler;
//# sourceMappingURL=monitoringScheduler.js.map