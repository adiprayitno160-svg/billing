import { proto } from '@whiskeysockets/baileys';
import { WhatsAppService } from './WhatsAppService';
export declare class WhatsAppHandler {
    static writeLog(message: string): Promise<void>;
    /**
     * Sophisticated identity resolution logic
     * Handles LID, remoteJidAlt, International formats, and standard JIDs
     */
    private static resolveSenderIdentity;
    static handleIncomingMessage(msg: proto.IWebMessageInfo, service: WhatsAppService): Promise<void>;
    private static getCustomerByPhone;
    /**
     * Attempt auto-link by finding customers with similar phone number patterns
     * This helps when LID looks similar to actual phone numbers
     */
    private static sendMenu;
    private static handleCheckBill;
    private static handleRegistration;
    /**
     * Attempt to automatically link by searching matching phone pattern
     */
    private static attemptAutoLinkByPattern;
    /**
     * Handle auto-connection request from customers
     * This provides guided assistance for linking accounts
     */
    private static handleAutoConnectionRequest;
    /**
     * Process payment image for OCR verification
     */
    private static processPaymentImage;
    /**
     * Handle location message
     */
    private static handleLocationMessage;
}
//# sourceMappingURL=WhatsAppHandler.d.ts.map