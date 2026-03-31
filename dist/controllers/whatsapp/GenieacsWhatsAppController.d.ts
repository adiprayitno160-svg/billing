export declare class GenieacsWhatsAppController {
    /**
     * Helper to get customer by phone
     */
    private static getCustomer;
    /**
     * Handle WiFi password change via WhatsApp
     */
    static changeWiFiPassword(phone: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handle ONT restart via WhatsApp
     */
    static restartONT(phone: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Get current WiFi password via WhatsApp
     */
    static getCurrentWiFiInfo(phone: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Get device status via WhatsApp
     */
    static getDeviceStatus(phone: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=GenieacsWhatsAppController.d.ts.map