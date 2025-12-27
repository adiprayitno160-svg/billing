import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
export declare class KasirController {
    private userService;
    constructor();
    loginForm(req: Request, res: Response): Promise<void>;
    login(req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    dashboard(req: AuthenticatedRequest, res: Response): Promise<void>;
    transactions(req: AuthenticatedRequest, res: Response): Promise<void>;
    payments(req: AuthenticatedRequest, res: Response): Promise<void>;
    searchCustomer(req: AuthenticatedRequest, res: Response): Promise<void>;
    getCustomerInvoices(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPaymentDetail(req: AuthenticatedRequest, res: Response): Promise<void>;
    printIndividual(req: AuthenticatedRequest, res: Response): Promise<void>;
    printGroup(req: AuthenticatedRequest, res: Response): Promise<void>;
    printChecklist(req: AuthenticatedRequest, res: Response): Promise<void>;
    printReceipt(req: AuthenticatedRequest, res: Response): Promise<void>;
    reports(req: AuthenticatedRequest, res: Response): Promise<void>;
    exportReports(req: AuthenticatedRequest, res: Response): Promise<void>;
    processPayment(req: AuthenticatedRequest, res: Response): Promise<void>;
    private getKasirStats;
    private getTransactions;
    private getKasirReports;
    private processPaymentTransaction;
    private sendPaymentNotification;
    private trackLatePayment;
    private getPaymentMethodName;
    printInvoice(req: AuthenticatedRequest, res: Response): Promise<void>;
    exportPaymentRecords(req: AuthenticatedRequest, res: Response): Promise<void>;
    printPaymentRecord(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=kasirController.d.ts.map