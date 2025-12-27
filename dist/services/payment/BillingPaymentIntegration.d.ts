import { PaymentGatewayService } from './PaymentGatewayService';
export interface BillingPaymentRequest {
    invoiceId: number;
    customerId: number;
    gatewayCode: string;
    paymentMethod: string;
    callbackUrl?: string;
    redirectUrl?: string;
}
export declare class BillingPaymentIntegration {
    private paymentService;
    constructor(paymentService: PaymentGatewayService);
    /**
     * Membuat payment untuk invoice billing
     */
    createInvoicePayment(request: BillingPaymentRequest): Promise<any>;
    /**
     * Memproses payment success
     */
    processPaymentSuccess(transactionId: string): Promise<void>;
    /**
     * Memproses payment failure
     */
    processPaymentFailure(transactionId: string, reason: string): Promise<void>;
    /**
     * Mendapatkan payment history untuk customer
     */
    getCustomerPaymentHistory(customerId: number, limit?: number, offset?: number): Promise<any[]>;
    /**
     * Mendapatkan payment statistics untuk dashboard
     */
    getPaymentStatistics(): Promise<any>;
    /**
     * Mendapatkan payment methods yang tersedia untuk customer
     */
    getAvailablePaymentMethods(customerId: number): Promise<any[]>;
    /**
     * Membuat payment link untuk invoice
     */
    createPaymentLink(invoiceId: number, customerId: number): Promise<string>;
    /**
     * Mendapatkan invoice dengan payment options
     */
    getInvoiceWithPaymentOptions(invoiceId: number, customerId: number): Promise<any>;
}
//# sourceMappingURL=BillingPaymentIntegration.d.ts.map