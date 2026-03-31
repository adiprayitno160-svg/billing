import { Request, Response } from 'express';
export declare class IpCalculatorController {
    static renderPage(req: Request, res: Response): Promise<void>;
    /**
     * Scan subnet in /30 increments (client IPs: .2, .6, .10, .14, ... .254)
     */
    static scanSubnet30(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Save a new subnet tab
     */
    static saveTab(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Delete a subnet tab
     */
    static deleteTab(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static scanSubnet(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update IP comment/label - save to DB and optionally sync to MikroTik
     */
    static updateComment(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Delete manual IP label
     */
    static deleteComment(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=IpCalculatorController.d.ts.map