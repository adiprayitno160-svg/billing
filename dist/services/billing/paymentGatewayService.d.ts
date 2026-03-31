export interface PaymentGatewayConfig {
    name: string;
    type: 'tripay' | 'midtrans' | 'xendit';
    is_active: boolean;
    config: {
        api_key: string;
        merchant_id?: string;
        secret_key?: string;
        webhook_url?: string;
        callback_url?: string;
    };
}
export interface PaymentRequest {
    invoice_id: number;
    amount: number;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    description: string;
    callback_url?: string;
}
export interface PaymentResponse {
    success: boolean;
    transaction_id: string;
    payment_url: string;
    expires_at: string;
    error_message?: string;
}
export declare class PaymentGatewayService {
    /**
     * Get active payment gateway
     */
    static getActiveGateway(): Promise<PaymentGatewayConfig | null>;
    /**
     * Create payment request
     */
    static createPaymentRequest(paymentRequest: PaymentRequest): Promise<PaymentResponse>;
    /**
     * Create Tripay payment
     */
    private static createTripayPayment;
    /**
     * Create Midtrans payment
     */
    private static createMidtransPayment;
    /**
     * Create Xendit payment
     */
    private static createXenditPayment;
    /**
     * Verify payment status
     */
    static verifyPaymentStatus(transactionId: string, gatewayType: string): Promise<{
        status: string;
        amount?: number;
    }>;
    /**
     * Verify Tripay payment
     */
    private static verifyTripayPayment;
    /**
     * Verify Midtrans payment
     */
    private static verifyMidtransPayment;
    /**
     * Verify Xendit payment
     */
    private static verifyXenditPayment;
    /**
     * Save payment gateway configuration
     */
    static saveGatewayConfig(config: PaymentGatewayConfig): Promise<number>;
    /**
     * Update payment gateway configuration
     */
    static updateGatewayConfig(gatewayId: number, config: Partial<PaymentGatewayConfig>): Promise<void>;
    /**
     * Get payment gateway configurations
     */
    static getGatewayConfigs(): Promise<PaymentGatewayConfig[]>;
    /**
     * Test payment gateway connection
     */
    static testGatewayConnection(gatewayType: string, config: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=paymentGatewayService.d.ts.map