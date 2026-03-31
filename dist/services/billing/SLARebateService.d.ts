export interface SLARebateInfo {
    customerId: number;
    billingPeriod: string;
    uptimePercentage: number;
    targetSla: number;
    isEligible: boolean;
    rebateAmount: number;
    reason: string;
}
export declare class SLARebateService {
    /**
     * Calculate SLA Uptime and Rebate for a customer in a specific period
     */
    static calculateRebate(customerId: number, period: string): Promise<SLARebateInfo>;
    /**
     * Apply SLA Rebate to an invoice
     */
    static applyRebateToInvoice(invoiceId: number): Promise<boolean>;
}
//# sourceMappingURL=SLARebateService.d.ts.map