import { Request, Response } from 'express';
export declare class GenieacsController {
    /**
     * Dashboard GenieACS
     */
    static dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Device list
     */
    static devices(req: Request, res: Response): Promise<void>;
    /**
     * Device detail
     */
    static deviceDetail(req: Request, res: Response): Promise<void>;
    /**
     * Reboot device
     */
    static rebootDevice(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Refresh device
     */
    static refreshDevice(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Refresh WiFi Info
     */
    static refreshWiFi(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * API: Get devices (JSON)
     */
    static apiGetDevices(req: Request, res: Response): Promise<void>;
    /**
     * API: Test connection
     */
    static apiTestConnection(req: Request, res: Response): Promise<void>;
    /**
     * Change WiFi credentials
     */
    static changeWiFiCredentials(req: Request, res: Response): Promise<void>;
    /**
     * Change PPPoE credentials
     */
    static changePPPoECredentials(req: Request, res: Response): Promise<void>;
    /**
     * Configure WAN Connection (PPPoE/Bridge/Static/DHCP)
     */
    static configureWan(req: Request, res: Response): Promise<void>;
    /**
     * Sync All Tags (Billing Customers -> GenieACS)
     * Enhanced to match by Serial OR PPPoE username
     */
    static syncAllTags(req: Request, res: Response): Promise<void>;
    /**
     * Sync Customer Name as Tag to GenieACS
     */
    static syncCustomerTag(req: Request, res: Response): Promise<void>;
    /**
     * Assign Customer to Device (Link Serial Number)
     */
    static assignCustomer(req: Request, res: Response): Promise<void>;
    /**
     * Unlink Customer from Device (Remove Serial Number)
     */
    static unlinkCustomer(req: Request, res: Response): Promise<void>;
}
export default GenieacsController;
//# sourceMappingURL=GenieacsController.d.ts.map