/**
 * WhatsApp Bot Service
 * Handles bot commands for package purchase and payment verification
 */
import { Message } from 'whatsapp-web.js';
export declare class WhatsAppBotService {
    private static readonly COMMAND_PREFIX;
    /**
     * Validate if sender is a registered customer
     * Returns customer object if valid, null otherwise (and sends rejection message)
     */
    private static validateCustomer;
    /**
     * Initialize bot message handler
     */
    static initialize(): Promise<void>;
    /**
     * Handle incoming WhatsApp message
     */
    static handleMessage(message: Message): Promise<void>;
    /**
     * Handle media message (bukti transfer)
     * AI akan analisa dan auto-approve jika valid
     */
    private static handleMediaMessage;
    /**
     * Handle command
     */
    private static handleCommand;
    /**
     * Handle menu command
     */
    private static handleMenuCommand;
    /**
     * Check if command is menu navigation
     */
    private static isMenuCommand;
    /**
     * Show main menu
     */
    private static showMainMenu;
    /**
     * Show invoices (for postpaid customers)
     */
    private static showInvoices;
    private static showHelp;
    /**
     * Show WiFi menu
     */
    private static showWiFiMenu;
    /**
     * Reboot ONT
     */
    private static rebootOnt;
    /**
     * Handle Report Command (SLA Start)
     */
    private static handleReportCommand;
    /**
     * Handle Resolve Command (SLA Stop)
     */
    private static handleResolveCommand;
    /**
     * Change WiFi SSID only
     */
    private static changeWiFiSSID;
    /**
     * Change WiFi Password only
     */
    private static changeWiFiPassword;
    /**
     * Change both WiFi SSID and Password
     */
    private static changeWiFiBoth;
    /**
     * Get customer by phone number (helper)
     */
    private static getCustomerByPhone;
    /**
     * Send message helper
     */
    private static sendMessage;
}
//# sourceMappingURL=WhatsAppBotService.d.ts.map