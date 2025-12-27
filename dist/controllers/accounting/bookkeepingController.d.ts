import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/authMiddleware';
export declare class BookkeepingController {
    /**
     * Halaman pembukuan
     */
    index(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Export PDF untuk Piutang
     */
    exportUnpaidPDF(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Export PDF untuk Pembayaran
     */
    exportPaidPDF(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Print view untuk Piutang
     */
    printUnpaid(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Print view untuk Pembayaran
     */
    printPaid(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=bookkeepingController.d.ts.map