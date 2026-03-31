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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLARebateService = void 0;
const pool_1 = require("../../db/pool");
class SLARebateService {
    /**
     * Calculate SLA Uptime and Rebate for a customer in a specific period
     */
    static async calculateRebate(customerId, period) {
        // 1. Get Customer SLA Settings & Tier
        const [settings] = await pool_1.databasePool.query(`
            SELECT 
                c.id, c.name,
                COALESCE(css.custom_sla_target, ct.sla_target, 99.0) as target_sla,
                COALESCE(css.custom_discount_rate, ct.discount_rate, 0) as discount_rate,
                COALESCE(css.custom_max_discount_percent, ct.max_discount_percent, 10.0) as max_discount_pct
            FROM customers c
            LEFT JOIN customer_sla_settings css ON c.id = css.customer_id
            LEFT JOIN customer_tiers ct ON css.tier_id = ct.id
            WHERE c.id = ?
        `, [customerId]);
        if (settings.length === 0)
            throw new Error('Customer not found');
        const config = settings[0];
        // 2. Calculate Actual Uptime from connection_logs
        // period format: YYYY-MM
        const startTime = `${period}-01 00:00:00`;
        const endTime = new Date(new Date(`${period}-01`).getFullYear(), new Date(`${period}-01`).getMonth() + 1, 0).toISOString().split('T')[0] + ' 23:59:59';
        const [logs] = await pool_1.databasePool.query(`
            SELECT 
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_checks
            FROM connection_logs
            WHERE customer_id = ? AND timestamp BETWEEN ? AND ?
        `, [customerId, startTime, endTime]);
        const totalChecks = Number(logs[0].total_checks);
        const onlineChecks = Number(logs[0].online_checks);
        // If no logs, assume 100% or skip? Let's assume 100% for safety (no complaints if no data)
        const uptimePercentage = totalChecks > 0 ? (onlineChecks / totalChecks) * 100 : 100.0;
        const targetSla = Number(config.target_sla);
        // 3. Determine Eligibility and Calculate Amount
        let isEligible = false;
        let rebateAmount = 0;
        let reason = '';
        if (uptimePercentage < targetSla) {
            isEligible = true;
            // Linear rebate formula: (Target - Actual) * Discount Rate per percent
            // Or use a fixed discount rate from the tier
            const diff = targetSla - uptimePercentage;
            rebateAmount = diff * Number(config.discount_rate);
            // Cap at max percentage of typical invoice? 
            // For now, let's just use the calculated amount. 
            reason = `SLA Rebate: Uptime ${uptimePercentage.toFixed(2)}% (Target ${targetSla}%). Diff: ${diff.toFixed(2)}%`;
        }
        else {
            reason = `SLA Target Met: ${uptimePercentage.toFixed(2)}% >= ${targetSla}%`;
        }
        return {
            customerId,
            billingPeriod: period,
            uptimePercentage,
            targetSla,
            isEligible,
            rebateAmount,
            reason
        };
    }
    /**
     * Apply SLA Rebate to an invoice
     */
    static async applyRebateToInvoice(invoiceId) {
        try {
            const [rows] = await pool_1.databasePool.query("SELECT id, customer_id, period, total_amount FROM invoices WHERE id = ?", [invoiceId]);
            if (rows.length === 0)
                return false;
            const invoice = rows[0];
            const rebate = await this.calculateRebate(invoice.customer_id, invoice.period);
            if (rebate.isEligible && rebate.rebateAmount > 0) {
                const { DiscountService } = await Promise.resolve().then(() => __importStar(require('./discountService')));
                const connection = await pool_1.databasePool.getConnection();
                try {
                    await connection.beginTransaction();
                    // 1. Log to discounts table (invoice-level)
                    await connection.query("INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, created_at) VALUES (?, 'sla', ?, ?, NOW())", [invoiceId, rebate.rebateAmount, rebate.reason]);
                    // 2. Also log to customer_discounts for history
                    await connection.query("INSERT INTO customer_discounts (customer_id, discount_amount, reason, created_at) VALUES (?, ?, ?, NOW())", [invoice.customer_id, rebate.rebateAmount, rebate.reason]);
                    // 3. Update invoice totals correctly
                    await DiscountService.updateInvoiceTotals(invoiceId, connection);
                    await connection.commit();
                    console.log(`[SLARebate] Applied Rp ${rebate.rebateAmount} rebate to Invoice #${invoiceId} for ${invoice.period}`);
                    return true;
                }
                catch (err) {
                    await connection.rollback();
                    throw err;
                }
                finally {
                    connection.release();
                }
            }
            return false;
        }
        catch (error) {
            console.error('[SLARebate] Error applying rebate:', error);
            return false;
        }
    }
}
exports.SLARebateService = SLARebateService;
//# sourceMappingURL=SLARebateService.js.map