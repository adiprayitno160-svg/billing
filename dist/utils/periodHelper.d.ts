/**
 * Helper untuk format period/bulan tagihan
 * Menampilkan bulan tagihan, termasuk jika pembayaran terlewat bulan
 */
/**
 * Format period (YYYY-MM) menjadi format bulan Indonesia
 * Contoh: "2024-01" -> "Januari 2024"
 */
export declare function formatPeriodToMonth(period: string): string;
/**
 * Format period menjadi format pendek
 * Contoh: "2024-01" -> "Jan 2024"
 */
export declare function formatPeriodToMonthShort(period: string): string;
/**
 * Dapatkan bulan tagihan untuk notifikasi
 * Jika pembayaran terlewat bulan, tampilkan bulan tagihan (bulan sebelumnya)
 *
 * @param invoicePeriod - Period invoice (YYYY-MM)
 * @param paymentDate - Tanggal pembayaran (optional, untuk cek apakah terlewat)
 * @param dueDate - Tanggal jatuh tempo (optional, untuk cek apakah terlewat)
 * @returns Format bulan tagihan
 */
export declare function getBillingMonth(invoicePeriod: string, paymentDate?: Date | string | null, dueDate?: Date | string | null): string;
/**
 * Dapatkan bulan tagihan untuk notifikasi isolir
 * Selalu tampilkan bulan tagihan dari invoice period
 */
export declare function getBillingMonthForIsolation(invoicePeriod: string | null): string;
//# sourceMappingURL=periodHelper.d.ts.map