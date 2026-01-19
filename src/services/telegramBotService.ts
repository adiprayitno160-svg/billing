/**
 * Telegram Bot Service - Internal Alert System
 * DISABLED PER USER REQUEST
 */

import pool from '../db/pool';

interface AlertMessage {
    alert_type: 'critical' | 'warning' | 'info';
    title: string;
    body: string;
    metadata?: any;
}

export class TelegramBotService {
    async sendAlert(chatId: string, alert: AlertMessage): Promise<boolean> {
        return false;
    }

    async sendInteractiveAlert(chatId: string, alert: AlertMessage, buttons: any[]): Promise<boolean> {
        return false;
    }

    async sendAlertByRole(role: string, alert: AlertMessage, area?: string): Promise<number> {
        return 0;
    }

    async sendDowntimeAlert(incident: any): Promise<void> {
    }

    async sendSLAWarning(slaData: any): Promise<void> {
    }

    async createInviteCode(role: string, areaCoverage: string[], createdBy: number): Promise<string> {
        return 'DISABLED';
    }

    getBotInfo() {
        return { isInitialized: false, botToken: 'DISABLED' };
    }
}

export default new TelegramBotService();
