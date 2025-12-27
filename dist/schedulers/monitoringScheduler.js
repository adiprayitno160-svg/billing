"use strict";
/**
 * Monitoring Scheduler - Automated Data Collection and SLA Monitoring
 * Uses node-cron for scheduled tasks
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringScheduler = exports.MonitoringScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const pingService_1 = __importDefault(require("../services/pingService"));
const bandwidthLogService_1 = __importDefault(require("../services/bandwidthLogService"));
const slaMonitoringService_1 = __importDefault(require("../services/slaMonitoringService"));
const alertRoutingService_1 = __importDefault(require("../services/alertRoutingService"));
class MonitoringScheduler {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }
    /**
     * Start all monitoring schedulers
     */
    start() {
        if (this.isRunning) {
            console.log('[MonitoringScheduler] Already running');
            return;
        }
        console.log('[MonitoringScheduler] Starting all schedulers...');
        // 1. Static IP Ping Monitoring - Every 10 minutes
        this.startPingMonitoring();
        // 2. PPPoE Bandwidth Collection - Every 5 minutes
        this.startBandwidthCollection();
        // 3. SLA Monitoring & Incident Detection - Every 5 minutes
        this.startSLAMonitoring();
        // 4. Daily Summary Report - Every day at 8:00 AM
        this.startDailySummaryReport();
        // 5. Monthly SLA Calculation - 1st day of month at 2:00 AM
        this.startMonthlySLACalculation();
        this.isRunning = true;
        console.log('[MonitoringScheduler] All schedulers started successfully');
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
     * 3. SLA Monitoring & Incident Detection - Every 5 minutes
     */
    startSLAMonitoring() {
        const job = node_cron_1.default.schedule('*/5 * * * *', async () => {
            try {
                console.log('[SLAMonitoring] Starting SLA monitoring cycle...');
                await slaMonitoringService_1.default.runMonitoring();
            }
            catch (error) {
                console.error('[SLAMonitoring] Error:', error);
            }
        });
        this.jobs.set('sla-monitoring', job);
        console.log('[MonitoringScheduler] ✓ SLA Monitoring scheduled (every 5 minutes)');
    }
    /**
     * 4. Daily Summary Report - Every day at 8:00 AM
     */
    startDailySummaryReport() {
        const job = node_cron_1.default.schedule('0 8 * * *', async () => {
            try {
                console.log('[DailySummary] Sending daily summary report...');
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
     * 5. Monthly SLA Calculation - 1st day of month at 2:00 AM
     */
    startMonthlySLACalculation() {
        const job = node_cron_1.default.schedule('0 2 1 * *', async () => {
            try {
                console.log('[MonthlySLA] Starting monthly SLA calculation...');
                // Calculate for previous month
                const now = new Date();
                const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                await slaMonitoringService_1.default.calculateMonthlySLA(previousMonth);
                console.log('[MonthlySLA] Calculation completed');
            }
            catch (error) {
                console.error('[MonthlySLA] Error:', error);
            }
        });
        this.jobs.set('monthly-sla-calculation', job);
        console.log('[MonitoringScheduler] ✓ Monthly SLA Calculation scheduled (1st of month at 2:00 AM)');
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
                case 'sla':
                    await slaMonitoringService_1.default.runMonitoring();
                    break;
                case 'daily-summary':
                    await alertRoutingService_1.default.sendDailySummaryReport();
                    break;
                case 'monthly-sla':
                    const previousMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
                    await slaMonitoringService_1.default.calculateMonthlySLA(previousMonth);
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
if (process.env.AUTO_START_MONITORING !== 'false') {
    // Delay start by 10 seconds to allow database connections to be ready
    setTimeout(() => {
        console.log('[MonitoringScheduler] Auto-starting schedulers in 10 seconds...');
        exports.monitoringScheduler.start();
    }, 10000);
}
exports.default = exports.monitoringScheduler;
//# sourceMappingURL=monitoringScheduler.js.map