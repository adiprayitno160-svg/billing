import { Request, Response } from 'express';
export declare class TechnicianSalaryController {
    static checkIn(req: Request, res: Response): Promise<void>;
    static viewMonthlyRecap(req: Request, res: Response): Promise<void>;
    static ensurePaymentTable(): Promise<void>;
    static approveSalary(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static viewPaymentSummary(req: Request, res: Response): Promise<void>;
    static printSalarySlip(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static viewMySalaryHistory(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=TechnicianSalaryController.d.ts.map