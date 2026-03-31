interface SessionData {
    phone?: string;
    step?: string;
    data?: any;
    lastInteraction?: number;
}
export declare class WhatsAppSessionService {
    /**
     * Get session from database
     */
    static getSession(phone: string): Promise<SessionData | null>;
    /**
     * Set/Update session in database
     */
    static setSession(phone: string, data: SessionData): Promise<void>;
    /**
     * Update partial session data
     */
    static updateSession(phone: string, updates: Partial<SessionData>): Promise<void>;
    /**
     * Clear session from database
     */
    static clearSession(phone: string): Promise<void>;
}
export {};
//# sourceMappingURL=WhatsAppSessionService.d.ts.map