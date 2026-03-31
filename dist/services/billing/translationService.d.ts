export interface TranslationCache {
    id: number;
    source_text: string;
    source_language: string;
    target_language: string;
    translated_text: string;
    confidence_score: number;
    created_at: Date;
}
export declare class TranslationService {
    /**
     * Translate text with caching
     */
    static translateText(text: string, sourceLanguage?: string, targetLanguage?: string): Promise<string>;
    /**
     * Get cached translation
     */
    private static getCachedTranslation;
    /**
     * Cache translation
     */
    private static cacheTranslation;
    /**
     * Perform translation (mock implementation)
     */
    private static performTranslation;
    /**
     * Translate WhatsApp message
     */
    static translateWhatsAppMessage(message: string, customerLanguage?: string, botLanguage?: string): Promise<string>;
    /**
     * Translate customer response
     */
    static translateCustomerResponse(message: string, customerLanguage?: string, adminLanguage?: string): Promise<string>;
    /**
     * Detect language
     */
    static detectLanguage(text: string): Promise<string>;
    /**
     * Get supported languages
     */
    static getSupportedLanguages(): {
        [key: string]: string;
    };
    /**
     * Get translation statistics
     */
    static getTranslationStatistics(days?: number): Promise<any>;
    /**
     * Clean old cache entries
     */
    static cleanOldCache(days?: number): Promise<number>;
    /**
     * Translate invoice content
     */
    static translateInvoiceContent(invoiceData: any, targetLanguage?: string): Promise<any>;
    /**
     * Translate WhatsApp bot responses
     */
    static translateBotResponse(response: string, customerLanguage?: string): Promise<string>;
}
//# sourceMappingURL=translationService.d.ts.map