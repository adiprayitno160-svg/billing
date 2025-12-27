import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
export declare class ReportingController {
    private db;
    constructor(db: Pool);
    getDashboardAnalytics: (req: Request, res: Response) => Promise<void>;
    getONTPerformanceReport: (req: Request, res: Response) => Promise<void>;
    getBillingAnalyticsReport: (req: Request, res: Response) => Promise<void>;
    getPONUtilizationReport: (req: Request, res: Response) => Promise<void>;
    getCustomerAnalyticsReport: (req: Request, res: Response) => Promise<void>;
    exportReport: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=reportingController.d.ts.map