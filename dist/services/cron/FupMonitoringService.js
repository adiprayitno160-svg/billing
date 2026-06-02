"use strict";
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
exports.FupMonitoringService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const pool_1 = require("../../db/pool");
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
const mikrotikService_1 = require("../mikrotikService");
class FupMonitoringService {
    static startFupCron() {
        // Run every 15 minutes
        node_cron_1.default.schedule('*/15 * * * *', async () => {
            if (this.isRunning)
                return;
            this.isRunning = true;
            try {
                await this.processFupAndBonus();
            }
            catch (error) {
                console.error('[FupMonitoring] Error:', error);
            }
            finally {
                this.isRunning = false;
            }
        });
        // Run at 00:01 on the 1st of every month to reset FUP
        node_cron_1.default.schedule('1 0 1 * *', async () => {
            try {
                await this.resetMonthlyFup();
            }
            catch (error) {
                console.error('[FupMonitoring] Monthly Reset Error:', error);
            }
        });
        console.log('✅ [Cron] FupMonitoringService started (15-min interval)');
    }
    static async processFupAndBonus() {
        console.log('[FupMonitoring] Starting FUP & Happy Hour sync cycle...');
        const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
        if (!config) {
            console.log('[FupMonitoring] No active MikroTik config. Skipping.');
            return;
        }
        const queues = await (0, mikrotikService_1.getSimpleQueues)(config);
        if (!queues || queues.length === 0)
            return;
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Get customers with FUP or Bonus enabled
            const [customers] = await conn.query(`
                SELECT id, pppoe_username, is_fup_enabled, fup_limit_gb, fup_speed_limit,
                       is_bonus_enabled, bonus_speed_limit, bonus_start_time, bonus_end_time,
                       connection_type, static_ip
                FROM customers 
                WHERE (is_fup_enabled = 1 OR is_bonus_enabled = 1) AND status = 'active'
            `);
            const customerList = customers;
            const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM
            const currentHourMinutes = new Date().toTimeString().substring(0, 8); // HH:MM:SS
            for (const cust of customerList) {
                const identifier = cust.connection_type === 'pppoe' ? `<pppoe-${cust.pppoe_username}>` : cust.static_ip;
                if (!identifier)
                    continue;
                // Find matching queue by target (which is IP or PPPoE interface)
                const queue = queues.find((q) => q.target === identifier || q.target === `${identifier}/32` || q.name === cust.pppoe_username);
                if (!queue)
                    continue;
                const bytesStr = queue.bytes || '0/0'; // "Upload/Download" in Mikrotik (Tx/Rx from user perspective)
                const [upBytes, downBytes] = bytesStr.split('/').map((b) => parseInt(b, 10) || 0);
                // Initialize or get traffic record
                let [usageRecords] = await conn.query('SELECT * FROM customer_traffic_usage WHERE customer_id = ? AND period = ?', [cust.id, currentPeriod]);
                let usage = usageRecords[0];
                if (!usage) {
                    await conn.query(`INSERT INTO customer_traffic_usage 
                         (customer_id, period, total_bytes_download, total_bytes_upload, last_mikrotik_tx, last_mikrotik_rx)
                         VALUES (?, ?, ?, ?, ?, ?)`, [cust.id, currentPeriod, downBytes, upBytes, upBytes, downBytes]);
                    // Fetch newly created
                    const [newUsages] = await conn.query('SELECT * FROM customer_traffic_usage WHERE customer_id = ? AND period = ?', [cust.id, currentPeriod]);
                    usage = newUsages[0];
                }
                // Calculate delta
                let deltaUp = upBytes - usage.last_mikrotik_tx;
                let deltaDown = downBytes - usage.last_mikrotik_rx;
                // If Mikrotik restarted, queue bytes will be less than last recorded
                if (deltaUp < 0)
                    deltaUp = upBytes;
                if (deltaDown < 0)
                    deltaDown = downBytes;
                const newTotalUp = usage.total_bytes_upload + deltaUp;
                const newTotalDown = usage.total_bytes_download + deltaDown;
                // Update usage
                await conn.query(`
                    UPDATE customer_traffic_usage 
                    SET total_bytes_upload = ?, total_bytes_download = ?,
                        last_mikrotik_tx = ?, last_mikrotik_rx = ?, updated_at = NOW()
                    WHERE id = ?
                `, [newTotalUp, newTotalDown, upBytes, downBytes, usage.id]);
                // --- FUP Logic ---
                if (cust.is_fup_enabled && cust.fup_limit_gb && cust.fup_speed_limit) {
                    const totalGb = (newTotalUp + newTotalDown) / (1024 * 1024 * 1024);
                    if (totalGb >= cust.fup_limit_gb && !usage.is_fup_applied) {
                        console.log(`[FupMonitoring] Customer ${cust.pppoe_username} exceeded FUP (${totalGb.toFixed(2)}GB). Applying downgrade to ${cust.fup_speed_limit}...`);
                        // Apply FUP
                        await (0, mikrotikService_1.updateSimpleQueue)(config, queue['.id'], { maxLimit: cust.fup_speed_limit });
                        await conn.query('UPDATE customer_traffic_usage SET is_fup_applied = 1, fup_applied_at = NOW() WHERE id = ?', [usage.id]);
                    }
                }
                // --- Happy Hour (Bonus Speed) Logic ---
                // Native Mikrotik Time rule is better, but since dynamic PPPoE recreates queues, 
                // we enforce it dynamically via Node.js if the user is active, or we inject a parent/top queue.
                // Here we will just create a dedicated static Queue at the top of Mikrotik for Happy Hour.
                if (cust.is_bonus_enabled && cust.bonus_speed_limit && cust.bonus_start_time && cust.bonus_end_time) {
                    const bonusQueueName = `[BONUS] ${cust.pppoe_username || cust.static_ip}`;
                    const existingBonusId = await (0, mikrotikService_1.findSimpleQueueIdByName)(config, bonusQueueName);
                    const timeParam = `${cust.bonus_start_time}-${cust.bonus_end_time},sun,mon,tue,wed,thu,fri,sat`;
                    if (!existingBonusId) {
                        const { createSimpleQueue } = await Promise.resolve().then(() => __importStar(require('../mikrotikService')));
                        await createSimpleQueue(config, {
                            name: bonusQueueName,
                            target: identifier,
                            maxLimit: cust.bonus_speed_limit,
                            time: timeParam,
                            comment: 'Happy Hour Bonus Speed'
                        });
                        // Move to top to ensure it overrides dynamic PPPoE queues
                        // (Assuming simple queue ordering can be managed, for now just adding is enough if PPPoE is below)
                    }
                    else {
                        // Ensure it's updated with correct limits
                        await (0, mikrotikService_1.updateSimpleQueue)(config, existingBonusId, {
                            maxLimit: cust.bonus_speed_limit,
                            time: timeParam
                        });
                    }
                }
            }
        }
        finally {
            conn.release();
        }
    }
    static async resetMonthlyFup() {
        console.log('[FupMonitoring] Resetting all FUPs for the new month...');
        const conn = await pool_1.databasePool.getConnection();
        const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
        try {
            // Find all applied FUPs in the previous period (we just check all where is_fup_applied = 1)
            const [fupUsers] = await conn.query(`
                SELECT c.id, c.pppoe_username, c.static_ip, c.connection_type, p.rate_limit_rx, p.rate_limit_tx
                FROM customer_traffic_usage u
                JOIN customers c ON u.customer_id = c.id
                LEFT JOIN pppoe_packages p ON c.id = ... -- need to join subscriptions to get original speed
                WHERE u.is_fup_applied = 1
            `);
            // To properly restore speed, it's safer to just forcefully drop the active PPPoE connection 
            // so MikroTik reconstructs the Queue with the original Profile limits!
            const fupUserList = fupUsers;
            if (config && fupUserList.length > 0) {
                const { removeActivePppConnection } = await Promise.resolve().then(() => __importStar(require('../mikrotikService')));
                for (const user of fupUserList) {
                    if (user.connection_type === 'pppoe' && user.pppoe_username) {
                        console.log(`[FupMonitoring] Resetting PPPoE session for ${user.pppoe_username} to restore original speed.`);
                        await removeActivePppConnection(config, user.pppoe_username);
                    }
                }
            }
            // Note: The next 15-minute cron will automatically create the new month's record in customer_traffic_usage.
        }
        finally {
            conn.release();
        }
    }
}
exports.FupMonitoringService = FupMonitoringService;
FupMonitoringService.isRunning = false;
//# sourceMappingURL=FupMonitoringService.js.map