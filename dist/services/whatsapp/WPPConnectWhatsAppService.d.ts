/**
 * Modern WhatsApp Service using WPPConnect
 * Stable, CommonJS compatible, and feature-rich
 */
export interface WhatsAppMessageOptions {
    customerId?: number;
    template?: string;
    priority?: 'low' | 'normal' | 'high';
}
export declare class WPPConnectWhatsAppService {
    private static client;
    private static isInitialized;
    private static isInitializing;
    private static isConnected;
    private static currentQRCode;
    private static sessionPath;
    private static reconnectAttempts;
    private static maxReconnectAttempts;
    private static channelColumnExists;
    /**
     * Initialize WPPConnect WhatsApp client
     */
    static initialize(): Promise<void>;
    private static handleReconnect;
    static isClientReady(): boolean;
    static getStatus(): {
        ready: boolean;
        initialized: boolean;
        initializing: boolean;
        authenticated: boolean;
        hasQRCode: boolean;
    };
    static getQRCode(): string | null;
    static regenerateQRCode(): Promise<void>;
    private static formatPhoneNumber;
    static sendMessage(phone: string, message: string, options?: WhatsAppMessageOptions): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * Send bulk messages with delay between each message
     */
    static sendBulkMessages(recipients: Array<{
        phone: string;
        message: string;
        customerId?: number;
        template?: string;
    }>, delayMs?: number): Promise<{
        total: number;
        sent: number;
        failed: number;
        results: Array<{
            phone: string;
            success: boolean;
            error?: string;
        }>;
    }>;
    private static logNotification;
    static getNotificationHistory(limit?: number, customerId?: number, status?: string): Promise<any[]>;
    static getNotificationStats(): Promise<{
        total: number;
        sent: number;
        failed: number;
        pending: number;
        successRate: number;
    }>;
    static destroy(): Promise<void>;
}
//# sourceMappingURL=WPPConnectWhatsAppService.d.ts.map