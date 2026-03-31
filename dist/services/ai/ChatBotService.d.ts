export declare class ChatBotService {
    private static genAI;
    private static model;
    private static failureCount;
    private static readonly FAILURE_THRESHOLD;
    private static readonly COOLDOWN_MS;
    private static disabledUntil;
    private static initialize;
    /**
     * Returns true if the AI service is currently disabled due to repeated failures.
     */
    private static isDisabled;
    /** Reset circuit‑breaker after a successful call */
    private static resetFailure;
    /**
     * Ask a question to the AI with context from the knowledge base (RAG)
     * Includes Retry Logic for Robustness
     */
    static ask(userQuery: string, customerData?: any): Promise<string>;
    /**
     * Analyze an image using Gemini Vision
     */
    static analyzeImage(imageBuffer: Buffer, mimeType: string, promptText: string): Promise<string>;
}
//# sourceMappingURL=ChatBotService.d.ts.map