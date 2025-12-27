import { Request, Response } from 'express';
export declare class WiFiAdminController {
    /**
     * Dashboard WiFi Management
     */
    static dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Manage Customer Devices (Assign device_id)
     */
    static manageDevices(req: Request, res: Response): Promise<void>;
    /**
     * Assign device to customer
     */
    static assignDevice(req: Request, res: Response): Promise<void>;
    /**
     * Remove device from customer
     */
    static removeDevice(req: Request, res: Response): Promise<void>;
    /**
     * View WiFi change history
     */
    static history(req: Request, res: Response): Promise<void>;
    /**
     * Manual WiFi change by admin
     */
    static manualChange(req: Request, res: Response): Promise<void>;
    /**
     * API: Get customer by ID (for AJAX)
     */
    static apiGetCustomer(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * API: Get WiFi config from device
     */
    static apiGetWiFiConfig(req: Request, res: Response): Promise<void>;
}
export default WiFiAdminController;
//# sourceMappingURL=WiFiAdminController.d.ts.map