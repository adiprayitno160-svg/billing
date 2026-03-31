export declare class PackageChangeNotificationService {
    /**
     * Mengirim notifikasi WhatsApp ke pelanggan tentang tagihan tertunggak sebelum perubahan paket
     * @param customerId ID pelanggan
     * @returns Status pengiriman notifikasi
     */
    static sendOutstandingInvoiceNotification(customerId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Format pesan notifikasi tagihan tertunggak
     */
    private static formatOutstandingInvoiceMessage;
    /**
     * Mendapatkan informasi pelanggan
     */
    private static getCustomerInfo;
    /**
     * Fungsi untuk mengirim pesan WhatsApp
     * Menggunakan layanan WhatsApp yang sudah ada di sistem
     */
    private static sendWhatsAppMessage;
    /**
     * Mengirim notifikasi ke semua pelanggan dengan tagihan tertunggak
     * Digunakan untuk notifikasi massal
     */
    static sendBulkOutstandingInvoiceNotifications(): Promise<{
        successCount: number;
        failureCount: number;
        results: Array<{
            customerId: number;
            success: boolean;
            message: string;
        }>;
    }>;
}
//# sourceMappingURL=PackageChangeNotificationService.d.ts.map