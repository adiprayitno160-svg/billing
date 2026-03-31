/**
 * Customer Notification Service
 * Advanced notification system for customer monitoring events
 * - Timeout/error notifications
 * - Recovery alerts
 * - Escalation policies
 */
interface CustomerInfo {
    id: number;
    name: string;
    customer_code: string;
    phone: string;
    connection_type: string;
    pppoe_username?: string;
    ip_address?: string;
    odc_id?: number;
    odp_id?: number;
    address?: string;
    odp_name?: string;
}
export declare class CustomerNotificationService {
    private static instance;
    private waClient;
    private adminBroadcastCooldowns;
    private constructor();
    static getInstance(): CustomerNotificationService;
    /**
     * Send notification for customer trouble event
     */
    sendTroubleNotification(customer: CustomerInfo, eventType: 'offline' | 'timeout' | 'error' | 'recovered' | 'degraded', details?: any): Promise<boolean>;
    /**
     * Send AI-Generated Automated Troubleshooting Notification
     */
    sendAIAutomatedTroubleshooting(customer: CustomerInfo, eventType: string): Promise<boolean>;
    /**
     * Check if notification should be sent (respect preferences and cooldown)
     */
    private shouldSendNotification;
    /**
     * Log notification event to database
     */
    private logNotificationEvent;
    /**
     * Get recent notification history for customer
     */
    getNotificationHistory(customerId: number, limit?: number): Promise<any[]>;
    /**
     * Bulk send notifications for multiple customers
     */
    sendBulkNotifications(customers: CustomerInfo[], eventType: 'offline' | 'timeout' | 'error' | 'recovered' | 'degraded', details?: any): Promise<{
        success: number;
        failed: number;
    }>;
    /**
     * Send escalation notification to technicians/admins
     */
    sendEscalationNotification(eventType: string, affectedCustomers: number, details?: any): Promise<void>;
    /**
     * Broadcast customer status change to Admins & Operators
     */
    broadcastCustomerStatusToAdmins(customer: CustomerInfo, status: 'offline' | 'online'): Promise<void>;
    /**
     * Broadcast Infrastructure (ODP/ODC) Mass Outage to Admins & Operators
     * Used when multiple customers in the same ODP go offline simultaneously
     */
    broadcastInfrastructureIssue(locationName: string, type: 'ODP' | 'ODC', status: 'offline' | 'online', affectedCount: number): Promise<void>;
}
declare const _default: CustomerNotificationService;
export default _default;
//# sourceMappingURL=CustomerNotificationService.d.ts.map