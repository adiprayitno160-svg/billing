"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
class SLAController {
    /**
     * Get AI-Enhanced SLA Report
     */
    async getAiSlaReport(req, res) {
        try {
            const { customerId, month, year } = req.query;
            if (!customerId || !month || !year) {
                res.status(400).json({ success: false, error: 'Missing parameters: customerId, month, year' });
                return;
            }
            const report = { error: 'SLA Module removed' };
            res.json({ success: true, data: report });
        }
        catch (error) {
            console.error('SLA Report Error:', error);
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * Render SLA Dashboard with customer list
     */
    async dashboard(req, res) {
        try {
            // Fetch all active customers for the dropdown
            const [customers] = await pool_1.default.query(`
                SELECT 
                    c.id, 
                    c.name, 
                    c.customer_code,
                    c.connection_type
                FROM customers c
                WHERE c.status = 'active'
                ORDER BY c.name ASC
            `);
            // Get SLA stats for KPI cards
            const stats = await this.getSLAStats();
            res.render('monitoring/sla', {
                title: 'SLA Monitoring',
                layout: 'layouts/main',
                customers: customers || [],
                stats: stats
            });
        }
        catch (error) {
            console.error('Error rendering SLA page:', error);
            res.status(500).send('Error loading SLA page');
        }
    }
    /**
     * Get SLA statistics for KPI cards
     */
    async getSLAStats() {
        try {
            const currentMonth = new Date();
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const periodStr = startOfMonth.toISOString().slice(0, 7);
            // Average reliability score (from sla_records)
            const [reliabilityResult] = await pool_1.default.query(`
                SELECT AVG(sla_percentage) as avg_reliability
                FROM sla_records
                WHERE period = ?
            `, [periodStr]);
            // Count SLA breaches this month (where sla_percentage < sla_target)
            const [breachResult] = await pool_1.default.query(`
                SELECT COUNT(*) as breach_count
                FROM sla_records
                WHERE period = ?
                AND sla_percentage < sla_target
            `, [periodStr]);
            // Active/ongoing incidents
            const [incidentResult] = await pool_1.default.query(`
                SELECT COUNT(*) as active_incidents
                FROM sla_incidents
                WHERE status = 'ongoing'
            `);
            // Total refund/discount amount this month
            const [refundResult] = await pool_1.default.query(`
                SELECT COALESCE(SUM(discount_amount), 0) as total_refund
                FROM sla_records
                WHERE period = ?
                AND discount_approved = 1
            `, [periodStr]);
            // Recent breaches with customer info
            const [recentBreaches] = await pool_1.default.query(`
                SELECT 
                    sr.id,
                    sr.customer_id,
                    c.name as customer_name,
                    c.customer_code,
                    sr.sla_percentage,
                    sr.sla_target,
                    sr.downtime_minutes,
                    sr.period
                FROM sla_records sr
                JOIN customers c ON sr.customer_id = c.id
                WHERE sr.sla_percentage < sr.sla_target
                ORDER BY sr.calculated_at DESC
                LIMIT 10
            `);
            return {
                avgReliability: reliabilityResult[0]?.avg_reliability || null,
                breachCount: breachResult[0]?.breach_count || 0,
                activeIncidents: incidentResult[0]?.active_incidents || 0,
                totalRefund: refundResult[0]?.total_refund || 0,
                recentBreaches: recentBreaches || []
            };
        }
        catch (error) {
            console.error('[SLAController] Error getting SLA stats:', error);
            return {
                avgReliability: null,
                breachCount: 0,
                activeIncidents: 0,
                totalRefund: 0,
                recentBreaches: []
            };
        }
    }
    /**
     * Get Detailed Analysis (API)
     */
    async getAnalysis(req, res) {
        try {
            const customerId = parseInt(req.params.customerId);
            if (isNaN(customerId)) {
                res.status(400).json({ success: false, message: 'Invalid customer ID' });
                return;
            }
            const analysis = {
                reliability_score: 99,
                current_month: { downtime_minutes: 0 }
            };
            const breachProbability = 'Low';
            const refundEligible = false;
            res.json({
                success: true,
                data: {
                    ...analysis,
                    breach_probability: breachProbability,
                    refund_eligible: refundEligible
                }
            });
        }
        catch (error) {
            console.error('[SLAController] Error getting analysis:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
    // === Stubs/Implementations for methods required by sla.ts ===
    async customerDetail(req, res) {
        // Implement or redirect
        res.render('monitoring/sla-detail', { customerId: req.params.customerId });
    }
    async incidents(req, res) {
        res.json({ success: true, data: [] }); // Stub
    }
    async excludeIncident(req, res) {
        res.json({ success: true, message: 'Incident excluded' }); // Stub
    }
    async approveDiscount(req, res) {
        try {
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false });
        }
    }
    async triggerCalculation(req, res) {
        res.json({ success: true });
    }
    async getBandwidthTrend(req, res) {
        res.json({ success: true, data: [] }); // Stub
    }
    async getStats(req, res) {
        res.json({ success: true, data: { uptime: 99.9 } }); // Stub
    }
}
exports.default = SLAController;
//# sourceMappingURL=slaController.js.map