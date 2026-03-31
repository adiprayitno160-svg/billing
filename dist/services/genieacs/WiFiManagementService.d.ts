export interface WiFiChangeRequest {
    customerId: number;
    customerName: string;
    phone: string;
    deviceId: string;
    newSSID?: string;
    newPassword?: string;
    requestedAt: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    errorMessage?: string;
}
export interface WiFiConfig {
    ssid: string;
    password: string;
    encryption: string;
    enabled: boolean;
}
export declare class WiFiManagementService {
    private genieacs;
    constructor();
    /**
     * Get WiFi configuration from device
     */
    getWiFiConfig(deviceId: string): Promise<WiFiConfig | null>;
    /**
     * Change WiFi SSID and/or Password
     */
    changeWiFiCredentials(deviceId: string, newSSID?: string, newPassword?: string): Promise<{
        success: boolean;
        message: string;
        taskId?: string;
    }>;
    /**
     * Get WiFi parameter from device (helper)
     */
    private getWiFiParameter;
    /**
     * Get WiFi parameter paths based on device model
     */
    private getWiFiParameterPaths;
    /**
     * Save WiFi change request to database
     */
    saveWiFiChangeRequest(request: WiFiChangeRequest): Promise<number>;
    /**
     * Update WiFi change request status
     */
    updateWiFiChangeRequestStatus(requestId: number, status: 'pending' | 'processing' | 'completed' | 'failed', errorMessage?: string): Promise<void>;
    /**
     * Get customer's device ID from database
     */
    getCustomerDeviceId(customerId: number): Promise<string | null>;
    /**
     * Get WiFi change request history for customer
     */
    getCustomerWiFiHistory(customerId: number, limit?: number): Promise<WiFiChangeRequest[]>;
    /**
     * Reboot customer device
     */
    rebootCustomerDevice(customerId: number): Promise<{
        success: boolean;
        message: string;
    }>;
}
export default WiFiManagementService;
//# sourceMappingURL=WiFiManagementService.d.ts.map