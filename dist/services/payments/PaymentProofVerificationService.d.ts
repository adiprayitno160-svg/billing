/**
 * Service to verify payment proof images using a combination of OCR (stub) and Gemini Vision.
 * Returns detailed verification data and a fraud score (0 = no fraud, 1 = high fraud).
 */
export declare class PaymentProofVerificationService {
    /**
     * Verify the image buffer.
     * @param buffer Image buffer of the payment proof.
     * @param expectedAmount Amount that the user is expected to pay (from session).
     * @param customerId ID of the customer (optional, used for duplicate check).
     */
    static verify(buffer: Buffer, expectedAmount: number, customerName: string, customerPhone: string): Promise<{
        status: 'auto_approved' | 'manual_review' | 'rejected';
        message: string;
        extractedData?: any;
        proofHash?: string;
    }>;
}
//# sourceMappingURL=PaymentProofVerificationService.d.ts.map