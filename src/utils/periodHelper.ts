/**
 * Helper untuk format period/bulan tagihan
 * Menampilkan bulan tagihan, termasuk jika pembayaran terlewat bulan
 */

/**
 * Format period (YYYY-MM) menjadi format bulan Indonesia
 * Contoh: "2024-01" -> "Januari 2024"
 */
export function formatPeriodToMonth(period: string): string {
    if (!period) return '-';
    
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    try {
        const [year, month] = period.split('-');
        if (!month) return period;
        const monthIndex = parseInt(month) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${months[monthIndex]} ${year}`;
        }
        return period;
    } catch (error) {
        return period;
    }
}

/**
 * Format period menjadi format pendek
 * Contoh: "2024-01" -> "Jan 2024"
 */
export function formatPeriodToMonthShort(period: string): string {
    if (!period) return '-';
    
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    
    try {
        const [year, month] = period.split('-');
        if (!month) return period;
        const monthIndex = parseInt(month) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${months[monthIndex]} ${year}`;
        }
        return period;
    } catch (error) {
        return period;
    }
}

/**
 * Dapatkan bulan tagihan untuk notifikasi
 * Jika pembayaran terlewat bulan, tampilkan bulan tagihan (bulan sebelumnya)
 * 
 * @param invoicePeriod - Period invoice (YYYY-MM)
 * @param paymentDate - Tanggal pembayaran (optional, untuk cek apakah terlewat)
 * @param dueDate - Tanggal jatuh tempo (optional, untuk cek apakah terlewat)
 * @returns Format bulan tagihan
 */
export function getBillingMonth(
    invoicePeriod: string, 
    paymentDate?: Date | string | null,
    dueDate?: Date | string | null
): string {
    if (!invoicePeriod) return '-';
    
    // Jika ada paymentDate dan dueDate, cek apakah pembayaran terlewat bulan
    if (paymentDate && dueDate) {
        const payDate = typeof paymentDate === 'string' ? new Date(paymentDate) : paymentDate;
        const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
        
        // Jika pembayaran setelah bulan due date, berarti terlewat bulan
        // Tampilkan bulan tagihan (periode invoice)
        if (payDate > due) {
            return formatPeriodToMonth(invoicePeriod);
        }
    }
    
    // Default: tampilkan bulan tagihan dari period
    return formatPeriodToMonth(invoicePeriod);
}

/**
 * Dapatkan bulan tagihan untuk notifikasi isolir
 * Selalu tampilkan bulan tagihan dari invoice period
 */
export function getBillingMonthForIsolation(invoicePeriod: string | null): string {
    if (!invoicePeriod) return 'Bulan tagihan tidak tersedia';
    return formatPeriodToMonth(invoicePeriod);
}



