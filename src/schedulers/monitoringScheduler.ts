/**
 * Monitoring Scheduler - Automated Data Collection and SLA Monitoring
 * Uses node-cron for scheduled tasks
 */

import cron from 'node-cron';
import pingService from '../services/pingService';
import bandwidthLogService from '../services/bandwidthLogService';
import slaMonitoringService from '../services/slaMonitoringService';
import alertRoutingService from '../services/alertRoutingService';

export class MonitoringScheduler {
    private jobs: Map<string, cron.ScheduledTask> = new Map();
    private isRunning: boolean = false;

    /**
     * Start all monitoring schedulers
     */
    start(): void {
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

        // 6. Prepaid Expiry Check - Every 1 hour
        this.startPrepaidCheck();

        this.isRunning = true;
        console.log('[MonitoringScheduler] All schedulers started successfully');
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
     */
    private startDailySummaryReport(): void {
        const job = cron.schedule('0 8 * * *', async () => {
            try {
                console.log('[DailySummary] Sending daily summary report...');
                await alertRoutingService.sendDailySummaryReport();
            } catch (error) {
                console.error('[DailySummary] Error:', error);
            }
        });

        this.jobs.set('daily-summary', job);
        console.log('[MonitoringScheduler] ✓ Daily Summary Report scheduled (daily at 8:00 AM)');
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
if (process.env.AUTO_START_MONITORING !== 'false') {
    // Delay start by 10 seconds to allow database connections to be ready
    setTimeout(() => {
        console.log('[MonitoringScheduler] Auto-starting schedulers in 10 seconds...');
        monitoringScheduler.start();
    }, 10000);
}

export default monitoringScheduler;
