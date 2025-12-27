export interface IsolationData {
    customer_id: number;
    action: 'isolate' | 'restore';
    reason: string;
    performed_by?: string;
}
export declare class IsolationService {
    /**
     * Isolir pelanggan
     */
    static isolateCustomer(isolationData: IsolationData): Promise<boolean>;
    /**
     * Send isolation warning 3 days before isolation
     */
    static sendIsolationWarnings(daysBefore?: number): Promise<{
        warned: number;
        failed: number;
    }>;
    /**
     * Send pre-block warnings to customers with unpaid invoices
     * Called from 25th to end of month, warning about blocking on the 1st
     */
    static sendPreBlockWarnings(): Promise<{
        warned: number;
        failed: number;
    }>;
    /**
     * Auto isolir pelanggan dengan invoice overdue
     */
    static autoIsolateOverdueCustomers(): Promise<{
        isolated: number;
        failed: number;
    }>;
    /**
     * Auto isolir pelanggan dengan tagihan bulan sebelumnya yang belum lunas
     * Dipanggil setiap hari untuk isolir berdasarkan custom deadline atau default (tanggal 1)
     */
    static autoIsolatePreviousMonthUnpaid(): Promise<{
        isolated: number;
        failed: number;
    }>;
    /**
     * Auto restore pelanggan yang sudah lunas
     */
    static autoRestorePaidCustomers(): Promise<{
        restored: number;
        failed: number;
    }>;
    /**
     * Get isolation history
     */
    static getIsolationHistory(customerId?: number, limit?: number): Promise<import("mysql2").QueryResult>;
    /**
     * Get isolated customers
     */
    static getIsolatedCustomers(): Promise<import("mysql2").QueryResult>;
    /**
     * Bulk isolate customers by ODC
     */
    static bulkIsolateByOdc(odcId: number, reason: string): Promise<{
        isolated: number;
        failed: number;
    }>;
}
//# sourceMappingURL=isolationService.d.ts.map