export interface OutstandingInvoice {
    id: number;
    invoice_number: string;
    period: string;
    due_date: string;
    total_amount: number;
    remaining_amount: number;
    status: string;
}
export interface ValidationResponse {
    isValid: boolean;
    message: string;
    outstandingInvoices?: OutstandingInvoice[];
    totalOutstandingAmount?: number;
}
/**
 * Service untuk validasi pembayaran sebelum perubahan paket
 */
export declare class PackageChangeValidationService {
    /**
     * Memeriksa apakah pelanggan memiliki tagihan tertunggak
     * @param customerId ID pelanggan
     * @returns Informasi validasi dan daftar tagihan tertunggak jika ada
     */
    static validateCustomerPaymentStatus(customerId: number): Promise<ValidationResponse>;
    /**
     * Mendapatkan semua tagihan tertunggak untuk pelanggan
     * @param customerId ID pelanggan
     * @returns Daftar tagihan tertunggak
     */
    static getOutstandingInvoices(customerId: number): Promise<OutstandingInvoice[]>;
    /**
     * Memeriksa apakah pelanggan postpaid
     * @param customerId ID pelanggan
     * @returns true jika pelanggan postpaid
     */
    static isPostpaidCustomer(customerId: number): Promise<boolean>;
    /**
     * Validasi lengkap sebelum perubahan paket
     * @param customerId ID pelanggan
     * @returns Hasil validasi lengkap
     */
    static validatePackageChangeEligibility(customerId: number): Promise<ValidationResponse>;
}
//# sourceMappingURL=PackageChangeValidationService.d.ts.map