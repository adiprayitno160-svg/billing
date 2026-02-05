"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppSessionService = void 0;
const sessions = {};
class WhatsAppSessionService {
    static async getSession(phone) {
        return sessions[phone] || null;
    }
    static async setSession(phone, data) {
        sessions[phone] = Object.assign(Object.assign({}, data), { lastInteraction: Date.now() });
    }
    static async clearSession(phone) {
        delete sessions[phone];
    }
    static async updateSession(phone, updates) {
        if (!sessions[phone]) {
            sessions[phone] = { step: '', data: {}, lastInteraction: Date.now() };
        }
        sessions[phone] = Object.assign(Object.assign(Object.assign({}, sessions[phone]), updates), { lastInteraction: Date.now() });
    }
}
exports.WhatsAppSessionService = WhatsAppSessionService;
