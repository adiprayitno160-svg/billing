/**
 * Telegram Bot Service - Internal Alert System
 * DISABLED PER USER REQUEST
 */
interface AlertMessage {
    alert_type: 'critical' | 'warning' | 'info';
    title: string;
    body: string;
    metadata?: any;
}
export declare class TelegramBotService {
    sendAlert(chatId: string, alert: AlertMessage): Promise<boolean>;
    sendInteractiveAlert(chatId: string, alert: AlertMessage, buttons: any[]): Promise<boolean>;
    sendAlertByRole(role: string, alert: AlertMessage, area?: string): Promise<number>;
    sendDowntimeAlert(incident: any): Promise<void>;
    sendSLAWarning(slaData: any): Promise<void>;
    createInviteCode(role: string, areaCoverage: string[], createdBy: number): Promise<string>;
    getBotInfo(): {
        isInitialized: boolean;
        botToken: string;
    };
}
declare const _default: TelegramBotService;
export default _default;
//# sourceMappingURL=telegramBotService.d.ts.map