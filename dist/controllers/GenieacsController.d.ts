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
    static rebootDevice(req: Request, res: Response): Promise<void>;
    /**
     * Refresh device
     */
    static refreshDevice(req: Request, res: Response): Promise<void>;
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
}
export default GenieacsController;
//# sourceMappingURL=GenieacsController.d.ts.map