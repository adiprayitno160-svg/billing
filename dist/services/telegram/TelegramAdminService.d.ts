/**
 * Telegram Admin Service
 * Enhanced Telegram Bot for Admin & Teknisi
 * Features: Real-time monitoring, incident management, notifications
 */
interface NotificationPayload {
    type: 'downtime' | 'sla_breach' | 'payment' | 'invoice' | 'system' | 'custom';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    targetRole?: 'admin' | 'teknisi' | 'kasir' | 'all';
    targetArea?: string;
    customerId?: number;
    metadata?: any;
}
export declare class TelegramAdminService {
    private bot;
    private botToken;
    private isInitialized;
    private messageQueue;
    constructor();
    /**
     * Initialize Telegram bot with polling
     */
    private initializeBot;
    /**
     * Setup all bot commands
     */
    private setupCommands;
    /**
     * Setup callback query handlers (button clicks)
     */
    private setupCallbackHandlers;
    /**
     * Setup error handling
     */
    private setupErrorHandling;
    /**
     * Handle /start command
     */
    private handleStart;
    /**
     * Handle /register command
     */
    private handleRegister;
    /**
     * Handle /help command
     */
    private handleHelp;
    /**
     * Handle /status command
     */
    private handleStatus;
    /**
     * Handle /incidents command
     */
    private handleIncidents;
    /**
     * Handle /mytickets command
     */
    private handleMyTickets;
    /**
     * Handle /customers command
     */
    private handleCustomerSearch;
    /**
     * Handle /offline command
     */
    private handleOfflineCustomers;
    /**
     * Handle /stats command
     */
    private handleStats;
    /**
     * Handle /invoice command
     */
    private handleInvoice;
    /**
     * Handle /payment command
     */
    private handlePayment;
    /**
     * Handle /areas command
     */
    private handleAreas;
    /**
     * Handle /performance command
     */
    private handlePerformance;
    /**
     * Handle /settings command
     */
    private handleSettings;
    /**
     * Handle assign incident callback
     */
    private handleAssignIncident;
    /**
     * Handle acknowledge incident callback
     */
    private handleAcknowledgeIncident;
    /**
     * Handle complete incident callback
     */
    private handleCompleteIncident;
    /**
     * Handle toggle notifications callback
     */
    private handleToggleNotifications;
    /**
     * Handle quick reply callback
     */
    private handleQuickReply;
    /**
     * Send notification to specific users
     */
    sendNotification(payload: NotificationPayload): Promise<{
        sent: number;
        failed: number;
    }>;
    /**
     * Send downtime alert to teknisi
     */
    sendDowntimeAlert(incident: {
        incident_id: number;
        customer_id: number;
        customer_name: string;
        area: string;
        duration_minutes: number;
        phone: string;
    }): Promise<void>;
    /**
     * Create invite code for new user
     */
    createInviteCode(role: 'admin' | 'teknisi' | 'kasir' | 'superadmin', areaCoverage: string[], expiryDays?: number): Promise<string>;
    /**
     * Get bot statistics
     */
    getBotStatistics(dateFrom?: Date, dateTo?: Date): Promise<any>;
    /**
     * Get user by chat ID
     */
    private getUser;
    /**
     * Send message helper
     */
    private sendMessage;
    /**
     * Log chat message
     */
    private logChatMessage;
    /**
     * Log system message
     */
    private logSystemMessage;
    /**
     * Get priority emoji
     */
    private getPriorityEmoji;
    /**
     * Get bot info
     */
    getBotInfo(): {
        isInitialized: boolean;
        botToken: string;
    };
    /**
     * Stop bot polling
     */
    stopBot(): void;
    /**
     * Reinitialize bot with new token
     */
    reinitializeBot(newToken: string): void;
}
declare const _default: TelegramAdminService;
export default _default;
//# sourceMappingURL=TelegramAdminService.d.ts.map