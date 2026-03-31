/**
 * Payment Verification Service
 * Handles payment proof verification using OCR and AI
 */
interface MediaMessage {
    data: string | Buffer;
    mimetype?: string;
    filename?: string;
}
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
    static verifyPaymentProofAuto(media: MediaMessage, customerId: number): Promise<VerificationResult>;
    /**
     * Verify postpaid payment (invoice payment)
     */
    private static verifyPostpaidPayment;
    /**
     * Verify prepaid payment (Top-up with unique code)
     */
    private static verifyPrepaidPayment;
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
export {};
//# sourceMappingURL=PaymentVerificationService.d.ts.map