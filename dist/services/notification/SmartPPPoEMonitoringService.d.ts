interface PrepaidCustomer {
    id: number;
    name: string;
    phone: string;
    pppoe_username: string;
    area: string;
    odc_location: string;
    last_connection_loss: Date | null;
    monitoring_state: 'initial' | 'minute_3_check' | 'minute_6_action' | 'ticket_created' | 'resolved';
    connection_loss_detected_at: Date | null;
}
export declare class SmartPPPoEMonitoringService {
    private whatsappService;
    constructor();
    /**
     * Dapatkan semua pelanggan prepaid PPPoE yang aktif
     */
    getActivePrepaidPPPoECustomers(): Promise<PrepaidCustomer[]>;
    /**
     * Cek koneksi aktif di MikroTik untuk pelanggan tertentu
     */
    checkMikroTikActiveConnections(username: string): Promise<boolean>;
    /**
     * Reset paksa koneksi PPPoE pelanggan di MikroTik
     */
    forceResetPPPoEConnection(username: string): Promise<boolean>;
    /**
     * Buat tiket otomatis untuk teknisi
     */
    createAutomaticTicket(customer: PrepaidCustomer, issueDescription: string): Promise<number | null>;
    /**
     * Dapatkan data pelanggan berdasarkan username PPPoE
     */
    getCustomerByUsername(username: string): Promise<PrepaidCustomer | null>;
    /**
     * Update monitoring state pelanggan
     */
    updateCustomerMonitoringState(customerId: number, state: 'initial' | 'minute_3_check' | 'minute_6_action' | 'ticket_created' | 'resolved', connectionLossDetectedAt?: Date | null): Promise<void>;
    /**
     * Proses monitoring cerdas untuk semua pelanggan prepaid PPPoE
     * Logika: Deteksi awal → Cek menit 3 → Action menit 6
     */
    runSmartMonitoring(): Promise<void>;
    /**
     * Proses monitoring untuk satu pelanggan
     */
    private processCustomerMonitoring;
}
export {};
//# sourceMappingURL=SmartPPPoEMonitoringService.d.ts.map