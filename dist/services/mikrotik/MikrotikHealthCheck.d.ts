/**
 * Mikrotik Health Check Service
 * Auto-detect connection issues and provide fallback
 */
interface HealthStatus {
    isOnline: boolean;
    responseTime: number;
    lastCheck: Date;
    error?: string;
}
export declare class MikrotikHealthCheck {
    private static healthStatus;
    private static lastCheckTime;
    private static CHECK_INTERVAL;
    /**
     * Quick health check with timeout
     */
    static checkHealth(): Promise<HealthStatus>;
    /**
     * Get current status (cached)
     */
    static getCurrentStatus(): HealthStatus | null;
    /**
     * Force recheck
     */
    static forceRecheck(): Promise<HealthStatus>;
}
export default MikrotikHealthCheck;
//# sourceMappingURL=MikrotikHealthCheck.d.ts.map