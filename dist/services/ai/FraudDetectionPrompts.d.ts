/**
 * Fraud Detection Prompts for AI (Gemini, GPT, etc.)
 * Comprehensive prompts for scanning and verification to prevent fraud
 */
export declare class FraudDetectionPrompts {
    /**
     * PROMPT 1: Payment Proof Verification (Enhanced)
     * Untuk analisis bukti pembayaran dengan deteksi fraud yang lebih ketat
     */
    static getPaymentProofVerificationPrompt(expectedAmount?: number, expectedBank?: string, customerName?: string, invoiceNumber?: string): string;
    /**
     * PROMPT 2: Customer Data Verification
     * Untuk verifikasi data customer baru atau perubahan data
     */
    static getCustomerDataVerificationPrompt(customerData: {
        name?: string;
        phone?: string;
        email?: string;
        address?: string;
        customerCode?: string;
    }, existingData?: any): string;
    /**
     * PROMPT 3: Transaction Pattern Analysis
     * Untuk analisis pola transaksi yang mencurigakan
     */
    static getTransactionPatternAnalysisPrompt(transactionHistory: any[], currentTransaction: any): string;
    /**
     * PROMPT 4: Image Metadata Analysis
     * Untuk analisis metadata gambar bukti pembayaran
     */
    static getImageMetadataAnalysisPrompt(): string;
    /**
     * PROMPT 5: Comprehensive Fraud Scan
     * Scan menyeluruh untuk semua aspek fraud detection
     */
    static getComprehensiveFraudScanPrompt(paymentData: any, customerData: any, transactionHistory: any[]): string;
    /**
     * PROMPT 6: Real-time Fraud Monitoring
     * Untuk monitoring real-time dan deteksi fraud patterns
     */
    static getRealTimeFraudMonitoringPrompt(recentTransactions: any[], systemMetrics: any): string;
}
//# sourceMappingURL=FraudDetectionPrompts.d.ts.map