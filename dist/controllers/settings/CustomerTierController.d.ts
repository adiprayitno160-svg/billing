import { Request, Response } from 'express';
export declare class CustomerTierController {
    /**
     * Get all customer tiers
     */
    getAllTiers(req: Request, res: Response): Promise<void>;
    /**
     * Get tier by ID
     */
    getTierById(req: Request, res: Response): Promise<void>;
    /**
     * Create a new customer tier
     */
    createTier(req: Request, res: Response): Promise<void>;
    /**
     * Update a customer tier
     */
    updateTier(req: Request, res: Response): Promise<void>;
    /**
     * Delete a customer tier
     */
    deleteTier(req: Request, res: Response): Promise<void>;
    /**
     * Get customer SLA settings
     */
    getCustomerSLASettings(req: Request, res: Response): Promise<void>;
    /**
     * Update customer SLA settings
     */
    updateCustomerSLASettings(req: Request, res: Response): Promise<void>;
    /**
     * Calculate and update customer credit score
     */
    calculateCustomerCreditScore(req: Request, res: Response): Promise<void>;
}
declare const _default: CustomerTierController;
export default _default;
//# sourceMappingURL=CustomerTierController.d.ts.map