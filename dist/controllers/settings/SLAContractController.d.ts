import { Request, Response } from 'express';
export declare class SLAContractController {
    /**
     * Get all SLA contracts with pagination
     */
    getAllContracts(req: Request, res: Response): Promise<void>;
    /**
     * Create a new SLA contract
     */
    createContract(req: Request, res: Response): Promise<void>;
    /**
     * Get SLA contract by ID
     */
    getContractById(req: Request, res: Response): Promise<void>;
    /**
     * Get all contracts for a customer
     */
    getContractsByCustomerId(req: Request, res: Response): Promise<void>;
    /**
     * Get active contracts
     */
    getActiveContracts(req: Request, res: Response): Promise<void>;
    /**
     * Update SLA contract
     */
    updateContract(req: Request, res: Response): Promise<void>;
    /**
     * Update contract status
     */
    updateContractStatus(req: Request, res: Response): Promise<void>;
    /**
     * Check if customer has active contract
     */
    hasActiveContract(req: Request, res: Response): Promise<void>;
    /**
     * Get customer's current SLA target
     */
    getCurrentSLATarget(req: Request, res: Response): Promise<void>;
    /**
     * Get expiring contracts
     */
    getExpiringContracts(req: Request, res: Response): Promise<void>;
    /**
     * Get expired contracts
     */
    getExpiredContracts(req: Request, res: Response): Promise<void>;
    /**
     * Get contract by number
     */
    getContractByNumber(req: Request, res: Response): Promise<void>;
}
declare const _default: SLAContractController;
export default _default;
//# sourceMappingURL=SLAContractController.d.ts.map