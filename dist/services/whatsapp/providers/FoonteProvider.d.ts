export declare class FoonteProvider {
    private static instance;
    private token;
    private constructor();
    static getInstance(): FoonteProvider;
    isConfigured(): boolean;
    /**
     * Send message via Foonte API
     */
    sendMessage(to: string, message: string): Promise<boolean>;
}
//# sourceMappingURL=FoonteProvider.d.ts.map