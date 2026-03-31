export interface DiagnosticResult {
    success: boolean;
    status: 'online' | 'offline' | 'issue' | 'isolated';
    details: string;
    actionTaken?: string;
    aiAdvice?: string;
}
export declare class AIDiagnosticsService {
    /**
     * Main entry point for AI Diagnostics
     */
    static diagnoseAndFix(customerId: number, complaint: string): Promise<DiagnosticResult>;
    private static getTechnicalData;
    private static performSelfHealing;
    private static queueMonitoring;
    private static generateAIAdvice;
    /**
     * Process escalations (Called by Scheduler)
     * Checks auto_complaints for expired timers
     */
    static processEscalations(): Promise<void>;
}
//# sourceMappingURL=AIDiagnosticsService.d.ts.map