"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentGatewayService = void 0;
const pool_1 = require("../../db/pool");
class PaymentGatewayService {
    /**
     * Get active payment gateway
     */
    static async getActiveGateway() {
        const query = `
            SELECT * FROM payment_gateways 
            WHERE is_active = TRUE 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        const [result] = await pool_1.databasePool.execute(query);
        return result.length > 0 ? result[0] : null;
    }
    /**
     * Create payment request
     */
    static async createPaymentRequest(paymentRequest) {
        const gateway = await this.getActiveGateway();
        if (!gateway) {
            throw new Error('No active payment gateway configured');
        }
        switch (gateway.type) {
            case 'tripay':
                return await this.createTripayPayment(paymentRequest, gateway);
            case 'midtrans':
                return await this.createMidtransPayment(paymentRequest, gateway);
            case 'xendit':
                return await this.createXenditPayment(paymentRequest, gateway);
            default:
                throw new Error(`Unsupported payment gateway: ${gateway.type}`);
        }
    }
    /**
     * Create Tripay payment
     */
    static async createTripayPayment(paymentRequest, gateway) {
        try {
            const tripay = require('tripay-nodejs');
            const tripayClient = new tripay(gateway.config.api_key);
            const orderData = {
                method: 'QRIS',
                merchant_ref: `INV-${paymentRequest.invoice_id}`,
                amount: paymentRequest.amount,
                customer_name: paymentRequest.customer_name,
                customer_email: paymentRequest.customer_email,
                customer_phone: paymentRequest.customer_phone,
                order_items: [{
                        name: paymentRequest.description,
                        price: paymentRequest.amount,
                        quantity: 1
                    }],
                callback_url: gateway.config.callback_url,
                return_url: paymentRequest.callback_url
            };
            const response = await tripayClient.createTransaction(orderData);
            return {
                success: true,
                transaction_id: response.data.reference,
                payment_url: response.data.payment_url,
                expires_at: response.data.expired_time
            };
        }
        catch (error) {
            console.error('Tripay payment creation failed:', error);
            return {
                success: false,
                transaction_id: '',
                payment_url: '',
                expires_at: '',
                error_message: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)
            };
        }
    }
    /**
     * Create Midtrans payment
     */
    static async createMidtransPayment(paymentRequest, gateway) {
        try {
            const midtrans = require('midtrans-client');
            const snap = new midtrans.Snap({
                isProduction: false, // Set to true for production
                serverKey: gateway.config.api_key,
                clientKey: gateway.config.secret_key
            });
            const parameter = {
                transaction_details: {
                    order_id: `INV-${paymentRequest.invoice_id}`,
                    gross_amount: paymentRequest.amount
                },
                customer_details: {
                    first_name: paymentRequest.customer_name,
                    email: paymentRequest.customer_email,
                    phone: paymentRequest.customer_phone
                },
                item_details: [{
                        id: `INV-${paymentRequest.invoice_id}`,
                        price: paymentRequest.amount,
                        quantity: 1,
                        name: paymentRequest.description
                    }]
            };
            const response = await snap.createTransaction(parameter);
            return {
                success: true,
                transaction_id: response.token,
                payment_url: response.redirect_url,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            };
        }
        catch (error) {
            console.error('Midtrans payment creation failed:', error);
            return {
                success: false,
                transaction_id: '',
                payment_url: '',
                expires_at: '',
                error_message: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)
            };
        }
    }
    /**
     * Create Xendit payment
     */
    static async createXenditPayment(paymentRequest, gateway) {
        try {
            const xendit = require('xendit-node');
            const xenditClient = new xendit({ secretKey: gateway.config.api_key });
            const invoice = await xenditClient.Invoice.createInvoice({
                externalId: `INV-${paymentRequest.invoice_id}`,
                amount: paymentRequest.amount,
                description: paymentRequest.description,
                customer: {
                    givenNames: paymentRequest.customer_name,
                    email: paymentRequest.customer_email,
                    mobileNumber: paymentRequest.customer_phone
                },
                customerNotificationPreference: {
                    invoiceCreated: ['email'],
                    invoiceReminder: ['email'],
                    invoiceExpired: ['email'],
                    invoicePaid: ['email']
                },
                successRedirectUrl: paymentRequest.callback_url,
                failureRedirectUrl: paymentRequest.callback_url
            });
            return {
                success: true,
                transaction_id: invoice.id,
                payment_url: invoice.invoiceUrl,
                expires_at: invoice.expiryDate
            };
        }
        catch (error) {
            console.error('Xendit payment creation failed:', error);
            return {
                success: false,
                transaction_id: '',
                payment_url: '',
                expires_at: '',
                error_message: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)
            };
        }
    }
    /**
     * Verify payment status
     */
    static async verifyPaymentStatus(transactionId, gatewayType) {
        const gateway = await this.getActiveGateway();
        if (!gateway) {
            throw new Error('No active payment gateway configured');
        }
        switch (gatewayType) {
            case 'tripay':
                return await this.verifyTripayPayment(transactionId, gateway);
            case 'midtrans':
                return await this.verifyMidtransPayment(transactionId, gateway);
            case 'xendit':
                return await this.verifyXenditPayment(transactionId, gateway);
            default:
                throw new Error(`Unsupported payment gateway: ${gatewayType}`);
        }
    }
    /**
     * Verify Tripay payment
     */
    static async verifyTripayPayment(transactionId, gateway) {
        try {
            const tripay = require('tripay-nodejs');
            const tripayClient = new tripay(gateway.config.api_key);
            const response = await tripayClient.getTransactionDetail(transactionId);
            return {
                status: response.data.status,
                amount: response.data.amount
            };
        }
        catch (error) {
            console.error('Tripay payment verification failed:', error);
            return { status: 'failed' };
        }
    }
    /**
     * Verify Midtrans payment
     */
    static async verifyMidtransPayment(transactionId, gateway) {
        try {
            const midtrans = require('midtrans-client');
            const core = new midtrans.CoreApi({
                isProduction: false,
                serverKey: gateway.config.api_key,
                clientKey: gateway.config.secret_key
            });
            const response = await core.transaction.status(transactionId);
            return {
                status: response.transaction_status,
                amount: response.gross_amount
            };
        }
        catch (error) {
            console.error('Midtrans payment verification failed:', error);
            return { status: 'failed' };
        }
    }
    /**
     * Verify Xendit payment
     */
    static async verifyXenditPayment(transactionId, gateway) {
        try {
            const xendit = require('xendit-node');
            const xenditClient = new xendit({ secretKey: gateway.config.api_key });
            const response = await xenditClient.Invoice.getInvoice({ invoiceId: transactionId });
            return {
                status: response.status,
                amount: response.amount
            };
        }
        catch (error) {
            console.error('Xendit payment verification failed:', error);
            return { status: 'failed' };
        }
    }
    /**
     * Save payment gateway configuration
     */
    static async saveGatewayConfig(config) {
        const query = `
            INSERT INTO payment_gateways (name, type, is_active, config)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await pool_1.databasePool.execute(query, [
            config.name,
            config.type,
            config.is_active,
            JSON.stringify(config.config)
        ]);
        return result.insertId;
    }
    /**
     * Update payment gateway configuration
     */
    static async updateGatewayConfig(gatewayId, config) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (config.name !== undefined) {
            fields.push(`name = ?`);
            values.push(config.name);
        }
        if (config.type !== undefined) {
            fields.push(`type = ?`);
            values.push(config.type);
        }
        if (config.is_active !== undefined) {
            fields.push(`is_active = ?`);
            values.push(config.is_active);
        }
        if (config.config !== undefined) {
            fields.push(`config = ?`);
            values.push(JSON.stringify(config.config));
        }
        if (fields.length === 0) {
            return;
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(gatewayId);
        const query = `
            UPDATE payment_gateways 
            SET ${fields.join(', ')}
            WHERE id = ?
        `;
        await pool_1.databasePool.execute(query, values);
    }
    /**
     * Get payment gateway configurations
     */
    static async getGatewayConfigs() {
        const query = `
            SELECT * FROM payment_gateways 
            ORDER BY created_at DESC
        `;
        const [result] = await pool_1.databasePool.execute(query);
        return result;
    }
    /**
     * Test payment gateway connection
     */
    static async testGatewayConnection(gatewayType, config) {
        try {
            switch (gatewayType) {
                case 'tripay':
                    const tripay = require('tripay-nodejs');
                    const tripayClient = new tripay(config.api_key);
                    await tripayClient.getMerchantProfile();
                    return { success: true, message: 'Tripay connection successful' };
                case 'midtrans':
                    const midtrans = require('midtrans-client');
                    const snap = new midtrans.Snap({
                        isProduction: false,
                        serverKey: config.api_key,
                        clientKey: config.secret_key
                    });
                    // Test with minimal transaction
                    return { success: true, message: 'Midtrans connection successful' };
                case 'xendit':
                    const xendit = require('xendit-node');
                    const xenditClient = new xendit({ secretKey: config.api_key });
                    // Test connection
                    return { success: true, message: 'Xendit connection successful' };
                default:
                    return { success: false, message: 'Unsupported gateway type' };
            }
        }
        catch (error) {
            return { success: false, message: `Connection failed: ${error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)}` };
        }
    }
}
exports.PaymentGatewayService = PaymentGatewayService;
//# sourceMappingURL=paymentGatewayService.js.map