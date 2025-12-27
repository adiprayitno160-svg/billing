/**
 * Payment Approval Service
 * Handles auto-approval and manual review workflow
 */
import { ExtractedPaymentData } from './OCRService';
import { MatchingResult } from './InvoiceMatchingService';
export interface ApprovalDecision {
    action: 'auto_approve' | 'manual_review' | 'priority_review';
    confidence: number;
    fraudScore: number;
    reasons: string[];
    invoiceId?: number;
    amount?: number;
}
export interface PaymentVerificationRecord {
    id?: number;
    customer_id: number;
    invoice_id?: number;
    amount: number;
    payment_proof_url: string;
    extracted_data?: any;
    matching_result?: any;
    fraud_score?: number;
    confidence_score?: number;
    status: 'pending' | 'approved' | 'rejected';
    verification_notes?: string;
    verified_by?: number;
    verified_at?: Date;
}
export declare class PaymentApprovalService {
    /**
     * Process payment proof and make approval decision
     * Now uses Gemini AI for enhanced analysis
     */
    static processPaymentProof(customerId: number, imageBuffer: Buffer, proofUrl: string, extractedData: ExtractedPaymentData, matchingResult: MatchingResult, expectedAmount?: number, expectedBank?: string): Promise<ApprovalDecision & {
        verificationId?: number;
    }>;
    /**
     * Calculate overall confidence score
     */
    private static calculateConfidenceScore;
    /**
     * Make approval decision based on confidence and fraud score
     */
    private static makeDecision;
    /**
     * Auto-approve payment
     */
    static autoApprovePayment(verificationId: number, invoiceId: number, amount: number, customerId: number): Promise<void>;
    /**
     * Save verification record
     */
    private static saveVerificationRecord;
    /**
     * Create payment_verifications table if not exists
     */
    private static createVerificationTable;
}
//# sourceMappingURL=PaymentApprovalService.d.ts.map