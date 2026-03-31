interface StaticIPCustomer {
    id: number;
    name: string;
    phone: string;
    static_ip: string;
    area: string;
    location: string;
    last_ping_check: Date | null;
    monitoring_state: 'normal' | 'timeout_5min' | 'timeout_10min' | 'awaiting_confirmation_12min' | 'ticket_created' | 'resolved';
    ping_timeout_started_at: Date | null;
    awaiting_customer_response: boolean;
    customer_response_received: boolean;
}
export declare class SmartStaticIPMonitoringService {
    private whatsappService;
    constructor();
    /**
     * Dapatkan semua pelanggan IP static yang aktif
     */
    getActiveStaticIPCustomers(): Promise<StaticIPCustomer[]>;
    /**
     * Ping IP address dan cek apakah merespon
     */
    pingIPAddress(ip: string): Promise<boolean>;
    /**
     * Buat tiket otomatis untuk teknisi
     */
    createAutomaticTicket(customer: StaticIPCustomer, issueDescription: string): Promise<number | null>;
    /**
     * Update monitoring state pelanggan
     */
    updateCustomerMonitoringState(customerId: number, state: 'normal' | 'timeout_5min' | 'timeout_10min' | 'awaiting_confirmation_12min' | 'ticket_created' | 'resolved', timeoutStartedAt?: Date | null, awaitingResponse?: boolean, responseReceived?: boolean): Promise<void>;
    /**
     * Kirim konfirmasi ke pelanggan di menit 12
     */
    sendCustomerConfirmationRequest(customer: StaticIPCustomer): Promise<void>;
    /**
     * Proses monitoring cerdas untuk semua pelanggan IP static
     * Logika: Ping normal 15min → Timeout 5min → Timeout 10min → Konfirmasi 12min → Tiket 15min
     */
    runSmartMonitoring(): Promise<void>;
    /**
     * Proses monitoring untuk satu pelanggan IP static
     */
    private processCustomerMonitoring;
}
export {};
//# sourceMappingURL=SmartStaticIPMonitoringService.d.ts.map