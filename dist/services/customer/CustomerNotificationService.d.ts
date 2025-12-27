/**
 * Customer Notification Service
 *
 * Handles notifications for new customers:
 * - Welcome message via WhatsApp
 * - Admin notification via Telegram
 * - Integration with existing notification systems
 */
export interface NewCustomerData {
    customerId: number;
    customerName: string;
    customerCode: string;
    phone?: string;
    email?: string;
    connectionType: 'pppoe' | 'static_ip';
    address?: string;
    packageName?: string;
    createdBy?: string;
}
export declare class CustomerNotificationService {
    /**
     * Ensure customer_created template exists and is active
     */
    private ensureTemplateExists;
    /**
     * Send welcome notification to new customer using UnifiedNotificationService with template
     */
    sendWelcomeNotification(customerData: NewCustomerData): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Send admin notification about new customer
     */
    sendAdminNotification(customerData: NewCustomerData): Promise<void>;
    /**
     * Log notification to database
     */
    private logNotification;
    /**
     * Send notification for both customer and admin
     */
    notifyNewCustomer(customerData: NewCustomerData): Promise<{
        customer: {
            success: boolean;
            message: string;
        };
        admin: {
            success: boolean;
            message: string;
        };
    }>;
}
declare const _default: CustomerNotificationService;
export default _default;
//# sourceMappingURL=CustomerNotificationService.d.ts.map