"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MitraService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class MitraService {
    constructor(config) {
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl || 'https://api.mitra.com',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'X-API-Key': config.apiKey,
            },
        });
    }
    /**
     * Membuat payment request
     */
    async createPayment(request) {
        try {
            const response = await this.client.post('/v1/payments', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Mendapatkan status payment
     */
    async getPaymentStatus(transactionId) {
        try {
            const response = await this.client.get(`/v1/payments/${transactionId}`);
            return response.data;
        }
        catch (error) {
            throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Bank Transfer payment
     */
    async createBankTransferPayment(request) {
        try {
            const response = await this.client.post('/v1/payments/bank-transfer', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Virtual Account payment
     */
    async createVirtualAccountPayment(request) {
        try {
            const response = await this.client.post('/v1/payments/virtual-account', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat E-Wallet payment
     */
    async createEwalletPayment(request) {
        try {
            const response = await this.client.post('/v1/payments/ewallet', request);
            return response.data;
        }
        catch (error) {
            throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
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
            transactionId: payload.order_id,
            status: payload.status,
            amount: payload.amount,
            paidAt: payload.paid_at,
        };
    }
    /**
     * Mendapatkan daftar bank yang tersedia
     */
    async getAvailableBanks() {
        return [
            { code: 'BCA', name: 'Bank Central Asia' },
            { code: 'BNI', name: 'Bank Negara Indonesia' },
            { code: 'BRI', name: 'Bank Rakyat Indonesia' },
            { code: 'MANDIRI', name: 'Bank Mandiri' },
            { code: 'PERMATA', name: 'Bank Permata' },
            { code: 'BSI', name: 'Bank Syariah Indonesia' },
            { code: 'CIMB', name: 'CIMB Niaga' },
            { code: 'DANAMON', name: 'Bank Danamon' },
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
            { code: 'GOJEK', name: 'GoPay' },
        ];
    }
    /**
     * Mendapatkan saldo akun
     */
    async getBalance() {
        try {
            const response = await this.client.get('/v1/balance');
            return response.data;
        }
        catch (error) {
            throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Mendapatkan riwayat transaksi
     */
    async getTransactionHistory(params) {
        try {
            const response = await this.client.get('/v1/transactions', { params });
            return response.data;
        }
        catch (error) {
            throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
        }
    }
}
exports.MitraService = MitraService;
//# sourceMappingURL=MitraService.js.map