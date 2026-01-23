
interface SessionData {
    step?: string;
    data?: any;
    lastInteraction?: number;
}

const sessions: Record<string, SessionData> = {};

export class WhatsAppSessionService {
    static async getSession(phone: string): Promise<SessionData | null> {
        return sessions[phone] || null;
    }

    static async setSession(phone: string, data: SessionData) {
        sessions[phone] = {
            ...data,
            lastInteraction: Date.now()
        };
    }

    static async clearSession(phone: string) {
        delete sessions[phone];
    }

    static async updateSession(phone: string, updates: Partial<SessionData>) {
        if (!sessions[phone]) {
            sessions[phone] = { step: '', data: {}, lastInteraction: Date.now() };
        }
        sessions[phone] = { ...sessions[phone], ...updates, lastInteraction: Date.now() };
    }
}
