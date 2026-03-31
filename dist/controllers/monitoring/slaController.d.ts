import { Request, Response } from 'express';
export default class SLAController {
    /**
     * Get AI-Enhanced SLA Report
     */
    getAiSlaReport(req: Request, res: Response): Promise<void>;
    /**
     * Render SLA Dashboard with customer list
     */
    dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Get SLA statistics for KPI cards
     */
    private getSLAStats;
    /**
     * Get Detailed Analysis (API)
     */
    getAnalysis(req: Request, res: Response): Promise<void>;
    customerDetail(req: Request, res: Response): Promise<void>;
    incidents(req: Request, res: Response): Promise<void>;
    excludeIncident(req: Request, res: Response): Promise<void>;
    approveDiscount(req: Request, res: Response): Promise<void>;
    triggerCalculation(req: Request, res: Response): Promise<void>;
    getBandwidthTrend(req: Request, res: Response): Promise<void>;
    getStats(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=slaController.d.ts.map