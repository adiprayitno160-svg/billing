export interface XenditConfig {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
    webhookSecret?: string;
}
export interface XenditVirtualAccount {
    bank_code: string;
    name: string;
    virtual_account_number: string;
    suggested_amount?: number;
    is_closed: boolean;
    expected_amount?: number;
    expiration_date?: string;
    is_single_use?: boolean;
}
export interface XenditEwallet {
    channel_code: string;
    channel_properties: {
        mobile_number?: string;
        success_redirect_url?: string;
        failure_redirect_url?: string;
    };
}
export interface XenditRetailOutlet {
    retail_outlet_name: string;
    payment_code?: string;
}
export interface XenditCreditCard {
    token_id: string;
    authentication_id?: string;
    card_cvn?: string;
}
export interface XenditPaymentRequest {
    external_id: string;
    amount: number;
    description?: string;
    customer?: {
        given_names?: string;
        email?: string;
        mobile_number?: string;
    };
    customer_notification_preference?: {
        invoice_created?: string[];
        invoice_reminder?: string[];
        invoice_paid?: string[];
    };
    success_redirect_url?: string;
    failure_redirect_url?: string;
    payment_methods?: string[];
    currency?: string;
    items?: Array<{
        name: string;
        quantity: number;
        price: number;
        category?: string;
    }>;
    fees?: Array<{
        type: string;
        value: number;
    }>;
    virtual_account?: XenditVirtualAccount;
    ewallet?: XenditEwallet;
    retail_outlet?: XenditRetailOutlet;
    credit_card?: XenditCreditCard;
}
export interface XenditPaymentResponse {
    id: string;
    external_id: string;
    user_id: string;
    status: string;
    merchant_name: string;
    merchant_profile_picture_url: string;
    amount: number;
    description: string;
    invoice_url: string;
    expiry_date: string;
    created: string;
    updated: string;
    currency: string;
    paid_at?: string;
    payment_method?: string;
    payment_channel?: string;
    payment_destination?: string;
    bank_code?: string;
    account_number?: string;
    ewallet_type?: string;
    on_demand_link?: string;
    recurring_payment_id?: string;
    paid_amount?: number;
    mid_label?: string;
    credit_card_charge_id?: string;
    payment_id?: string;
    failure_reason?: string;
    fixed_va?: boolean;
    reminder_date?: string;
    success_redirect_url?: string;
    failure_redirect_url?: string;
    checkout_url?: string;
    items?: Array<{
        name: string;
        quantity: number;
        price: number;
        category?: string;
    }>;
    fees?: Array<{
        type: string;
        value: number;
    }>;
}
export declare class XenditService {
    private client;
    private config;
    constructor(config: XenditConfig);
    /**
     * Membuat invoice untuk pembayaran
     */
    createInvoice(request: XenditPaymentRequest): Promise<XenditPaymentResponse>;
    /**
     * Mendapatkan detail invoice
     */
    getInvoice(invoiceId: string): Promise<XenditPaymentResponse>;
    /**
     * Membuat Virtual Account
     */
    createVirtualAccount(request: {
        external_id: string;
        bank_code: string;
        name: string;
        virtual_account_number?: string;
        suggested_amount?: number;
        is_closed?: boolean;
        expected_amount?: number;
        expiration_date?: string;
        is_single_use?: boolean;
    }): Promise<XenditPaymentResponse>;
    /**
     * Membuat E-Wallet payment
     */
    createEwalletPayment(request: {
        external_id: string;
        amount: number;
        phone?: string;
        ewallet_type: 'OVO' | 'DANA' | 'LINKAJA' | 'SHOPEEPAY';
        callback_url?: string;
        redirect_url?: string;
        items?: Array<{
            name: string;
            quantity: number;
            price: number;
        }>;
    }): Promise<XenditPaymentResponse>;
    /**
     * Membuat Retail Outlet payment
     */
    createRetailOutletPayment(request: {
        external_id: string;
        retail_outlet_name: 'ALFAMART' | 'INDOMARET';
        name: string;
        expected_amount: number;
        payment_code?: string;
        expiration_date?: string;
        is_single_use?: boolean;
    }): Promise<XenditPaymentResponse>;
    /**
     * Membuat Credit Card payment
     */
    createCreditCardPayment(request: {
        token_id: string;
        external_id: string;
        amount: number;
        currency?: string;
        authentication_id?: string;
        card_cvn?: string;
        capture?: boolean;
        descriptor?: string;
    }): Promise<XenditPaymentResponse>;
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
     * Mendapatkan daftar bank yang tersedia untuk Virtual Account
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
     * Mendapatkan daftar retail outlet yang tersedia
     */
    getAvailableRetailOutlets(): Promise<Array<{
        code: string;
        name: string;
    }>>;
}
//# sourceMappingURL=XenditService.d.ts.map