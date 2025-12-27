/**
 * SLA Monitoring Service - Service Level Agreement Monitoring
 * - Detect downtime incidents
 * - Calculate SLA percentage
 * - Apply discount rules
 * - Exclude maintenance/force majeure
 */
interface SLAIncident {
    id: number;
    customer_id: number;
    service_type: 'pppoe' | 'static_ip';
    incident_type: 'downtime' | 'degraded' | 'maintenance';
    start_time: Date;
    end_time?: Date;
    duration_minutes: number;
    status: 'ongoing' | 'resolved' | 'excluded';
    exclude_reason?: string;
    is_counted_in_sla: boolean;
}
interface SLARecord {
    id: number;
    customer_id: number;
    month_year: Date;
    total_minutes: number;
    downtime_minutes: number;
    excluded_downtime_minutes: number;
    counted_downtime_minutes: number;
    sla_percentage: number;
    sla_target: number;
    sla_status: 'met' | 'breach' | 'warning';
    incident_count: number;
    discount_amount: number;
    discount_approved: boolean;
}
export declare class SLAMonitoringService {
    private readonly DOWNTIME_THRESHOLD_MINUTES;
    private readonly TRANSIENT_THRESHOLD_MINUTES;
    /**
     * Detect and create new downtime incidents from connection logs
     * Called every 5 minutes by scheduler
     */
    detectDowntimeIncidents(): Promise<void>;
    /**
     * Create new SLA incident
     */
    createIncident(incident: {
        customer_id: number;
        service_type: 'pppoe' | 'static_ip';
        incident_type: 'downtime' | 'degraded' | 'maintenance';
        start_time: Date;
        status: 'ongoing' | 'resolved' | 'excluded';
        exclude_reason?: string;
        exclude_notes?: string;
    }): Promise<number>;
    /**
     * Resolve ongoing incidents when customer comes back online
     */
    resolveIncidents(): Promise<void>;
    /**
     * Auto-exclude transient disconnects (<30 minutes)
     */
    excludeTransientIncidents(): Promise<void>;
    /**
     * Exclude incidents during planned maintenance
     */
    excludeMaintenanceIncidents(): Promise<void>;
    /**
     * Exclude incidents for isolated customers
     */
    excludeIsolatedCustomerIncidents(): Promise<void>;
    /**
     * Calculate monthly SLA for all customers
     * Called daily by scheduler
     */
    calculateMonthlySLA(monthYear?: Date): Promise<void>;
    /**
     * Calculate SLA for single customer
     */
    calculateCustomerMonthlySLA(customerId: number, monthYear: Date, totalMinutes: number, slaTarget: number): Promise<void>;
    /**
     * Calculate discount amount based on SLA breach
     */
    calculateDiscount(customerId: number, actualSLA: number, targetSLA: number): Promise<number>;
    /**
     * Get SLA summary for customer
     */
    getCustomerSLASummary(customerId: number, monthYear?: Date): Promise<SLARecord | null>;
    /**
     * Get active incidents for customer
     */
    getCustomerActiveIncidents(customerId: number): Promise<SLAIncident[]>;
    /**
     * Approve SLA discount (Admin action)
     */
    approveDiscount(slaRecordId: number, approvedBy: number): Promise<void>;
    /**
     * Main monitoring loop - called every 5 minutes
     */
    runMonitoring(): Promise<void>;
}
declare const _default: SLAMonitoringService;
export default _default;
//# sourceMappingURL=slaMonitoringService.d.ts.map