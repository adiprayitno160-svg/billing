import { Request, Response } from 'express';
export declare class BulkOperationsController {
    private wsService;
    constructor(db: any, wsService: any);
    /**
     * Bulk enable/disable ONTs
     */
    bulkToggleONTStatus(req: Request, res: Response): Promise<void>;
    /**
     * Bulk sync ONTs from OLT
     */
    bulkSyncONTs(req: Request, res: Response): Promise<void>;
    /**
     * Bulk update ONT information
     */
    bulkUpdateONTInfo(req: Request, res: Response): Promise<void>;
    /**
     * Bulk assign ONTs to customers
     */
    bulkAssignONTs(req: Request, res: Response): Promise<void>;
    /**
     * Bulk unassign ONTs
     */
    bulkUnassignONTs(req: Request, res: Response): Promise<void>;
    /**
     * Get bulk operation history
     */
    getBulkOperationHistory(req: Request, res: Response): Promise<void>;
    /**
     * Log bulk operation
     */
    private logBulkOperation;
}
//# sourceMappingURL=bulkOperationsController.d.ts.map