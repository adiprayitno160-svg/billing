"use strict";
/**
 * Telegram Bot Service - Internal Alert System
 * DISABLED PER USER REQUEST
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBotService = void 0;
class TelegramBotService {
    async sendAlert(chatId, alert) {
        return false;
    }
    async sendInteractiveAlert(chatId, alert, buttons) {
        return false;
    }
    async sendAlertByRole(role, alert, area) {
        return 0;
    }
    async sendDowntimeAlert(incident) {
    }
    async sendSLAWarning(slaData) {
    }
    async createInviteCode(role, areaCoverage, createdBy) {
        return 'DISABLED';
    }
    getBotInfo() {
        return { isInitialized: false, botToken: 'DISABLED' };
    }
}
exports.TelegramBotService = TelegramBotService;
exports.default = new TelegramBotService();
//# sourceMappingURL=telegramBotService.js.map