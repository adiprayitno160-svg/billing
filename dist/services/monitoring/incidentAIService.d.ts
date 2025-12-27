/**
 * Incident AI Service - AI-Powered Anomaly Detection & Root Cause Analysis
 * - Real-time anomaly detection
 * - Incident classification & root cause analysis
 * - Auto-recommendations for mitigation
 * - Pattern detection & prediction
 */
interface IncidentAnalysis {
    incident_id: number;
    analysis_type: 'mass_outage' | 'infrastructure' | 'customer_issue' | 'degraded_network';
    confidence: number;
    severity: 'critical' | 'major' | 'minor' | 'info';
    predicted_duration?: number;
    root_cause_hypotheses: RootCauseHypothesis[];
    recommended_actions: string[];
    affected_customers_count: number;
    affected_area?: string;
    anomaly_score: number;
}
interface RootCauseHypothesis {
    hypothesis: string;
    confidence: number;
    evidence: string[];
    impact_score: number;
}
interface AnomalyDetection {
    timestamp: Date;
    metric: 'downtime_count' | 'avg_latency' | 'packet_loss' | 'bandwidth_usage';
    current_value: number;
    normal_range: {
        min: number;
        max: number;
    };
    anomaly_score: number;
    severity: 'critical' | 'major' | 'minor';
}
export declare class IncidentAIService {
    /**
     * Analyze incident and detect root cause
     */
    static analyzeIncident(incidentId: number): Promise<IncidentAnalysis | null>;
    /**
     * Classify incident type using pattern analysis
     */
    private static classifyIncident;
    /**
     * Detect root causes based on context
     */
    private static detectRootCauses;
    /**
     * Generate recommended actions
     */
    private static generateRecommendations;
    /**
     * Auto-escalate critical incidents
     */
    private static autoEscalate;
    /**
     * Detect real-time anomalies
     */
    static detectRealTimeAnomalies(): Promise<AnomalyDetection[]>;
    /**
     * Analyze downtime spike
     */
    private static analyzeDowntimeSpike;
    /**
     * Analyze latency degradation
     */
    private static analyzeLatencyDegradation;
    /**
     * Analyze packet loss spike
     */
    private static analyzePacketLossSpike;
    /**
     * Save incident analysis
     */
    private static saveIncidentAnalysis;
}
export default IncidentAIService;
//# sourceMappingURL=incidentAIService.d.ts.map