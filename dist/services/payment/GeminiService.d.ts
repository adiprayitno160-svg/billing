/**
 * Gemini Service
 * Integration with Google Gemini API for payment proof analysis
 * Uses Gemini Vision API to analyze payment proof images
 */
export interface GeminiAnalysisResult {
    isValid: boolean;
    confidence: number;
    extractedData: {
        amount?: number;
        date?: string;
        bank?: string;
        accountNumber?: string;
        accountHolder?: string;
        referenceNumber?: string;
        transferMethod?: string;
    };
    validation: {
        isPaymentProof: boolean;
        isRecent: boolean;
        amountMatches: boolean;
        bankMatches: boolean;
        riskLevel: 'low' | 'medium' | 'high';
        riskReasons: string[];
    };
    rawResponse: any;
}
export declare class GeminiService {
    private static genAI;
    private static model;
    /**
     * Reset model (call this when settings change)
     */
    static resetModel(): void;
    /**
     * Initialize Gemini API (reads from database)
     */
    private static initialize;
    /**
     * Check if AI analysis is enabled
     */
    static isEnabled(): Promise<boolean>;
    /**
     * Analyze payment proof image using Gemini Vision
     * Enhanced with comprehensive fraud detection
     */
    static analyzePaymentProof(imageBuffer: Buffer, expectedAmount?: number, expectedBank?: string, customerName?: string, invoiceNumber?: string): Promise<GeminiAnalysisResult>;
    /**
     * Build analysis prompt for Gemini
     * Uses comprehensive fraud detection prompts
     */
    private static buildAnalysisPrompt;
    /**
     * Parse Gemini response to structured data
     */
    private static parseGeminiResponse;
    /**
     * Detect MIME type from image buffer
     */
    private static detectMimeType;
    /**
     * Determine if payment should be auto-approved based on Gemini analysis
     */
    static shouldAutoApprove(analysis: GeminiAnalysisResult): Promise<{
        shouldApprove: boolean;
        confidence: number;
        reasons: string[];
    }>;
}
//# sourceMappingURL=GeminiService.d.ts.map