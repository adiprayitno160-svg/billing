export declare class ArrearsAnalysisPrompts {
    /**
     * PROMPT 1: Early Warning Analysis (1-2x Tunggakan)
     * Digunakan untuk pelanggan yang belum mencapai ambang batas 3x, tapi sudah mulai menunggak.
     */
    static getEarlyWarningPrompt(customer: {
        name: string;
        id: number;
    }, arrearsStats: {
        count: number;
        totalAmount: number;
        oldestUnpaidDate: string;
    }, historySummary: any[]): string;
    /**
     * PROMPT 2: Migration Action Analysis (>= 3x Tunggakan)
     * Digunakan saat pelanggan sudah mencapai limit 3x tunggakan dalam 1 tahun.
     * AI harus memvalidasi keputusan migrasi ke Prabayar.
     */
    static getMigrationActionPrompt(customer: {
        name: string;
        id: number;
        phone: string;
    }, arrearsStats: {
        count: number;
        totalAmount: number;
        unpaidInvoicesList: any[];
    }): string;
}
//# sourceMappingURL=ArrearsAnalysisPrompts.d.ts.map