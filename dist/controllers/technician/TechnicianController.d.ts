import { Request, Response } from 'express';
export declare class TechnicianController {
    static ensureTables(): Promise<void>;
    static dashboard(req: Request, res: Response): Promise<void>;
    static getJobs(req: Request, res: Response): Promise<void>;
    static getJobHistory(req: Request, res: Response): Promise<void>;
    static apiSearchCustomers(req: Request, res: Response): Promise<void>;
    static apiSaveJob(req: Request, res: Response): Promise<void>;
    static createJob(data: {
        title: string;
        description?: string;
        customer_id?: number;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        coordinates?: string;
        address?: string;
        reported_by?: string;
        job_type_id?: number;
        fee?: number;
    }): Promise<string>;
    static acceptJob(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static declineJob(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static completeJob(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static getJobDetail(req: Request, res: Response): Promise<void>;
    static verifyJob(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static deleteJob(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=TechnicianController.d.ts.map