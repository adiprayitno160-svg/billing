/**
 * OCR Service
 * Extract text from payment proof images using Tesseract.js
 */
export interface ExtractedPaymentData {
    amount?: number;
    date?: Date;
    bank?: string;
    accountHolder?: string;
    accountNumber?: string;
    referenceNumber?: string;
    confidence: number;
    rawText: string;
}
export declare class OCRService {
    /**
     * Extract payment data from image buffer
     */
    static extractPaymentData(imageBuffer: Buffer): Promise<ExtractedPaymentData>;
    /**
     * Preprocess image for better OCR accuracy
     */
    private static preprocessImage;
    /**
     * Parse extracted text to extract payment details
     */
    private static parsePaymentText;
}
//# sourceMappingURL=OCRService.d.ts.map