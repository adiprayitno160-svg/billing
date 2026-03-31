/**
 * WhatsApp Registration Service
 * Handles new customer registration via WhatsApp Bot
 * Creates customer account and generates PPPoE credentials
 */
export interface RegistrationSession {
    phone: string;
    step: 'name' | 'address' | 'confirm' | 'complete';
    data: {
        name?: string;
        address?: string;
    };
    createdAt: Date;
    expiresAt: Date;
}
export declare class WhatsAppRegistrationService {
    private static SESSION_TIMEOUT_MS;
    private static DEFAULT_PPPOE_PASSWORD;
    private static DEFAULT_PPPOE_PROFILE;
    /**
     * Check if phone has an active registration session
     */
    static hasActiveSession(phone: string): boolean;
    /**
     * Get current registration session
     */
    static getSession(phone: string): RegistrationSession | null;
    /**
     * Start new registration session
     */
    static startRegistration(phone: string): RegistrationSession;
    /**
     * Process registration step based on current session state
     */
    static processStep(phone: string, input: string): Promise<string>;
    /**
     * Process name input
     */
    private static processNameStep;
    /**
     * Process address input
     */
    private static processAddressStep;
    /**
     * Process confirmation
     */
    private static processConfirmStep;
    /**
     * Create customer account in database and MikroTik
     */
    private static createCustomerAccount;
    /**
     * Generate unique customer code
     */
    private static generateCustomerCode;
    /**
     * Get welcome message for new registration
     */
    private static getWelcomeMessage;
    /**
     * Cancel registration session
     */
    static cancelRegistration(phone: string): void;
    /**
     * Clean up expired sessions (call periodically)
     */
    static cleanupExpiredSessions(): void;
}
//# sourceMappingURL=WhatsAppRegistrationService.d.ts.map