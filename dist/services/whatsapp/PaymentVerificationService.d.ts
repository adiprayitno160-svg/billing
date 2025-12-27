/**
 * Payment Verification Service
 * Handles payment proof verification using OCR and AI
 */
import { MessageMedia } from 'whatsapp-web.js';
export interface VerificationResult {
    success: boolean;
    error?: string;
    invoiceNumber?: string;
    invoiceStatus?: string;
    amount?: number;
    confidence?: number;
}
export declare class PaymentVerificationService {
    /**
     * Verify payment proof automatically - AI will analyze and match
     */
    static verifyPaymentProofAuto(media: MessageMedia, customerId: number): Promise<VerificationResult>;
    /**
     * Verify postpaid payment (invoice payment)
     */
    private static verifyPostpaidPayment;
    /**
     * Record invoice payment
     */
    private static recordInvoicePayment;
    /**
     * Save invoice payment verification record
     */
    private static saveInvoicePaymentVerification;
    /**
     * Extract payment data from image using OCR/AI
     */
    private static extractPaymentData;
}
//# sourceMappingURL=PaymentVerificationService.d.ts.map