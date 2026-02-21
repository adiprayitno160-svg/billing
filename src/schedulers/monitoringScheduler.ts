/**
 * Monitoring Scheduler - Automated Data Collection and SLA Monitoring
 * Uses node-cron for scheduled tasks
 */

import cron from 'node-cron';
import pingService from '../services/pingService';
import bandwidthLogService from '../services/bandwidthLogService';
import slaMonitoringService from '../services/slaMonitoringService';
import alertRoutingService from '../services/alertRoutingService';
import NetworkMonitoringService from '../services/monitoring/NetworkMonitoringService';
import { TwoHourNotificationService } from '../services/monitoring/TwoHourNotificationService';

import { AdvancedMonitoringService } from '../services/monitoring/AdvancedMonitoringService';

export class MonitoringScheduler {
    private jobs: Map<string, cron.ScheduledTask> = new Map();
    private isRunning: boolean = false;

    /**
     * Start all monitoring schedulers
     */
    start(): void {
        try {
            if (this.isRunning) {
                console.log('[MonitoringScheduler] Already running');
                return;
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

            // 5. Monthly SLA Calculation - 1st day of month at 2:00 AM
            this.startMonthlySLACalculation();

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
        } catch (error) {
            console.error('[MonitoringScheduler] FATAL ERROR during start():', error);
        }
    }

    /**
     * Stop all schedulers
     */
    stop(): void {
        console.log('[MonitoringScheduler] Stopping all schedulers...');

        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`[MonitoringScheduler] Stopped: ${name}`);
        });

        this.jobs.clear();
        this.isRunning = false;

        console.log('[MonitoringScheduler] All schedulers stopped');
    }

    private startRealtimeMonitoring(): void {
        const runTask = async () => {
            try {
                if (typeof AdvancedMonitoringService.runOptimizedMonitoringCycle !== 'function') {
                    console.error('[RealtimeMonitoring] ERROR: runOptimizedMonitoringCycle is NOT a function!', typeof AdvancedMonitoringService.runOptimizedMonitoringCycle);
                    return;
                }

                await AdvancedMonitoringService.runOptimizedMonitoringCycle();
            } catch (error) {
                console.error('[RealtimeMonitoring] Error:', error);
            }
        };

        try {
            const job = cron.schedule('*/30 * * * * *', runTask);
            this.jobs.set('realtime-monitoring', job);
            console.log('[MonitoringScheduler] ✓ Realtime Monitoring scheduled (every 30 seconds)');
        } catch (cronError) {
            console.error('[MonitoringScheduler] ERROR scheduling Realtime Monitoring:', cronError);
            console.log('[MonitoringScheduler] Falling back to setInterval for 30s');
            const interval = setInterval(runTask, 30000);
            // We can't easily put setInterval into this.jobs as ScheduledTask, but we can manage it
        }
    }

    /**
     * 1. Static IP Ping Monitoring - Every 10 minutes
     */
    private startPingMonitoring(): void {
        const job = cron.schedule('*/10 * * * *', async () => {
            try {
                console.log('[PingMonitoring] Starting ping check...');
                await pingService.monitorAllStaticIPs();
            } catch (error) {
                console.error('[PingMonitoring] Error:', error);
            }
        });

        this.jobs.set('ping-monitoring', job);
        console.log('[MonitoringScheduler] ✓ Ping Monitoring scheduled (every 10 minutes)');
    }

    /**
     * 2. PPPoE Bandwidth Collection - Every 5 minutes
     */
    private startBandwidthCollection(): void {
        const job = cron.schedule('*/5 * * * *', async () => {
            try {
                console.log('[BandwidthCollection] Starting bandwidth collection...');
                await bandwidthLogService.collectAllBandwidth();
            } catch (error) {
                console.error('[BandwidthCollection] Error:', error);
            }
        });

        this.jobs.set('bandwidth-collection', job);
        console.log('[MonitoringScheduler] ✓ Bandwidth Collection scheduled (every 5 minutes)');
    }

    /**
     * 3. SLA Monitoring & Incident Detection - Every 5 minutes
     */
    private startSLAMonitoring(): void {
        const job = cron.schedule('*/5 * * * *', async () => {
            try {
                console.log('[SLAMonitoring] Starting SLA monitoring cycle...');
                await slaMonitoringService.runMonitoring();
            } catch (error) {
                console.error('[SLAMonitoring] Error:', error);
            }
        });

        this.jobs.set('sla-monitoring', job);
        console.log('[MonitoringScheduler] ✓ SLA Monitoring scheduled (every 5 minutes)');
    }

    /**
     * 4. Daily Summary Report - Every day at 8:00 AM
     * Sends both the basic alert summary AND the enhanced NOC daily digest
     */
    private startDailySummaryReport(): void {
        const job = cron.schedule('0 8 * * *', async () => {
            try {
                console.log('[DailySummary] Sending daily summary report...');

                // Send basic summary
                await alertRoutingService.sendDailySummaryReport();

                // Send enhanced NOC Intelligence daily digest
                try {
                    const NocIntelligenceService = (await import('../services/monitoring/NocIntelligenceService')).default;
                    await NocIntelligenceService.sendDailyDigestTelegram();
                    console.log('[DailySummary] NOC daily digest sent successfully');
                } catch (nocError) {
                    console.error('[DailySummary] NOC daily digest failed:', nocError);
                }
            } catch (error) {
                console.error('[DailySummary] Error:', error);
            }
        });

        this.jobs.set('daily-summary', job);
        console.log('[MonitoringScheduler] ✓ Daily Summary Report + NOC Digest scheduled (daily at 8:00 AM)');
    }

    /**
     * 5. Monthly SLA Calculation - 1st day of month at 2:00 AM
     */
    private startMonthlySLACalculation(): void {
        const job = cron.schedule('0 2 1 * *', async () => {
            try {
                console.log('[MonthlySLA] Starting monthly SLA calculation...');

                // Calculate for previous month
                const now = new Date();
                const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

                await slaMonitoringService.calculateMonthlySLA(previousMonth);

                console.log('[MonthlySLA] Calculation completed');
            } catch (error) {
                console.error('[MonthlySLA] Error:', error);
            }
        });

        this.jobs.set('monthly-sla-calculation', job);
        console.log('[MonitoringScheduler] ✓ Monthly SLA Calculation scheduled (1st of month at 2:00 AM)');
    }

    /**
     * 6. Prepaid Expiry Check - Every hour
     */
    private startPrepaidCheck(): void {
        // Run every hour at minute 0
        const job = cron.schedule('0 * * * *', async () => {
            try {
                console.log('[PrepaidCheck] Checking for expired prepaid customers...');
                const { PrepaidService } = await import('../services/billing/PrepaidService');
                const result = await PrepaidService.processExpiredCustomers();

                if (result.isolatedCount > 0) {
                    console.log(`[PrepaidCheck] Isolated ${result.isolatedCount} expired customers.`);
                }

                if (result.errors.length > 0) {
                    console.error('[PrepaidCheck] Errors occurred during isolation:', result.errors);
                }
            } catch (error) {
                console.error('[PrepaidCheck] Error:', error);
            }
        });

        this.jobs.set('prepaid-check', job);
        console.log('[MonitoringScheduler] ✓ Prepaid Expiry Check scheduled (every 1 hour)');
    }

    /**
     * 8. Enhanced Customer Monitoring - Timeout/Recovery Detection - Every 15 minutes
     */
    private startEnhancedCustomerMonitoring(): void {
        const job = cron.schedule('*/15 * * * *', async () => {
            try {
                console.log('[EnhancedMonitoring] Starting enhanced customer monitoring...');

                // Detect timeout issues
                await NetworkMonitoringService.detectTimeoutIssues();

                // Detect degraded performance
                await NetworkMonitoringService.detectDegradedPerformance();

                // Update trouble customers with notifications
                await NetworkMonitoringService.getTroubleCustomers(true);

                console.log('[EnhancedMonitoring] Enhanced monitoring cycle completed');
            } catch (error) {
                console.error('[EnhancedMonitoring] Error:', error);
            }
        });

        this.jobs.set('enhanced-customer-monitoring', job);
        console.log('[MonitoringScheduler] ✓ Enhanced Customer Monitoring scheduled (every 15 minutes)');
    }

    /**
     * 9. Two Hour Notification Service - Every 2 hours
     */
    private startTwoHourNotificationService(): void {
        const job = cron.schedule('0 */2 * * *', async () => {  // Every 2 hours
            try {
                console.log('[TwoHourNotification] Starting 2-hour notification cycle...');

                const notificationService = TwoHourNotificationService.getInstance();

                // Process customers that have been offline for 2+ hours
                await notificationService.processLongTermOfflineCustomers();

                // Process customers that have recovered
                await notificationService.processRecoveredCustomers();

                console.log('[TwoHourNotification] 2-hour notification cycle completed');
            } catch (error) {
                console.error('[TwoHourNotification] Error:', error);
            }
        });

        this.jobs.set('two-hour-notification-service', job);
        console.log('[MonitoringScheduler] ✓ Two Hour Notification Service scheduled (every 2 hours)');
    }
    /**
     * 10. GenieACS Device Sync - Every 1 hour
     */
    private startGenieacsSync(): void {
        const job = cron.schedule('0 * * * *', async () => {
            try {
                console.log('[GenieacsSync] Starting GenieACS device sync...');
                await NetworkMonitoringService.syncDevicesFromGenieACS();
                console.log('[GenieacsSync] Sync completed');
            } catch (error) {
                console.error('[GenieacsSync] Error:', error);
            }
        });

        this.jobs.set('genieacs-sync', job);
        console.log('[MonitoringScheduler] ✓ GenieACS Sync scheduled (every 1 hour)');
    }

    private startPrepaidExpiryWarnings(): void {
        const job = cron.schedule('0 9 * * *', async () => {
            try {
                console.log('[PrepaidWarnings] Sending H-3 and H-1 expiry warnings...');
                const { PrepaidService } = await import('../services/billing/PrepaidService');
                const result = await PrepaidService.sendExpiryWarnings();

                console.log(`[PrepaidWarnings] Completed - H-3: ${result.h3Sent}, H-1: ${result.h1Sent}`);

                if (result.errors.length > 0) {
                    console.error('[PrepaidWarnings] Errors:', result.errors);
                }
            } catch (error) {
                console.error('[PrepaidWarnings] Error:', error);
            }
        });

        this.jobs.set('prepaid-expiry-warnings', job);
        console.log('[MonitoringScheduler] ✓ Prepaid Expiry Warnings scheduled (daily at 9:00 AM)');
    }

    /**
     * Run specific scheduler manually
     */
    async runManually(jobName: string): Promise<void> {
        console.log(`[MonitoringScheduler] Running ${jobName} manually...`);

        try {
            switch (jobName) {
                case 'ping':
                    await pingService.monitorAllStaticIPs();
                    break;

                case 'bandwidth':
                    await bandwidthLogService.collectAllBandwidth();
                    break;

                case 'sla':
                    await slaMonitoringService.runMonitoring();
                    break;

                case 'daily-summary':
                    await alertRoutingService.sendDailySummaryReport();
                    break;

                case 'monthly-sla':
                    const previousMonth = new Date(
                        new Date().getFullYear(),
                        new Date().getMonth() - 1,
                        1
                    );
                    await slaMonitoringService.calculateMonthlySLA(previousMonth);
                    break;

                case 'prepaid-check':
                    const { PrepaidService } = await import('../services/billing/PrepaidService');
                    await PrepaidService.processExpiredCustomers();
                    break;

                case 'prepaid-warnings':
                    const { PrepaidService: PrepaidSvc } = await import('../services/billing/PrepaidService');
                    await PrepaidSvc.sendExpiryWarnings();
                    break;

                case 'enhanced-monitoring':
                    await NetworkMonitoringService.detectTimeoutIssues();
                    await NetworkMonitoringService.detectDegradedPerformance();
                    await NetworkMonitoringService.getTroubleCustomers(true);
                    break;

                case 'genieacs-sync':
                    await NetworkMonitoringService.syncDevicesFromGenieACS();
                    break;

                default:
                    throw new Error(`Unknown job: ${jobName}`);
            }

            console.log(`[MonitoringScheduler] ${jobName} completed successfully`);

        } catch (error) {
            console.error(`[MonitoringScheduler] Error running ${jobName}:`, error);
            throw error;
        }
    }

    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        jobs: string[];
        nextRuns: { [key: string]: string };
    } {
        const jobs: string[] = [];
        const nextRuns: { [key: string]: string } = {};

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

// Singleton instance
export const monitoringScheduler = new MonitoringScheduler();

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

export default monitoringScheduler;
