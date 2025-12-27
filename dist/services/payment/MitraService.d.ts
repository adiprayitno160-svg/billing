export interface MitraConfig {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
    webhookSecret?: string;
}
export interface MitraBankTransfer {
    bank_code: string;
    account_number: string;
    account_name: string;
}
export interface MitraVirtualAccount {
    bank_code: string;
    account_number: string;
    account_name: string;
    expiry_date?: string;
}
export interface MitraEwallet {
    provider: string;
    phone_number?: string;
    email?: string;
}
export interface MitraPaymentRequest {
    order_id: string;
    amount: number;
    currency?: string;
    description?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    payment_method: 'bank_transfer' | 'virtual_account' | 'ewallet';
    bank_transfer?: MitraBankTransfer;
    virtual_account?: MitraVirtualAccount;
    ewallet?: MitraEwallet;
    callback_url?: string;
    redirect_url?: string;
    expired_at?: string;
}
export interface MitraPaymentResponse {
    order_id: string;
    transaction_id: string;
    status: string;
    amount: number;
    currency: string;
    payment_method: string;
    payment_url?: string;
    account_number?: string;
    account_name?: string;
    bank_code?: string;
    expiry_date?: string;
    created_at: string;
    updated_at: string;
    paid_at?: string;
    failure_reason?: string;
}
export declare class MitraService {
    private client;
    private config;
    constructor(config: MitraConfig);
    /**
     * Membuat payment request
     */
    createPayment(request: MitraPaymentRequest): Promise<MitraPaymentResponse>;
    /**
     * Mendapatkan status payment
     */
    getPaymentStatus(transactionId: string): Promise<MitraPaymentResponse>;
    /**
     * Membuat Bank Transfer payment
     */
    createBankTransferPayment(request: {
        order_id: string;
        amount: number;
        bank_code: string;
        account_number: string;
        account_name: string;
        description?: string;
        customer_name?: string;
        customer_email?: string;
        customer_phone?: string;
        callback_url?: string;
        redirect_url?: string;
        expired_at?: string;
    }): Promise<MitraPaymentResponse>;
    /**
     * Membuat Virtual Account payment
     */
    createVirtualAccountPayment(request: {
        order_id: string;
        amount: number;
        bank_code: string;
        account_name: string;
        description?: string;
        customer_name?: string;
        customer_email?: string;
        customer_phone?: string;
        callback_url?: string;
        redirect_url?: string;
        expired_at?: string;
    }): Promise<MitraPaymentResponse>;
    /**
     * Membuat E-Wallet payment
     */
    createEwalletPayment(request: {
        order_id: string;
        amount: number;
        provider: string;
        phone_number?: string;
        email?: string;
        description?: string;
        customer_name?: string;
        callback_url?: string;
        redirect_url?: string;
        expired_at?: string;
    }): Promise<MitraPaymentResponse>;
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
     * Mendapatkan saldo akun
     */
    getBalance(): Promise<{
        balance: number;
        currency: string;
    }>;
    /**
     * Mendapatkan riwayat transaksi
     */
    getTransactionHistory(params: {
        start_date?: string;
        end_date?: string;
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        transactions: MitraPaymentResponse[];
        total: number;
        page: number;
        limit: number;
    }>;
}
//# sourceMappingURL=MitraService.d.ts.map