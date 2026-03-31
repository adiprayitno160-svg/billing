import { Request, Response } from 'express';
export declare class BroadcastController {
    /**
     * Send mass message to all customers
     */
    static sendBroadcast(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get all customers for broadcast selection
     */
    static getCustomers(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=BroadcastController.d.ts.map