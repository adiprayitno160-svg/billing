export declare class PackageChangeService {
    /**
     * Mengganti paket pelanggan dengan validasi pembayaran terlebih dahulu
     * @param customerId ID pelanggan
     * @param newPackageId ID paket baru
     * @param packageType Jenis paket ('static_ip' atau 'pppoe')
     * @returns Hasil perubahan paket
     */
    static changePackageWithValidation(customerId: number, newPackageId: number, packageType: 'static_ip' | 'pppoe'): Promise<{
        success: boolean;
        message: string;
        requiresPayment?: boolean;
        invoiceNotificationSent?: boolean;
    }>;
    /**
     * Mengganti paket static IP dengan validasi
     */
    private static changeStaticIpPackage;
    /**
     * Mengganti paket PPPoE dengan validasi
     */
    private static changePppoePackage;
    /**
     * Mengganti paket pelanggan tanpa validasi (force change)
     * Hanya digunakan oleh admin untuk kasus-kasus tertentu
     */
    static forceChangePackage(customerId: number, newPackageId: number, packageType: 'static_ip' | 'pppoe', adminId: number, reason: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Mencatat perubahan paket paksa ke log
     */
    private static logForcePackageChange;
    /**
     * Membuat log perubahan paket normal
     */
    static logPackageChange(customerId: number, oldPackageId: number, newPackageId: number, adminId: number): Promise<void>;
}
//# sourceMappingURL=PackageChangeService.d.ts.map