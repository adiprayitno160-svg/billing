/**
 * Alert Routing Service - Dual Channel Alert System
 * Routes alerts to appropriate channel:
 * - Telegram: Internal staff (admin, teknisi, kasir)
 * - WhatsApp: Customers
 */
interface Alert {
    alert_type: 'critical' | 'warning' | 'info';
    recipient_type: 'internal' | 'customer';
    recipient_id: number;
    title: string;
    body: string;
    metadata?: any;
}
export declare class AlertRoutingService {
    /**
     * Route alert to appropriate channel
     */
    routeAlert(alert: Alert): Promise<boolean>;
    /**
     * Send alert via Telegram (Internal)
     */
    private sendToTelegram;
    /**
     * Log alert to database
     */
    private logAlert;
    /**
     * Send downtime alert (to internal staff via Telegram)
     */
    sendDowntimeAlert(incident: {
        incident_id: number;
        customer_id: number;
        customer_name: string;
        area: string;
        duration_minutes: number;
        service_type: string;
        odc_location?: string;
    }): Promise<void>;
    /**
     * Send service restored notification (to customer via WhatsApp)
     */
    sendServiceRestoredNotification(customer: {
        customer_id: number;
        customer_name: string;
        downtime_duration: number;
    }): Promise<void>;
    /**
     * Send SLA breach notification (to customer via WhatsApp)
     */
    sendSLABreachNotification(sla: {
        customer_id: number;
        customer_name: string;
        month_year: string;
        sla_percentage: number;
        sla_target: number;
        discount_amount: number;
    }): Promise<void>;
    /**
     * Send planned maintenance notification (to customers via WhatsApp)
     */
    sendMaintenanceNotification(maintenance: {
        title: string;
        description: string;
        start_time: Date;
        end_time: Date;
        affected_customers: number[];
    }): Promise<void>;
    /**
     * Send SLA warning to admin (approaching breach)
     */
    sendSLAWarningToAdmin(warning: {
        customer_name: string;
        current_sla: number;
        target_sla: number;
        estimated_discount: number;
        customer_id: number;
    }): Promise<void>;
    /**
     * Send daily summary report to admin
     */
    sendDailySummaryReport(): Promise<void>;
    /**
     * Get alert statistics
     */
    getAlertStats(days?: number): Promise<any>;
}
declare const _default: AlertRoutingService;
export default _default;
//# sourceMappingURL=alertRoutingService.d.ts.map