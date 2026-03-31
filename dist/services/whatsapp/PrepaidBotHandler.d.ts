/**
 * Prepaid Bot Handler
 * Handles WhatsApp Bot interactions for prepaid customers
 */
export declare class PrepaidBotHandler {
    /**
     * Handle /beli command for prepaid customers
     */
    static handleBuyCommand(customerPhone: string, customer: any): Promise<string>;
    /**
     * Handle package selection (1, 2, or 3)
     */
    static handlePackageSelection(customerPhone: string, customer: any, selection: string): Promise<string>;
    /**
     * Check if customer in prepaid mode
     */
    static isCustomerPrepaid(customerId: number): Promise<boolean>;
    /**
     * Send payment confirmation with invoice
     */
    static sendPaymentConfirmation(customerPhone: string, customer: any, transaction: any): Promise<void>;
}
//# sourceMappingURL=PrepaidBotHandler.d.ts.map