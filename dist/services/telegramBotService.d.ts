/**
 * Telegram Bot Service - Internal Alert System
 * Handles Telegram bot for staff notifications and commands
 */
interface AlertMessage {
    alert_type: 'critical' | 'warning' | 'info';
    title: string;
    body: string;
    metadata?: any;
}
export declare class TelegramBotService {
    private bot;
    private readonly botToken;
    private isInitialized;
    constructor();
    /**
     * Initialize Telegram bot
     */
    private initializeBot;
    /**
     * Setup bot commands
     */
    private setupCommands;
    /**
     * Handle assign incident
     */
    private handleAssignIncident;
    /**
     * Handle resolve incident
     */
    private handleResolveIncident;
    /**
     * Send alert to specific user
     */
    sendAlert(chatId: string, alert: AlertMessage): Promise<boolean>;
    /**
     * Send alert with interactive buttons
     */
    sendInteractiveAlert(chatId: string, alert: AlertMessage, buttons: {
        text: string;
        callback_data: string;
    }[]): Promise<boolean>;
    /**
     * Send alert to multiple users by role
     */
    sendAlertByRole(role: 'admin' | 'teknisi' | 'kasir', alert: AlertMessage, area?: string): Promise<number>;
    /**
     * Send critical downtime alert
     */
    sendDowntimeAlert(incident: {
        customer_id: number;
        customer_name: string;
        area: string;
        duration_minutes: number;
        service_type: string;
        incident_id: number;
    }): Promise<void>;
    /**
     * Send SLA breach warning
     */
    sendSLAWarning(slaData: {
        customer_name: string;
        current_sla: number;
        target_sla: number;
        estimated_discount: number;
    }): Promise<void>;
    /**
     * Create invite code for new user
     */
    createInviteCode(role: 'admin' | 'teknisi' | 'kasir', areaCoverage: string[], createdBy: number): Promise<string>;
    /**
     * Get bot info
     */
    getBotInfo(): {
        isInitialized: boolean;
        botToken: string;
    };
}
declare const _default: TelegramBotService;
export default _default;
//# sourceMappingURL=telegramBotService.d.ts.map