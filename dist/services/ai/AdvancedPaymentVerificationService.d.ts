/**
 * Advanced AI Payment Verification Service
 * Enhanced with smart detection, multi-stage verification, and auto-approve logic
 */
export interface AdvancedVerificationResult {
    success: boolean;
    stage: 'extraction' | 'matching' | 'validation' | 'approval' | 'complete';
    error?: string;
    data?: {
        invoiceId?: number;
        invoiceNumber?: string;
        paymentRequestId?: number;
        customerId?: number;
        customerName?: string;
        expectedAmount?: number;
        extractedAmount?: number;
        amountMatch?: 'exact' | 'close' | 'partial' | 'mismatch';
        confidence: number;
        riskLevel: string;
        riskScore: number;
        autoApproved?: boolean;
        isPaymentProof?: boolean;
        bank?: string;
        referenceNumber?: string;
        date?: string;
        time?: string;
        fraudIndicators: any[];
        reasoning?: string;
    };
    actions?: {
        paymentRecorded?: boolean;
        isolationRemoved?: boolean;
        notificationSent?: boolean;
    };
}
export interface VerificationStageResult {
    passed: boolean;
    confidence: number;
    details: any;
    warnings: string[];
}
export declare class AdvancedPaymentVerificationService {
    /**
     * Main entry point - Smart payment verification with multi-stage processing
     */
    static verifyPaymentAdvanced(imageBuffer: Buffer, customerId: number, options?: {
        forceManualReview?: boolean;
        bypassAmountCheck?: boolean;
        invoiceId?: number;
    }): Promise<AdvancedVerificationResult>;
    /**
     * Stage 1: Extract payment data from image
     */
    private static stageExtraction;
    /**
     * Enhanced amount extraction with specialized prompt
     */
    private static enhancedAmountExtraction;
    /**
     * Stage 2: Match extracted amount with invoices
     */
    private static stageMatching;
    /**
     * Stage 3: Validate payment proof with fraud detection
     */
    private static stageValidation;
    /**
     * Calculate risk score from validation result
     */
    private static calculateRiskScore;
    /**
     * Stage 4: Determine if auto-approve should happen
     * SIMPLIFIED LOGIC: Approve if amount matches, only block for clear fraud (duplicate ref)
     */
    private static stageApproval;
    /**
     * Check if reference number already exists in payments table
     */
    private static checkReferenceNumber;
    /**
     * Verify if the date and time is within acceptable range (last 48 hours)
     */
    private static verifyDateTime;
    /**
     * Stage 5: Execute auto-approve actions
     */
    private static executeAutoApproveActions;
    /**
     * Log verification attempt for analytics
     */
    private static logVerificationAttempt;
    /**
     * Get verification statistics
     */
    static getVerificationStatistics(dateRange?: {
        from: Date;
        to: Date;
    }): Promise<{
        total: number;
        autoApproved: number;
        manualReview: number;
        rejected: number;
        avgConfidence: number;
        avgProcessingTime: number;
    }>;
}
//# sourceMappingURL=AdvancedPaymentVerificationService.d.ts.map