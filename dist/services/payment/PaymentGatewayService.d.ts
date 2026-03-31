export interface PaymentGatewayConfig {
    xendit: {
        apiKey: string;
        secretKey: string;
        baseUrl?: string;
        webhookSecret?: string;
    };
    mitra: {
        apiKey: string;
        secretKey: string;
        baseUrl?: string;
        webhookSecret?: string;
    };
    tripay: {
        apiKey: string;
        secretKey: string;
        baseUrl?: string;
        webhookSecret?: string;
        merchantCode: string;
    };
}
export interface PaymentRequest {
    invoiceId: number;
    customerId: number;
    amount: number;
    currency: string;
    description: string;
    paymentMethod: string;
    gatewayCode: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    callbackUrl?: string;
    redirectUrl?: string;
    expiredAt?: Date;
}
export interface PaymentResponse {
    transactionId: string;
    status: string;
    paymentUrl?: string;
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
    expiryDate?: string;
    instructions?: any[];
    metadata?: any;
}
export declare class PaymentGatewayService {
    private xenditService;
    private mitraService;
    private tripayService;
    constructor(config: PaymentGatewayConfig);
    /**
     * Membuat payment request
     */
    createPayment(request: PaymentRequest): Promise<PaymentResponse>;
    /**
     * Proses payment dengan Xendit
     */
    private processXenditPayment;
    /**
     * Proses payment dengan Mitra
     */
    private processMitraPayment;
    /**
     * Proses payment dengan Tripay
     */
    private processTripayPayment;
    /**
     * Mendapatkan status payment
     */
    getPaymentStatus(transactionId: string): Promise<any>;
    /**
     * Memproses webhook
     */
    processWebhook(gatewayCode: string, payload: any, signature: string): Promise<void>;
    /**
     * Mendapatkan daftar payment methods
     */
    getPaymentMethods(gatewayCode?: string): Promise<any[]>;
    /**
     * Mendapatkan riwayat transaksi
     */
    getTransactionHistory(customerId?: number, status?: string, limit?: number, offset?: number): Promise<any[]>;
    private getGatewayId;
    private getMethodId;
    private generateExternalId;
}
//# sourceMappingURL=PaymentGatewayService.d.ts.map