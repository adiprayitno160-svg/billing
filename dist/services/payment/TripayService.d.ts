export interface TripayConfig {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
    webhookSecret?: string;
}
export interface TripayChannel {
    code: string;
    name: string;
    group: string;
    fee_merchant: {
        flat: number;
        percent: number;
    };
    fee_customer: {
        flat: number;
        percent: number;
    };
    total_fee: {
        flat: number;
        percent: number;
    };
    minimum_fee: number;
    maximum_fee: number;
    icon_url: string;
    active: boolean;
}
export interface TripayPaymentRequest {
    method: string;
    merchant_ref: string;
    amount: number;
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    order_items: Array<{
        sku: string;
        name: string;
        price: number;
        quantity: number;
    }>;
    return_url?: string;
    expired_time?: number;
    signature?: string;
}
export interface TripayPaymentResponse {
    reference: string;
    merchant_ref: string;
    payment_method: string;
    payment_method_code: string;
    total_amount: number;
    fee_merchant: number;
    fee_customer: number;
    total_fee: number;
    amount_received: number;
    pay_code?: string;
    pay_url?: string;
    checkout_url?: string;
    status: string;
    expired_time: number;
    order_items: Array<{
        sku: string;
        name: string;
        price: number;
        quantity: number;
    }>;
    instructions?: Array<{
        title: string;
        steps: string[];
    }>;
    created_at: string;
    updated_at: string;
}
export interface TripayTransactionDetail {
    reference: string;
    merchant_ref: string;
    payment_method: string;
    payment_method_code: string;
    total_amount: number;
    fee_merchant: number;
    fee_customer: number;
    total_fee: number;
    amount_received: number;
    pay_code?: string;
    pay_url?: string;
    checkout_url?: string;
    status: string;
    expired_time: number;
    order_items: Array<{
        sku: string;
        name: string;
        price: number;
        quantity: number;
    }>;
    instructions?: Array<{
        title: string;
        steps: string[];
    }>;
    created_at: string;
    updated_at: string;
    paid_at?: string;
    note?: string;
}
export declare class TripayService {
    private client;
    private config;
    constructor(config: TripayConfig);
    /**
     * Generate signature untuk request
     */
    private generateSignature;
    /**
     * Mendapatkan daftar channel pembayaran
     */
    getPaymentChannels(): Promise<TripayChannel[]>;
    /**
     * Membuat transaksi pembayaran
     */
    createTransaction(request: TripayPaymentRequest): Promise<TripayPaymentResponse>;
    /**
     * Mendapatkan detail transaksi
     */
    getTransactionDetail(reference: string): Promise<TripayTransactionDetail>;
    /**
     * Membuat Virtual Account payment
     */
    createVirtualAccountPayment(request: {
        method: string;
        merchant_ref: string;
        amount: number;
        customer_name: string;
        customer_email?: string;
        customer_phone?: string;
        order_items: Array<{
            sku: string;
            name: string;
            price: number;
            quantity: number;
        }>;
        return_url?: string;
        expired_time?: number;
    }): Promise<TripayPaymentResponse>;
    /**
     * Membuat Bank Transfer payment
     */
    createBankTransferPayment(request: {
        method: string;
        merchant_ref: string;
        amount: number;
        customer_name: string;
        customer_email?: string;
        customer_phone?: string;
        order_items: Array<{
            sku: string;
            name: string;
            price: number;
            quantity: number;
        }>;
        return_url?: string;
        expired_time?: number;
    }): Promise<TripayPaymentResponse>;
    /**
     * Membuat E-Wallet payment
     */
    createEwalletPayment(request: {
        method: string;
        merchant_ref: string;
        amount: number;
        customer_name: string;
        customer_email?: string;
        customer_phone?: string;
        order_items: Array<{
            sku: string;
            name: string;
            price: number;
            quantity: number;
        }>;
        return_url?: string;
        expired_time?: number;
    }): Promise<TripayPaymentResponse>;
    /**
     * Membuat Convenience Store payment
     */
    createConvenienceStorePayment(request: {
        method: string;
        merchant_ref: string;
        amount: number;
        customer_name: string;
        customer_email?: string;
        customer_phone?: string;
        order_items: Array<{
            sku: string;
            name: string;
            price: number;
            quantity: number;
        }>;
        return_url?: string;
        expired_time?: number;
    }): Promise<TripayPaymentResponse>;
    /**
     * Verifikasi webhook signature
     */
    verifyWebhookSignature(payload: string, signature: string): boolean;
    /**
     * Memproses webhook callback
     */
    processWebhook(payload: any): Promise<{
        transactionId: string;
        status: string;
        amount: number;
        paidAt?: string;
    }>;
    /**
     * Mendapatkan daftar bank yang tersedia
     */
    getAvailableBanks(): Promise<Array<{
        code: string;
        name: string;
    }>>;
    /**
     * Mendapatkan daftar e-wallet yang tersedia
     */
    getAvailableEwallets(): Promise<Array<{
        code: string;
        name: string;
    }>>;
    /**
     * Mendapatkan daftar convenience store yang tersedia
     */
    getAvailableConvenienceStores(): Promise<Array<{
        code: string;
        name: string;
    }>>;
    /**
     * Mendapatkan saldo merchant
     */
    getMerchantBalance(): Promise<{
        balance: number;
        currency: string;
    }>;
}
//# sourceMappingURL=TripayService.d.ts.map