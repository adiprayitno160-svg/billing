import { Request, Response } from 'express';
import SLAMonitoringService from '../../services/slaMonitoringService';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export default class SLAController {
    /**
     * Render SLA Dashboard with customer list
     */
    async dashboard(req: Request, res: Response): Promise<void> {
        try {
            // Fetch all active customers for the dropdown
            const [customers] = await pool.query<RowDataPacket[]>(`
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
        } catch (error) {
            console.error('Error rendering SLA page:', error);
            res.status(500).send('Error loading SLA page');
        }
    }

    /**
     * Get SLA statistics for KPI cards
     */
    private async getSLAStats(): Promise<any> {
        try {
            const currentMonth = new Date();
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const periodStr = startOfMonth.toISOString().slice(0, 7);

            // Average reliability score (from sla_records)
            const [reliabilityResult] = await pool.query<RowDataPacket[]>(`
                SELECT AVG(sla_percentage) as avg_reliability
                FROM sla_records
                WHERE period = ?
            `, [periodStr]);

            // Count SLA breaches this month (where sla_percentage < sla_target)
            const [breachResult] = await pool.query<RowDataPacket[]>(`
                SELECT COUNT(*) as breach_count
                FROM sla_records
                WHERE period = ?
                AND sla_percentage < sla_target
            `, [periodStr]);

            // Active/ongoing incidents
            const [incidentResult] = await pool.query<RowDataPacket[]>(`
                SELECT COUNT(*) as active_incidents
                FROM sla_incidents
                WHERE status = 'ongoing'
            `);

            // Total refund/discount amount this month
            const [refundResult] = await pool.query<RowDataPacket[]>(`
                SELECT COALESCE(SUM(discount_amount), 0) as total_refund
                FROM sla_records
                WHERE period = ?
                AND discount_approved = 1
            `, [periodStr]);

            // Recent breaches with customer info
            const [recentBreaches] = await pool.query<RowDataPacket[]>(`
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
        } catch (error) {
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
    async getAnalysis(req: Request, res: Response): Promise<void> {
        try {
            const customerId = parseInt(req.params.customerId);
            if (isNaN(customerId)) {
                res.status(400).json({ success: false, message: 'Invalid customer ID' });
                return;
            }

            const analysis = await SLAMonitoringService.getSLAAnalysis(customerId);

            // Calculate breach probability
            const breachProbability = analysis.reliability_score < 95 ? 'High' : (analysis.reliability_score < 99 ? 'Medium' : 'Low');

            // Refund eligibility
            const refundEligible = analysis.current_month.downtime_minutes > (30 * 24 * 60 * 0.01);

            res.json({
                success: true,
                data: {
                    ...analysis,
                    breach_probability: breachProbability,
                    refund_eligible: refundEligible
                }
            });
        } catch (error) {
            console.error('[SLAController] Error getting analysis:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    // === Stubs/Implementations for methods required by sla.ts ===

    async customerDetail(req: Request, res: Response): Promise<void> {
        // Implement or redirect
        res.render('monitoring/sla-detail', { customerId: req.params.customerId });
    }

    async incidents(req: Request, res: Response): Promise<void> {
        res.json({ success: true, data: [] }); // Stub
    }

    async excludeIncident(req: Request, res: Response): Promise<void> {
        res.json({ success: true, message: 'Incident excluded' }); // Stub
    }

    async approveDiscount(req: Request, res: Response): Promise<void> {
        // Use SLAMonitoringService.approveDiscount
        try {
            const id = parseInt(req.params.id);
            const userId = (req as any).user?.id || 0;
            await SLAMonitoringService.approveDiscount(id, userId);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ success: false });
        }
    }

    async triggerCalculation(req: Request, res: Response): Promise<void> {
        await SLAMonitoringService.calculateMonthlySLA();
        res.json({ success: true });
    }

    async getBandwidthTrend(req: Request, res: Response): Promise<void> {
        res.json({ success: true, data: [] }); // Stub
    }

    async getStats(req: Request, res: Response): Promise<void> {
        res.json({ success: true, data: { uptime: 99.9 } }); // Stub
    }
}
