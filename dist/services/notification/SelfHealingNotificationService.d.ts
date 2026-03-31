export declare class SelfHealingNotificationService {
    private aiService;
    private whatsappService;
    private notificationTemplateService;
    private anomalyThresholdMinutes;
    private massOutageThreshold;
    constructor();
    /**
     * Check for anomalies in PPPoE connections
     */
    checkPPPoEAnomalies(): Promise<void>;
    /**
     * Check for anomalies in Static IP connections
     */
    checkStaticIPAnomalies(): Promise<void>;
    /**
     * Check if a customer has an anomaly (connection down for more than threshold)
     */
    private checkAnomalyForCustomer;
    /**
     * Count how many customers are affected in the same area
     */
    private countAffectedCustomersInArea;
    /**
     * Determine severity based on number of affected customers
     */
    private determineSeverity;
    /**
     * Handle detected anomaly
     */
    private handleAnomaly;
    /**
     * Process anomaly with AI to generate personalized message
     */
    private processWithAI;
    /**
     * Send notifications through various channels
     */
    private sendNotifications;
    /**
     * Log anomaly event to database
     */
    private logAnomalyEvent;
    /**
     * Main method to run anomaly detection for both PPPoE and Static IP
     */
    runAnomalyDetection(): Promise<void>;
}
//# sourceMappingURL=SelfHealingNotificationService.d.ts.map