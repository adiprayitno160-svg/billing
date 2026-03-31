/**
 * Trouble Notification Service
 * Sends notifications to admin/operator when customer has issues/errors
 */
export interface TroubleReport {
    customer_id: number;
    customer_name: string;
    customer_phone?: string;
    trouble_type: 'connection_down' | 'payment_issue' | 'equipment_failure' | 'complaint' | 'other';
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    reported_by?: string;
    additional_info?: string;
}
export interface AdminOperator {
    id: number;
    username: string;
    full_name: string;
    phone: string;
    role: 'superadmin' | 'operator' | 'admin';
}
export declare class TroubleNotificationService {
    /**
     * Get all admin and operator users with phone numbers
     */
    static getAdminOperators(): Promise<AdminOperator[]>;
    /**
     * Format phone number for WhatsApp
     */
    private static formatPhoneNumber;
    /**
     * Build trouble notification message
     */
    private static buildTroubleMessage;
    /**
     * Send trouble notification to all admin/operators
     */
    static notifyTrouble(report: TroubleReport): Promise<{
        success: boolean;
        sent_to: string[];
        failed: string[];
        message: string;
    }>;
    /**
     * Log trouble notification to database
     */
    private static logTroubleNotification;
    /**
     * Quick method to report connection down
     */
    static reportConnectionDown(customerId: number, customerName: string, customerPhone?: string, details?: string): Promise<any>;
    /**
     * Quick method to report equipment failure
     */
    static reportEquipmentFailure(customerId: number, customerName: string, customerPhone?: string, equipmentInfo?: string): Promise<any>;
    /**
     * Quick method to report customer complaint
     */
    static reportComplaint(customerId: number, customerName: string, complaintDetails: string, customerPhone?: string, priority?: 'low' | 'medium' | 'high' | 'critical'): Promise<any>;
}
//# sourceMappingURL=TroubleNotificationService.d.ts.map