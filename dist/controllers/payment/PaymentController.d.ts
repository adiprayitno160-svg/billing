import { Request, Response } from 'express';
import { PaymentGatewayService } from '../../services/payment/PaymentGatewayService';
export declare class PaymentController {
    private paymentService;
    constructor(paymentService: PaymentGatewayService);
    /**
     * Membuat payment request
     */
    createPayment(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan status payment
     */
    getPaymentStatus(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan daftar payment methods
     */
    getPaymentMethods(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan riwayat transaksi
     */
    getTransactionHistory(req: Request, res: Response): Promise<void>;
    /**
     * Webhook handler untuk Xendit
     */
    xenditWebhook(req: Request, res: Response): Promise<void>;
    /**
     * Webhook handler untuk Mitra
     */
    mitraWebhook(req: Request, res: Response): Promise<void>;
    /**
     * Webhook handler untuk Tripay
     */
    tripayWebhook(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan konfigurasi payment gateway
     */
    getGatewayConfig(req: Request, res: Response): Promise<void>;
    /**
     * Update konfigurasi payment gateway
     */
    updateGatewayConfig(req: Request, res: Response): Promise<void>;
    /**
     * Refresh status transaksi
     */
    refreshTransactionStatus(req: Request, res: Response): Promise<void>;
    /**
     * Batalkan transaksi
     */
    cancelTransaction(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=PaymentController.d.ts.map