/**
 * Utility untuk generate ID Pelanggan otomatis
 * Format: YYYYMMDDHHMMSS (14 digit - tahun bulan tanggal jam menit detik)
 */
export declare class CustomerIdGenerator {
    /**
     * Generate ID Pelanggan otomatis dengan format YYYYMMDDHHMMSS (14 digit)
     * @returns string - ID Pelanggan dalam format YYYYMMDDHHMMSS
     */
    static generateCustomerId(): string;
    /**
     * Generate ID Pelanggan dari tanggal (untuk format timestamp dari created_at)
     * @param date - Date object untuk di-convert ke format timestamp
     * @returns string - ID Pelanggan dalam format YYYYMMDDHHMMSS
     */
    static generateCustomerIdFromDate(date: Date): string;
    /**
     * Generate ID Pelanggan dengan prefix opsional
     * @param prefix - Prefix untuk ID (contoh: "CUST", "PLG")
     * @returns string - ID Pelanggan dengan prefix
     */
    static generateCustomerIdWithPrefix(prefix?: string): string;
    /**
     * Validasi format ID Pelanggan
     * @param customerId - ID Pelanggan yang akan divalidasi
     * @returns boolean - true jika format valid
     */
    static isValidCustomerIdFormat(customerId: string): boolean;
    /**
     * Parse ID Pelanggan untuk mendapatkan tanggal dan waktu
     * @param customerId - ID Pelanggan
     * @returns Date | null - Tanggal dan waktu dari ID, atau null jika invalid
     */
    static parseCustomerIdDate(customerId: string): Date | null;
}
//# sourceMappingURL=customerIdGenerator.d.ts.map