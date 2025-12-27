"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentGatewayService = void 0;
const XenditService_1 = require("./XenditService");
const MitraService_1 = require("./MitraService");
const TripayService_1 = require("./TripayService");
const pool_1 = require("../../db/pool");
class PaymentGatewayService {
    constructor(config) {
        this.xenditService = new XenditService_1.XenditService({
            ...config.xendit,
            baseUrl: config.xendit.baseUrl || 'https://api.xendit.co'
        });
        this.mitraService = new MitraService_1.MitraService({
            ...config.mitra,
            baseUrl: config.mitra.baseUrl || 'https://api.mitra.com'
        });
        this.tripayService = new TripayService_1.TripayService({
            ...config.tripay,
            baseUrl: config.tripay.baseUrl || 'https://tripay.co.id'
        });
    }
    /**
     * Membuat payment request
     */
    async createPayment(request) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // Simpan transaksi ke database
            const [result] = await connection.execute(`INSERT INTO payment_transactions 
         (invoice_id, customer_id, gateway_id, method_id, external_id, amount, currency, status, metadata, expired_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, [
                request.invoiceId,
                request.customerId,
                await this.getGatewayId(request.gatewayCode),
                await this.getMethodId(request.gatewayCode, request.paymentMethod),
                this.generateExternalId(),
                request.amount,
                request.currency,
                JSON.stringify({
                    description: request.description,
                    customerName: request.customerName,
                    customerEmail: request.customerEmail,
                    customerPhone: request.customerPhone,
                }),
                request.expiredAt,
            ]);
            const transactionId = result.insertId;
            const externalId = this.generateExternalId();
            // Update external_id
            await connection.execute('UPDATE payment_transactions SET external_id = ? WHERE id = ?', [externalId, transactionId]);
            let paymentResponse;
            // Proses payment berdasarkan gateway
            switch (request.gatewayCode) {
                case 'xendit':
                    paymentResponse = await this.processXenditPayment(request, externalId);
                    break;
                case 'mitra':
                    paymentResponse = await this.processMitraPayment(request, externalId);
                    break;
                case 'tripay':
                    paymentResponse = await this.processTripayPayment(request, externalId);
                    break;
                default:
                    throw new Error(`Unsupported payment gateway: ${request.gatewayCode}`);
            }
            // Update transaksi dengan response
            await connection.execute(`UPDATE payment_transactions 
         SET status = ?, payment_url = ?, gateway_response = ?, updated_at = NOW()
         WHERE id = ?`, [
                paymentResponse.status,
                paymentResponse.paymentUrl,
                JSON.stringify(paymentResponse),
                transactionId,
            ]);
            await connection.commit();
            return paymentResponse;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Proses payment dengan Xendit
     */
    async processXenditPayment(request, externalId) {
        const xenditRequest = {
            external_id: externalId,
            amount: request.amount,
            description: request.description,
            customer: {
                given_names: request.customerName,
                email: request.customerEmail,
                mobile_number: request.customerPhone,
            },
            success_redirect_url: request.redirectUrl,
            failure_redirect_url: request.redirectUrl,
            currency: request.currency,
        };
        let response;
        switch (request.paymentMethod) {
            case 'virtual_account':
                response = await this.xenditService.createVirtualAccount({
                    ...xenditRequest,
                    bank_code: 'BCA', // Default bank
                    name: request.customerName,
                });
                break;
            case 'ewallet':
                response = await this.xenditService.createEwalletPayment({
                    ...xenditRequest,
                    ewallet_type: 'OVO', // Default ewallet
                });
                break;
            case 'retail_outlet':
                response = await this.xenditService.createRetailOutletPayment({
                    ...xenditRequest,
                    retail_outlet_name: 'ALFAMART', // Default retail outlet
                    name: request.customerName,
                    expected_amount: request.amount,
                });
                break;
            default:
                response = await this.xenditService.createInvoice(xenditRequest);
        }
        return {
            transactionId: externalId,
            status: response.status,
            paymentUrl: response.invoice_url || response.checkout_url,
            accountNumber: response.account_number,
            accountName: response.customer_name,
            bankCode: response.bank_code,
            expiryDate: response.expiry_date,
            metadata: response,
        };
    }
    /**
     * Proses payment dengan Mitra
     */
    async processMitraPayment(request, externalId) {
        const mitraRequest = {
            order_id: externalId,
            amount: request.amount,
            currency: request.currency,
            description: request.description,
            customer_name: request.customerName,
            customer_email: request.customerEmail,
            customer_phone: request.customerPhone,
            payment_method: request.paymentMethod,
            callback_url: request.callbackUrl,
            redirect_url: request.redirectUrl,
            expired_at: request.expiredAt?.toISOString(),
        };
        const response = await this.mitraService.createPayment(mitraRequest);
        return {
            transactionId: externalId,
            status: response.status,
            paymentUrl: response.payment_url,
            accountNumber: response.account_number,
            accountName: response.account_name,
            bankCode: response.bank_code,
            expiryDate: response.expired_at,
            metadata: response,
        };
    }
    /**
     * Proses payment dengan Tripay
     */
    async processTripayPayment(request, externalId) {
        const tripayRequest = {
            method: request.paymentMethod,
            merchant_ref: externalId,
            amount: request.amount,
            customer_name: request.customerName,
            customer_email: request.customerEmail,
            customer_phone: request.customerPhone,
            order_items: [
                {
                    sku: `INV-${request.invoiceId}`,
                    name: request.description,
                    price: request.amount,
                    quantity: 1,
                },
            ],
            return_url: request.redirectUrl,
            expired_time: request.expiredAt ? Math.floor(request.expiredAt.getTime() / 1000) : undefined,
        };
        const response = await this.tripayService.createTransaction(tripayRequest);
        return {
            transactionId: externalId,
            status: response.status,
            paymentUrl: response.checkout_url || response.pay_url,
            accountNumber: response.pay_code,
            expiryDate: new Date(response.expired_time * 1000).toISOString(),
            instructions: response.instructions,
            metadata: response,
        };
    }
    /**
     * Mendapatkan status payment
     */
    async getPaymentStatus(transactionId) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await connection.execute('SELECT * FROM payment_transactions WHERE external_id = ?', [transactionId]);
            if (!rows || rows.length === 0) {
                throw new Error('Transaction not found');
            }
            const transaction = rows[0];
            // Ambil status terbaru dari gateway
            let gatewayStatus;
            switch (transaction.gateway_id) {
                case 1: // Xendit
                    const xenditStatus = await this.xenditService.getInvoice(transaction.external_id);
                    gatewayStatus = xenditStatus.status;
                    break;
                case 2: // Mitra
                    const mitraStatus = await this.mitraService.getPaymentStatus(transaction.external_id);
                    gatewayStatus = mitraStatus.status;
                    break;
                case 3: // Tripay
                    const tripayStatus = await this.tripayService.getTransactionDetail(transaction.external_id);
                    gatewayStatus = tripayStatus.status;
                    break;
            }
            // Update status jika berbeda
            if (gatewayStatus && gatewayStatus !== transaction.status) {
                await connection.execute('UPDATE payment_transactions SET status = ?, updated_at = NOW() WHERE id = ?', [gatewayStatus, transaction.id]);
                transaction.status = gatewayStatus;
            }
            return transaction;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Memproses webhook
     */
    async processWebhook(gatewayCode, payload, signature) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // Log webhook
            const [webhookResult] = await connection.execute(`INSERT INTO payment_webhook_logs (gateway_id, event_type, payload, signature)
         VALUES (?, ?, ?, ?)`, [
                await this.getGatewayId(gatewayCode),
                payload.event_type || 'payment_update',
                JSON.stringify(payload),
                signature,
            ]);
            // Verifikasi signature
            let isValid = false;
            switch (gatewayCode) {
                case 'xendit':
                    isValid = this.xenditService.verifyWebhookSignature(JSON.stringify(payload), signature);
                    break;
                case 'mitra':
                    isValid = this.mitraService.verifyWebhookSignature(JSON.stringify(payload), signature);
                    break;
                case 'tripay':
                    isValid = this.tripayService.verifyWebhookSignature(JSON.stringify(payload), signature);
                    break;
            }
            if (!isValid) {
                throw new Error('Invalid webhook signature');
            }
            // Proses webhook
            let webhookData;
            switch (gatewayCode) {
                case 'xendit':
                    webhookData = await this.xenditService.processWebhook(payload);
                    break;
                case 'mitra':
                    webhookData = await this.mitraService.processWebhook(payload);
                    break;
                case 'tripay':
                    webhookData = await this.tripayService.processWebhook(payload);
                    break;
            }
            // Update transaksi
            if (webhookData) {
                await connection.execute(`UPDATE payment_transactions 
           SET status = ?, paid_at = ?, updated_at = NOW()
           WHERE external_id = ?`, [
                    webhookData.status,
                    webhookData.paidAt ? new Date(webhookData.paidAt) : null,
                    webhookData.transactionId,
                ]);
                // Update invoice jika payment berhasil
                if (webhookData.status === 'completed' || webhookData.status === 'paid') {
                    const [transaction] = await connection.execute(`SELECT pt.invoice_id, pt.amount, p.id as payment_id, i.due_date
                 FROM payment_transactions pt
                 LEFT JOIN payments p ON pt.invoice_id = p.invoice_id AND p.gateway_transaction_id = pt.external_id
                 LEFT JOIN invoices i ON pt.invoice_id = i.id
                 WHERE pt.external_id = ?`, [webhookData.transactionId]);
                    if (transaction && transaction.length > 0) {
                        const transData = transaction[0];
                        const invoiceId = transData.invoice_id;
                        // Update invoice status
                        await connection.execute('UPDATE invoices SET status = "paid", paid_at = NOW() WHERE id = ?', [invoiceId]);
                        // Auto-restore customer if isolated
                        const [custRows] = await connection.execute(`SELECT c.id, c.is_isolated FROM customers c
                   JOIN invoices i ON i.customer_id = c.id
                   WHERE i.id = ?`, [invoiceId]);
                        if (custRows && custRows.length > 0) {
                            const customer = custRows[0];
                            if (customer.is_isolated) {
                                await connection.execute('UPDATE customers SET is_isolated = FALSE WHERE id = ?', [customer.id]);
                                await connection.execute(`INSERT INTO isolation_logs (customer_id, action, reason, created_at)
                       VALUES (?, 'restore', 'Auto restore after payment (webhook)', NOW())`, [customer.id]);
                            }
                        }
                        // Track late payment (async, don't wait)
                        if (transData.payment_id && transData.due_date && webhookData.paidAt) {
                            const { LatePaymentTrackingService } = await Promise.resolve().then(() => __importStar(require('../billing/LatePaymentTrackingService')));
                            const paymentDate = new Date(webhookData.paidAt);
                            const dueDate = new Date(transData.due_date);
                            LatePaymentTrackingService.trackPayment(invoiceId, transData.payment_id, paymentDate, dueDate)
                                .catch(err => console.error('[PaymentGatewayService] Error tracking late payment:', err));
                        }
                    }
                }
            }
            // Mark webhook as processed
            await connection.execute('UPDATE payment_webhook_logs SET is_processed = TRUE, processed_at = NOW() WHERE id = ?', [webhookResult.insertId]);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Mendapatkan daftar payment methods
     */
    async getPaymentMethods(gatewayCode) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            let query = `
        SELECT pm.*, pg.name as gateway_name, pg.code as gateway_code
        FROM payment_methods pm
        JOIN payment_gateways pg ON pm.gateway_id = pg.id
        WHERE pm.is_active = TRUE AND pg.is_active = TRUE
      `;
            const params = [];
            if (gatewayCode) {
                query += ' AND pg.code = ?';
                params.push(gatewayCode);
            }
            const [rows] = await connection.execute(query, params);
            return rows;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Mendapatkan riwayat transaksi
     */
    async getTransactionHistory(customerId, status, limit = 50, offset = 0) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            let query = `
        SELECT pt.*, pg.name as gateway_name, pm.method_name,
               c.name as customer_name, c.email as customer_email
        FROM payment_transactions pt
        JOIN payment_gateways pg ON pt.gateway_id = pg.id
        JOIN payment_methods pm ON pt.method_id = pm.id
        LEFT JOIN customers c ON pt.customer_id = c.id
        WHERE 1=1
      `;
            const params = [];
            if (customerId) {
                query += ' AND pt.customer_id = ?';
                params.push(customerId);
            }
            if (status) {
                query += ' AND pt.status = ?';
                params.push(status);
            }
            query += ` ORDER BY pt.created_at DESC LIMIT ${parseInt(limit.toString())} OFFSET ${parseInt(offset.toString())}`;
            const [rows] = await connection.execute(query, params);
            return rows;
        }
        finally {
            connection.release();
        }
    }
    // Helper methods
    async getGatewayId(gatewayCode) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await connection.execute('SELECT id FROM payment_gateways WHERE code = ?', [gatewayCode]);
            return rows[0]?.id;
        }
        finally {
            connection.release();
        }
    }
    async getMethodId(gatewayCode, methodCode) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await connection.execute(`SELECT pm.id FROM payment_methods pm
         JOIN payment_gateways pg ON pm.gateway_id = pg.id
         WHERE pg.code = ? AND pm.method_code = ?`, [gatewayCode, methodCode]);
            return rows[0]?.id;
        }
        finally {
            connection.release();
        }
    }
    generateExternalId() {
        return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.PaymentGatewayService = PaymentGatewayService;
//# sourceMappingURL=PaymentGatewayService.js.map