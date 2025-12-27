export interface WhatsAppMessageOptions {
    customerId?: number;
    template?: string;
    priority?: 'low' | 'normal' | 'high';
}
export declare class WhatsAppService {
    private static client;
    private static isInitialized;
    private static isInitializing;
    private static isReady;
    private static reconnectAttempts;
    private static maxReconnectAttempts;
    private static sessionPath;
    private static currentQRCode;
    private static isAuthenticated;
    private static channelColumnExists;
    /**
     * Initialize WhatsApp client
     */
    static initialize(): Promise<void>;
    /**
     * Check if WhatsApp client is ready
     */
    static isClientReady(): boolean;
    /**
     * Get client status
     */
    static getStatus(): {
        ready: boolean;
        initialized: boolean;
        initializing: boolean;
        authenticated: boolean;
        hasQRCode: boolean;
    };
    /**
     * Get current QR code
     */
    static getQRCode(): string | null;
    /**
     * Regenerate QR code by destroying and reinitializing client
     */
    static regenerateQRCode(): Promise<void>;
    /**
     * Format phone number to WhatsApp format
     */
    private static formatPhoneNumber;
    /**
     * Send WhatsApp message
     */
    static sendMessage(phone: string, message: string, options?: WhatsAppMessageOptions): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * Send WhatsApp message with media
     */
    static sendMessageWithMedia(phone: string, message: string, mediaPath: string, options?: WhatsAppMessageOptions): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * Send bulk messages
     */
    static sendBulkMessages(recipients: Array<{
        phone: string;
        message: string;
        customerId?: number;
    }>, delayMs?: number): Promise<{
        success: number;
        failed: number;
        results: Array<{
            phone: string;
            success: boolean;
            error?: string;
        }>;
    }>;
    /**
     * Log notification to database
     */
    private static logNotification;
    /**
     * Get notification history
     */
    static getNotificationHistory(limit?: number, customerId?: number, status?: string): Promise<any[]>;
    /**
     * Get notification statistics
     */
    static getNotificationStats(): Promise<{
        total: number;
        sent: number;
        failed: number;
        pending: number;
        successRate: number;
    }>;
    /**
     * Destroy WhatsApp client
     */
    static destroy(): Promise<void>;
}
//# sourceMappingURL=WhatsAppService.d.ts.map