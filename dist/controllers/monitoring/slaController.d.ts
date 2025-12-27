/**
 * SLA Controller - Service Level Agreement Management
 * Handles SLA dashboard, reports, and discount approvals
 */
import { Request, Response } from 'express';
export declare class SLAController {
    /**
     * GET /monitoring/sla
     * SLA Dashboard - Overview of all customers' SLA performance
     */
    dashboard(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/sla/customer/:customerId
     * Detailed SLA view for specific customer
     */
    customerDetail(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/sla/incidents
     * List all SLA incidents
     */
    incidents(req: Request, res: Response): Promise<void>;
    /**
     * POST /monitoring/sla/incident/:id/exclude
     * Exclude incident from SLA calculation (Admin only)
     */
    excludeIncident(req: Request, res: Response): Promise<void>;
    /**
     * POST /monitoring/sla/discount/:id/approve
     * Approve SLA discount (Admin only)
     */
    approveDiscount(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/monitoring/bandwidth/:customerId
     * Get bandwidth trend data for charts (API)
     */
    getBandwidthTrend(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/monitoring/sla/stats
     * Get SLA statistics (API)
     */
    getStats(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/sla/calculate
     * Manually trigger SLA calculation (Admin only)
     */
    triggerCalculation(req: Request, res: Response): Promise<void>;
}
export default SLAController;
//# sourceMappingURL=slaController.d.ts.map