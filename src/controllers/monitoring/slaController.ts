import { Request, Response } from 'express';
import SLAMonitoringService from '../../services/slaMonitoringService';

export default class SLAController {
    /**
     * Render SLA Dashboard
     */
    async dashboard(req: Request, res: Response): Promise<void> {
        try {
            res.render('monitoring/sla', {
                title: 'SLA Monitoring',
                layout: 'layouts/main'
            });
        } catch (error) {
            console.error('Error rendering SLA page:', error);
            res.status(500).send('Error loading SLA page');
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
