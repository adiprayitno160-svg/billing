import { Request, Response } from 'express';
export declare class MonitoringController {
    /**
     * Dashboard monitoring - gabungan PPPoE dan Static IP
     */
    getMonitoringDashboard(req: Request, res: Response): Promise<void>;
    /**
     * Monitor Troubled Customers (Full Page)
     */
    monitorTrouble(req: Request, res: Response): Promise<void>;
    /**
     * Monitor PPPoE Customers
     */
    monitorPPPoE(req: Request, res: Response): Promise<void>;
    /**
     * Monitor Static IP Customers with Real Ping Status
     */
    monitorStaticIP(req: Request, res: Response): Promise<void>;
    /**
     * Get customer detail with online status
     */
    getCustomerDetail(req: Request, res: Response): Promise<void>;
    /**
     * Disconnect PPPoE session
     */
    disconnectPPPoESession(req: Request, res: Response): Promise<void>;
    /**
     * Get real-time traffic statistics
     */
    getTrafficStats(req: Request, res: Response): Promise<void>;
    /**
     * Get Static IP ping status and downtime history
     */
    getStaticIPStatus(req: Request, res: Response): Promise<void>;
    /**
     * Get downtime history for Static IP customer
     */
    getDowntimeHistory(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/analytics/bandwidth
     * Get bandwidth analytics
     */
    getBandwidthAnalytics(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/analytics/health
     * Get network health overview
     */
    getNetworkHealth(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/analytics/anomalies
     * Get real-time anomalies
     */
    getAnomalies(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/analytics/incident/:id
     * Get AI analysis for specific incident
     */
    getIncidentAnalysis(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/ai
     * Monitoring AI Analytics page
     */
    getAIAnalyticsPage(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=monitoringController.d.ts.map