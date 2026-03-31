"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XenditService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class XenditService {
    constructor(config) {
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl || 'https://api.xendit.co',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${config.apiKey}:`).toString('base64')}`,
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Membuat invoice untuk pembayaran
     */
    async createInvoice(request) {
        try {
            const response = await this.client.post('/v2/invoices', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Mendapatkan detail invoice
     */
    async getInvoice(invoiceId) {
        try {
            const response = await this.client.get(`/v2/invoices/${invoiceId}`);
            return response.data;
        }
        catch (error) {
            throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Virtual Account
     */
    async createVirtualAccount(request) {
        try {
            const response = await this.client.post('/virtual_accounts', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat E-Wallet payment
     */
    async createEwalletPayment(request) {
        try {
            const response = await this.client.post('/ewallets', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Retail Outlet payment
     */
    async createRetailOutletPayment(request) {
        try {
            const response = await this.client.post('/retail_outlets', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Credit Card payment
     */
    async createCreditCardPayment(request) {
        try {
            const response = await this.client.post('/credit_card_charges', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Verifikasi webhook signature
     */
    verifyWebhookSignature(payload, signature) {
        if (!this.config.webhookSecret) {
            return false;
        }
        const expectedSignature = crypto_1.default
            .createHmac('sha256', this.config.webhookSecret)
            .update(payload)
            .digest('hex');
        return crypto_1.default.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    }
    /**
     * Memproses webhook callback
     */
    async processWebhook(payload) {
        return {
            transactionId: payload.external_id,
            status: payload.status,
            amount: payload.amount,
            paidAt: payload.paid_at,
        };
    }
    /**
     * Mendapatkan daftar bank yang tersedia untuk Virtual Account
     */
    async getAvailableBanks() {
        return [
            { code: 'BCA', name: 'Bank Central Asia' },
            { code: 'BNI', name: 'Bank Negara Indonesia' },
            { code: 'BRI', name: 'Bank Rakyat Indonesia' },
            { code: 'MANDIRI', name: 'Bank Mandiri' },
            { code: 'PERMATA', name: 'Bank Permata' },
            { code: 'BSI', name: 'Bank Syariah Indonesia' },
        ];
    }
    /**
     * Mendapatkan daftar e-wallet yang tersedia
     */
    async getAvailableEwallets() {
        return [
            { code: 'OVO', name: 'OVO' },
            { code: 'DANA', name: 'DANA' },
            { code: 'LINKAJA', name: 'LinkAja' },
            { code: 'SHOPEEPAY', name: 'ShopeePay' },
        ];
    }
    /**
     * Mendapatkan daftar retail outlet yang tersedia
     */
    async getAvailableRetailOutlets() {
        return [
            { code: 'ALFAMART', name: 'Alfamart' },
            { code: 'INDOMARET', name: 'Indomaret' },
        ];
    }
}
exports.XenditService = XenditService;
//# sourceMappingURL=XenditService.js.map