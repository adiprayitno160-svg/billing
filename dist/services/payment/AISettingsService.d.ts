/**
 * AI Settings Service
 * Manages AI (Gemini) configuration from database
 */
export interface AISettings {
    api_key: string;
    model: string;
    enabled: boolean;
    auto_approve_enabled: boolean;
    min_confidence: number;
    risk_threshold: 'low' | 'medium' | 'high';
    max_age_days: number;
}
export declare class AISettingsService {
    /**
     * Ensure AI settings table exists
     */
    static ensureAISettingsTable(): Promise<void>;
    /**
     * Get AI settings from database
     */
    static getSettings(): Promise<AISettings | null>;
    /**
     * Update AI settings
     */
    static updateSettings(settings: Partial<AISettings>): Promise<boolean>;
    /**
     * Get API key (from database or env fallback)
     */
    static getAPIKey(): Promise<string | null>;
    /**
     * Check if AI is enabled
     */
    static isEnabled(): Promise<boolean>;
    /**
     * Test API key
     */
    static testAPIKey(apiKey: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=AISettingsService.d.ts.map