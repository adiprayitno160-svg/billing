import { Request, Response } from 'express';
export declare class SystemLogController {
    /**
     * Show Logs Page
     */
    static index(req: Request, res: Response): Promise<void>;
    /**
     * API to stream/tail logs (simple version)
     */
    static getLogContent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=SystemLogController.d.ts.map