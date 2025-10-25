/**
 * Utility untuk generate ID Pelanggan otomatis
 * Format: YYYYMMDDHHMMSS
 */

export class CustomerIdGenerator {
    /**
     * Generate ID Pelanggan otomatis dengan format YYYYMMDDHHMMSS
     * @returns string - ID Pelanggan dalam format YYYYMMDDHHMMSS
     */
    static generateCustomerId(): string {
        const now = new Date();
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    /**
     * Generate ID Pelanggan dengan prefix opsional
     * @param prefix - Prefix untuk ID (contoh: "CUST", "PLG")
     * @returns string - ID Pelanggan dengan prefix
     */
    static generateCustomerIdWithPrefix(prefix: string = ''): string {
        const baseId = this.generateCustomerId();
        return prefix ? `${prefix}${baseId}` : baseId;
    }

    /**
     * Validasi format ID Pelanggan
     * @param customerId - ID Pelanggan yang akan divalidasi
     * @returns boolean - true jika format valid
     */
    static isValidCustomerIdFormat(customerId: string): boolean {
        // Format: YYYYMMDDHHMMSS (14 digit)
        const pattern = /^\d{14}$/;
        return pattern.test(customerId);
    }

    /**
     * Parse ID Pelanggan untuk mendapatkan tanggal dan waktu
     * @param customerId - ID Pelanggan
     * @returns Date | null - Tanggal dan waktu dari ID, atau null jika invalid
     */
    static parseCustomerIdDate(customerId: string): Date | null {
        if (!this.isValidCustomerIdFormat(customerId)) {
            return null;
        }

        const year = parseInt(customerId.substring(0, 4));
        const month = parseInt(customerId.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(customerId.substring(6, 8));
        const hours = parseInt(customerId.substring(8, 10));
        const minutes = parseInt(customerId.substring(10, 12));
        const seconds = parseInt(customerId.substring(12, 14));

        return new Date(year, month, day, hours, minutes, seconds);
    }
}
