/**
 * Two Hour Notification Service
 * Handles notifications for customers that have been offline for 2+ hours
 * - Sends notification with ticket number every 2 hours if still down
 * - Sends recovery notification when customer comes back online
 */
export interface OfflineCustomer {
    id: number;
    name: string;
    customer_code: string;
    phone: string;
    pppoe_username?: string;
    connection_type: string;
    last_seen_online: Date;
    offline_since: Date;
    current_ticket_id?: number;
    current_ticket_number?: string;
}
export declare class TwoHourNotificationService {
    private static instance;
    private waClient;
    private constructor();
    static getInstance(): TwoHourNotificationService;
    /**
     * Process customers that have been offline for 2+ hours
     * Send notifications every 2 hours with ticket information
     */
    processLongTermOfflineCustomers(): Promise<void>;
    /**
     * Find customers that have been offline for 2+ hours
     */
    private getLongTermOfflineCustomers;
    /**
     * Handle notification for a specific offline customer
     */
    private handleOfflineCustomerNotification;
    /**
     * Send offline notification to customer with ticket information
     */
    private sendOfflineNotification;
    /**
     * Send recovery notification when customer comes back online
     */
    sendRecoveryNotification(customer: OfflineCustomer, ticketNumber: string): Promise<boolean>;
    /**
     * Get or create a ticket for the customer's issue
     */
    private getOrCreateTicketForCustomer;
    /**
     * Check if notification should be sent (respecting cooldown)
     */
    private shouldSendNotification;
    /**
     * Log notification event to database
     */
    private logNotificationEvent;
    /**
     * Check for customers that have come back online and send recovery notifications
     */
    processRecoveredCustomers(): Promise<void>;
    /**
     * Find customers that were offline for 2+ hours but are now online
     */
    private getRecentlyRecoveredCustomers;
}
//# sourceMappingURL=TwoHourNotificationService.d.ts.map