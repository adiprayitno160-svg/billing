import { PoolConnection, Pool } from 'mysql2/promise';
export interface IsolationData {
    customer_id: number;
    action: 'isolate' | 'restore';
    reason: string;
    performed_by?: string;
    invoice_id?: number;
    unpaid_periods?: string;
    skipNotification?: boolean;
}
export declare class IsolationService {
    /**
     * Ensure system isolation template exists
     */
    private static ensureIsolationTemplateExists;
    /**
     * Execute MikroTik isolation based on customer connection type
     */
    private static executeMikrotikIsolation;
    /**
     * Isolir pelanggan (PPPoE atau Static IP)
     */
    static isolateCustomer(isolationData: IsolationData, existingConnection?: PoolConnection | Pool): Promise<boolean>;
    /**
     * Placeholder methods for other functionalities
     * (Re-implemented minimally to keep file compiling)
     */
    /**
     * Send isolation warnings to customers who will be isolated soon
     */
    static sendIsolationWarnings(daysBefore?: number): Promise<{
        warned: number;
        failed: number;
    }>;
    /**
     * Send pre-block warnings (warning about block on the 1st)
     */
    static sendPreBlockWarnings(): Promise<{
        warned: number;
        failed: number;
    }>;
    /**
     * Send H-1 isolation warnings (1 day before mass isolation date)
     */
    static sendIsolationH1Warnings(): Promise<{
        warned: number;
        failed: number;
        skipped?: string;
    }>;
    /**
     * Auto isolate customers with overdue invoices past grace period.
     * Grace Period = 3 days after due_date.
     * Excludes: partial invoices, deferred customers, and customers with active payment deferments.
     */
    static autoIsolateOverdueCustomers(): Promise<{
        isolated: number;
        failed: number;
    }>;
    /**
     * Auto isolate customers with previous month unpaid invoices (on configured date)
     */
    static autoIsolatePreviousMonthUnpaid(): Promise<{
        isolated: number;
        failed: number;
    }>;
    /**
     * Auto isolate customers whose payment deferment (janji bayar) has expired.
     * When deferred_until_date has passed and invoice is still unpaid, isolate them.
     */
    static autoIsolateDeferredExpired(): Promise<{
        isolated: number;
        failed: number;
    }>;
    /**
     * Auto restore customers who have paid all invoices
     */
    static autoRestorePaidCustomers(): Promise<{
        restored: number;
        failed: number;
    }>;
    /**
     * Restore specific customer if they have no more unpaid invoices
     */
    static restoreIfQualified(customerId: number, existingConnection?: PoolConnection | Pool): Promise<boolean>;
    static getIsolationHistory(customerId?: number, limit?: number): Promise<import("mysql2/promise").QueryResult>;
    static getIsolatedCustomers(): Promise<import("mysql2/promise").QueryResult>;
    /**
     * Restore all isolated customers without sending notifications
     */
    static bulkRestoreAllSilent(performedBy?: string): Promise<{
        restored: number;
        failed: number;
    }>;
    static bulkIsolateByOdc(odcId: number, reason: string): Promise<{
        isolated: number;
        failed: number;
    }>;
    static manualIsolate(customerId: number, action: 'isolate' | 'restore', reason: string, performedBy: string): Promise<boolean>;
    static autoDeleteBlockedCustomers(): Promise<{
        deleted: number;
        failed: number;
    }>;
    static getStatistics(): Promise<any>;
    /**
     * Get customers who are at risk of isolation or in manual bypass
     */
    static getIsolationWatchlist(): Promise<import("mysql2/promise").QueryResult>;
    /**
     * Get customers who are whitelisted (exempt from auto-isolation)
     */
    static getIsolationWhitelist(): Promise<import("mysql2/promise").QueryResult>;
    /**
     * Remove customer from isolation whitelist (cancel deferment)
     */
    static removeIsolationDeferment(customerId: number, performedBy?: string): Promise<boolean>;
    /**
     * Startup Catch-Up Isolation
     * Dijalankan saat server start/restart untuk menangkap customer yang
     * seharusnya sudah terisolir tapi terlewat (misal server down saat jadwal cron).
     * Menggabungkan logika autoIsolateOverdueCustomers + autoIsolatePreviousMonthUnpaid.
     */
    static startupCatchUpIsolation(): Promise<{
        isolated: number;
        failed: number;
        skipped: number;
    }>;
    /**
     * Mass isolate customers based on unpaid invoices in a specific period
     */
    static massIsolateSpecificPeriod(period: string): Promise<{
        isolated: number;
        failed: number;
    }>;
}
//# sourceMappingURL=isolationService.d.ts.map