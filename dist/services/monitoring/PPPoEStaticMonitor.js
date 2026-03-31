"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pppoeStaticMonitor = exports.PPPoEStaticMonitor = void 0;
// src/services/monitoring/PPPoEStaticMonitor.ts
/**
 * PPPoE Static IP Monitoring Service
 * -----------------------------------
 * - Periodically checks the status of static IPs assigned to PPPoE customers.
 * - Uses the `ping` npm package to verify reachability.
 * - Logs results to the unified billing log system.
 * - Emits events that can be consumed by the public map service.
 */
const node_cron_1 = __importDefault(require("node-cron"));
const ping_1 = __importDefault(require("ping"));
const pool_1 = require("../../db/pool");
const BillingLogService_1 = require("../../services/billing/BillingLogService");
const events_1 = __importDefault(require("events"));
class PPPoEStaticMonitor extends events_1.default {
    constructor() {
        super();
        this.scheduler = null;
        this.log('info', '🚀 PPPoEStaticMonitor instantiated');
    }
    static getInstance() {
        if (!PPPoEStaticMonitor.instance) {
            PPPoEStaticMonitor.instance = new PPPoEStaticMonitor();
        }
        return PPPoEStaticMonitor.instance;
    }
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        const logMsg = `[${timestamp}] [PPPoEStaticMonitor] [${level.toUpperCase()}] ${message}`;
        if (level === 'error')
            console.error(logMsg, data || '');
        else if (level === 'warn')
            console.warn(logMsg, data || '');
        else
            console.log(logMsg, data || '');
        // Also write to billing log service
        // Also write to billing log service
        BillingLogService_1.BillingLogService?.log({
            level: level,
            type: 'mikrotik',
            service: 'PPPoEStaticMonitor',
            message: message,
            context: data
        });
    }
    /**
     * Start the periodic check. Runs every 10 minutes by default.
     */
    startScheduler(cronExpression = '*/10 * * * *') {
        if (this.scheduler) {
            this.log('info', 'Scheduler already running');
            return;
        }
        this.scheduler = node_cron_1.default.schedule(cronExpression, async () => {
            this.log('info', 'Running PPPoE static IP health check');
            try {
                const [rows] = await pool_1.databasePool.query(`SELECT id, name, static_ip FROM customers WHERE static_ip IS NOT NULL AND static_ip <> ''`);
                // @ts-ignore – rows is any[] from mysql2
                for (const cust of rows) {
                    const ip = cust.static_ip;
                    const res = await ping_1.default.promise.probe(ip, { timeout: 5 });
                    const status = res.alive ? 'online' : 'offline';
                    this.log('info', `Customer ${cust.id} (${cust.name}) IP ${ip} is ${status}`);
                    this.emit('status', { customerId: cust.id, ip, status, latency: res.time });
                }
            }
            catch (e) {
                this.log('error', 'Error during PPPoE static IP check', e.message);
            }
        }, {
            scheduled: true,
            timezone: 'Asia/Jakarta'
        });
        this.log('info', '✅ PPPoEStaticMonitor scheduler started (*/10 * * * *)');
    }
    stopScheduler() {
        if (this.scheduler) {
            this.scheduler.stop();
            this.scheduler = null;
            this.log('info', 'Scheduler stopped');
        }
    }
}
exports.PPPoEStaticMonitor = PPPoEStaticMonitor;
exports.pppoeStaticMonitor = PPPoEStaticMonitor.getInstance();
//# sourceMappingURL=PPPoEStaticMonitor.js.map