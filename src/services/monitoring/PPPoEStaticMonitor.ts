// src/services/monitoring/PPPoEStaticMonitor.ts
/**
 * PPPoE Static IP Monitoring Service
 * -----------------------------------
 * - Periodically checks the status of static IPs assigned to PPPoE customers.
 * - Uses the `ping` npm package to verify reachability.
 * - Logs results to the unified billing log system.
 * - Emits events that can be consumed by the public map service.
 */
import cron from 'node-cron';
import ping from 'ping';
import { databasePool } from '../../db/pool';
import { BillingLogService } from '../../services/billing/BillingLogService';
import EventEmitter from 'events';

export class PPPoEStaticMonitor extends EventEmitter {
    private static instance: PPPoEStaticMonitor;
    private scheduler: cron.ScheduledTask | null = null;

    private constructor() {
        super();
        this.log('info', '🚀 PPPoEStaticMonitor instantiated');
    }

    public static getInstance(): PPPoEStaticMonitor {
        if (!PPPoEStaticMonitor.instance) {
            PPPoEStaticMonitor.instance = new PPPoEStaticMonitor();
        }
        return PPPoEStaticMonitor.instance;
    }

    private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const logMsg = `[${timestamp}] [PPPoEStaticMonitor] [${level.toUpperCase()}] ${message}`;
        if (level === 'error') console.error(logMsg, data || '');
        else if (level === 'warn') console.warn(logMsg, data || '');
        else console.log(logMsg, data || '');
        // Also write to billing log service
        BillingLogService?.log(level, message, data);
    }

    /**
     * Start the periodic check. Runs every 10 minutes by default.
     */
    public startScheduler(cronExpression = '*/10 * * * *'): void {
        if (this.scheduler) {
            this.log('info', 'Scheduler already running');
            return;
        }
        this.scheduler = cron.schedule(cronExpression, async () => {
            this.log('info', 'Running PPPoE static IP health check');
            try {
                const { rows } = await databasePool.query(
                    `SELECT id, name, static_ip FROM customers WHERE static_ip IS NOT NULL AND static_ip <> ''`
                );
                // @ts-ignore – rows is any[] from mysql2
                for (const cust of rows) {
                    const ip = cust.static_ip;
                    const res = await ping.promise.probe(ip, { timeout: 5 });
                    const status = res.alive ? 'online' : 'offline';
                    this.log('info', `Customer ${cust.id} (${cust.name}) IP ${ip} is ${status}`);
                    this.emit('status', { customerId: cust.id, ip, status, latency: res.time });
                }
            } catch (e: any) {
                this.log('error', 'Error during PPPoE static IP check', e.message);
            }
        }, {
            scheduled: true,
            timezone: 'Asia/Jakarta'
        });
        this.log('info', '✅ PPPoEStaticMonitor scheduler started (*/10 * * * *)');
    }

    public stopScheduler(): void {
        if (this.scheduler) {
            this.scheduler.stop();
            this.scheduler = null;
            this.log('info', 'Scheduler stopped');
        }
    }
}

export const pppoeStaticMonitor = PPPoEStaticMonitor.getInstance();
