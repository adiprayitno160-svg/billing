export declare class AutoMigrationService {
    private static genAI;
    private static model;
    private static initializeAI;
    /**
     * Menjalankan pengecekan harian untuk pelanggan Postpaid.
     * Logika:
     * 1. Cek User Postpaid.
     * 2. Hitung Invoice Unpaid 1 Tahun Terakhir.
     * 3. Jika >= 3 -> Analisa AI -> Migrasi ke Prepaid.
     * 4. Jika 1-2 -> Analisa AI -> Kirim Peringatan.
     */
    static runDailyArrearsCheck(): Promise<void>;
    private static processCustomer;
    private static executeMigration;
    private static generateAIResponse;
}
//# sourceMappingURL=AutoMigrationService.d.ts.map