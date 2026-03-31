/**
 * Compensation Service
 * Handles compensation logic for service interruptions (gangguan)
 */
import { Pool, PoolConnection } from 'mysql2/promise';
export interface CompensationRequest {
    customerId: number;
    days: number;
    reason: string;
    startDate?: string;
    endDate?: string;
    adminId?: number;
    adminName?: string;
}
export declare class CompensationService {
    /**
     * Register a new compensation request (Restitution)
     * Handles logic for immediate application to current invoice OR pending for next invoice
     */
    static registerCompensation(request: CompensationRequest, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Helper to apply compensation directly to an existing invoice
     */
    private static applyToInvoice;
    /**
     * Apply compensation to a customer (Legacy/Balance Credit method)
     */
    static applyCompensation(request: CompensationRequest, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Apply balance credit (fallback)
     */
    private static applyBalanceCredit;
    /**
     * Bulk apply compensation
     */
    static processBulkCompensation(incidentId: number, adminId: number): Promise<void>;
}
//# sourceMappingURL=CompensationService.d.ts.map