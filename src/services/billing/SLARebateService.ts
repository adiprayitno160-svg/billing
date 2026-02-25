
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export interface SLARebateInfo {
    customerId: number;
    billingPeriod: string;
    uptimePercentage: number;
    targetSla: number;
    isEligible: boolean;
    rebateAmount: number;
    reason: string;
}

export class SLARebateService {
    /**
     * Calculate SLA Uptime and Rebate for a customer in a specific period
     */
    static async calculateRebate(customerId: number, period: string): Promise<SLARebateInfo> {
        // 1. Get Customer SLA Settings & Tier
        const [settings] = await databasePool.query<RowDataPacket[]>(`
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

        if (settings.length === 0) throw new Error('Customer not found');
        const config = settings[0];

        // 2. Calculate Actual Uptime from connection_logs
        // period format: YYYY-MM
        const startTime = `${period}-01 00:00:00`;
        const endTime = new Date(new Date(`${period}-01`).getFullYear(), new Date(`${period}-01`).getMonth() + 1, 0).toISOString().split('T')[0] + ' 23:59:59';

        const [logs] = await databasePool.query<RowDataPacket[]>(`
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
        } else {
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
    static async applyRebateToInvoice(invoiceId: number): Promise<boolean> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT id, customer_id, period, total_amount FROM invoices WHERE id = ?", [invoiceId]
            );
            if (rows.length === 0) return false;
            const invoice = rows[0];

            const rebate = await this.calculateRebate(invoice.customer_id, invoice.period);

            if (rebate.isEligible && rebate.rebateAmount > 0) {
                const { DiscountService } = await import('./discountService');
                const connection = await databasePool.getConnection();

                try {
                    await connection.beginTransaction();

                    // 1. Log to discounts table (invoice-level)
                    await connection.query(
                        "INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, created_at) VALUES (?, 'sla', ?, ?, NOW())",
                        [invoiceId, rebate.rebateAmount, rebate.reason]
                    );

                    // 2. Also log to customer_discounts for history
                    await connection.query(
                        "INSERT INTO customer_discounts (customer_id, discount_amount, reason, created_at) VALUES (?, ?, ?, NOW())",
                        [invoice.customer_id, rebate.rebateAmount, rebate.reason]
                    );

                    // 3. Update invoice totals correctly
                    await DiscountService.updateInvoiceTotals(invoiceId, connection);

                    await connection.commit();
                    console.log(`[SLARebate] Applied Rp ${rebate.rebateAmount} rebate to Invoice #${invoiceId} for ${invoice.period}`);
                    return true;
                } catch (err) {
                    await connection.rollback();
                    throw err;
                } finally {
                    connection.release();
                }
            }

            return false;
        } catch (error) {
            console.error('[SLARebate] Error applying rebate:', error);
            return false;
        }
    }
}
