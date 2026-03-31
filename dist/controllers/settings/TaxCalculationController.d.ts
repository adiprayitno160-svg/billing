import { Request, Response } from 'express';
export declare class TaxCalculationController {
    /**
     * Get all tax calculations with pagination
     */
    getAllTaxCalculations(req: Request, res: Response): Promise<void>;
    /**
     * Calculate tax for an amount and rate
     */
    calculateTax(req: Request, res: Response): Promise<void>;
    /**
     * Get tax calculation by transaction ID and type
     */
    getTaxCalculation(req: Request, res: Response): Promise<void>;
    /**
     * Get all tax calculations for a transaction
     */
    getTaxCalculationsForTransaction(req: Request, res: Response): Promise<void>;
    /**
     * Get tax summary for a date range
     */
    getTaxSummary(req: Request, res: Response): Promise<void>;
    /**
     * Calculate tax for an invoice
     */
    calculateInvoiceTax(req: Request, res: Response): Promise<void>;
    /**
     * Process tax for an invoice
     */
    processInvoiceTax(req: Request, res: Response): Promise<void>;
    /**
     * Get monthly tax report
     */
    getMonthlyTaxReport(req: Request, res: Response): Promise<void>;
    /**
     * Get tax calculations by type
     */
    getTaxCalculationsByType(req: Request, res: Response): Promise<void>;
}
declare const _default: TaxCalculationController;
export default _default;
//# sourceMappingURL=TaxCalculationController.d.ts.map