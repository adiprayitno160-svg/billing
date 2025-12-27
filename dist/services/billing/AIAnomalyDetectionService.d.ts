import { LogEntry } from './BillingLogService';
export interface AnomalyDetectionResult {
    isAnomaly: boolean;
    type: string;
    score: number;
    analysis: {
        pattern?: string;
        reason: string;
        suggestions?: string[];
        severity: 'low' | 'medium' | 'high' | 'critical';
    };
}
export declare class AIAnomalyDetectionService {
    private anomalyPatterns;
    /**
     * Initialize anomaly patterns
     */
    initialize(): Promise<void>;
    /**
     * Detect anomaly in log entry
     */
    detectAnomaly(entry: LogEntry, logId: number): Promise<AnomalyDetectionResult>;
    /**
     * Check against known anomaly patterns
     */
    private checkKnownPatterns;
    /**
     * Check for repetitive errors (same error occurring multiple times)
     */
    private checkRepetitiveErrors;
    /**
     * Check for unusual patterns
     */
    private checkUnusualPatterns;
    /**
     * Check for business logic anomalies
     */
    private checkBusinessAnomalies;
    /**
     * Check for performance anomalies
     */
    private checkPerformanceAnomalies;
    /**
     * Check for security anomalies
     */
    private checkSecurityAnomalies;
    /**
     * Load anomaly patterns from database
     */
    private loadAnomalyPatterns;
    /**
     * Initialize default anomaly patterns
     */
    private initializeDefaultPatterns;
    /**
     * Get anomaly statistics
     */
    getAnomalyStatistics(days?: number): Promise<any>;
}
//# sourceMappingURL=AIAnomalyDetectionService.d.ts.map