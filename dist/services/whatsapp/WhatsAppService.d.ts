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
    static initialize(): Promise<void>;
    private static getConnectionState;
    static getStatus(): {
        ready: boolean;
        initialized: boolean;
        initializing: boolean;
        authenticated: boolean;
        hasQRCode: boolean;
    };
    static getQRCode(): string | null;
    static isClientReady(): boolean;
    static getNotificationHistory(limit?: number, customerId?: number, status?: string): Promise<any[]>;
    static regenerateQRCode(): Promise<void>;
    static destroy(): Promise<void>;
    private static formatPhoneNumber;
    static sendMessage(phone: string, message: string, options?: WhatsAppMessageOptions): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
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
    static getNotificationStats(): Promise<{
        total: number;
        sent: number;
        failed: number;
        pending: number;
        successRate: number;
    }>;
}
//# sourceMappingURL=WhatsAppService.d.ts.map