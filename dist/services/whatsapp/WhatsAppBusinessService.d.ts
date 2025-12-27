interface WhatsAppStatus {
    connected: boolean;
    ready: boolean;
    authenticated: boolean;
    phoneNumber?: string;
    qrCode?: string;
}
interface SendMessageResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
declare class WhatsAppBusinessService {
    private client;
    private qrCode;
    private status;
    private sessionPath;
    constructor();
    /**
     * Initialize WhatsApp client
     */
    initialize(): Promise<void>;
    /**
     * Start WhatsApp client
     */
    start(): Promise<void>;
    /**
     * Stop WhatsApp client
     */
    stop(): Promise<void>;
    /**
     * Restart WhatsApp client
     */
    restart(): Promise<void>;
    /**
     * Get current status
     */
    getStatus(): WhatsAppStatus;
    /**
     * Get QR Code
     */
    getQRCode(): string | null;
    /**
     * Format phone number (Indonesia)
     */
    private formatPhoneNumber;
    /**
     * Send message to phone number
     */
    sendMessage(phone: string, message: string): Promise<SendMessageResult>;
    /**
     * Send message to customer by ID
     */
    sendToCustomer(customerId: number, message: string): Promise<SendMessageResult>;
    /**
     * Send message to multiple customers
     */
    sendToMultiple(customerIds: number[], message: string): Promise<{
        success: number;
        failed: number;
        results: any[];
    }>;
    /**
     * Check if phone number is registered on WhatsApp
     */
    checkNumber(phone: string): Promise<{
        isWhatsApp: boolean;
        number?: string;
    }>;
    /**
     * Log notification to database
     */
    private logNotification;
    /**
     * Ensure notification table exists
     */
    private ensureNotificationTable;
    /**
     * Get notification history
     */
    getHistory(limit?: number, offset?: number): Promise<any[]>;
}
export declare function getWhatsAppBusinessService(): WhatsAppBusinessService;
export default WhatsAppBusinessService;
//# sourceMappingURL=WhatsAppBusinessService.d.ts.map