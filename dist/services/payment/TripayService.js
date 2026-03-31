"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripayService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class TripayService {
    constructor(config) {
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl || 'https://tripay.co.id/api',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Generate signature untuk request
     */
    generateSignature(merchantRef, amount) {
        const data = `${this.config.merchantCode}${merchantRef}${amount}`;
        return crypto_1.default.createHmac('sha256', this.config.secretKey).update(data).digest('hex');
    }
    /**
     * Mendapatkan daftar channel pembayaran
     */
    async getPaymentChannels() {
        try {
            const response = await this.client.get('/merchant/payment-channel');
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat transaksi pembayaran
     */
    async createTransaction(request) {
        try {
            // Generate signature
            const signature = this.generateSignature(request.merchant_ref, request.amount);
            request.signature = signature;
            const response = await this.client.post('/transaction/create', request);
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Mendapatkan detail transaksi
     */
    async getTransactionDetail(reference) {
        try {
            const response = await this.client.get(`/transaction/detail?reference=${reference}`);
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Virtual Account payment
     */
    async createVirtualAccountPayment(request) {
        try {
            const signature = this.generateSignature(request.merchant_ref, request.amount);
            const response = await this.client.post('/transaction/create', {
                ...request,
                signature,
            });
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Bank Transfer payment
     */
    async createBankTransferPayment(request) {
        try {
            const signature = this.generateSignature(request.merchant_ref, request.amount);
            const response = await this.client.post('/transaction/create', {
                ...request,
                signature,
            });
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat E-Wallet payment
     */
    async createEwalletPayment(request) {
        try {
            const signature = this.generateSignature(request.merchant_ref, request.amount);
            const response = await this.client.post('/transaction/create', {
                ...request,
                signature,
            });
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
        }
    }
    /**
     * Membuat Convenience Store payment
     */
    async createConvenienceStorePayment(request) {
        try {
            const signature = this.generateSignature(request.merchant_ref, request.amount);
            const response = await this.client.post('/transaction/create', {
                ...request,
                signature,
            });
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
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
            transactionId: payload.merchant_ref,
            status: payload.status,
            amount: payload.total_amount,
            paidAt: payload.paid_at,
        };
    }
    /**
     * Mendapatkan daftar bank yang tersedia
     */
    async getAvailableBanks() {
        try {
            const channels = await this.getPaymentChannels();
            return channels
                .filter(channel => channel.group === 'Virtual Account' || channel.group === 'Bank Transfer')
                .map(channel => ({
                code: channel.code,
                name: channel.name,
            }));
        }
        catch (error) {
            return [
                { code: 'BCA', name: 'Bank Central Asia' },
                { code: 'BNI', name: 'Bank Negara Indonesia' },
                { code: 'BRI', name: 'Bank Rakyat Indonesia' },
                { code: 'MANDIRI', name: 'Bank Mandiri' },
            ];
        }
    }
    /**
     * Mendapatkan daftar e-wallet yang tersedia
     */
    async getAvailableEwallets() {
        try {
            const channels = await this.getPaymentChannels();
            return channels
                .filter(channel => channel.group === 'E-Wallet')
                .map(channel => ({
                code: channel.code,
                name: channel.name,
            }));
        }
        catch (error) {
            return [
                { code: 'OVO', name: 'OVO' },
                { code: 'DANA', name: 'DANA' },
                { code: 'LINKAJA', name: 'LinkAja' },
                { code: 'SHOPEEPAY', name: 'ShopeePay' },
            ];
        }
    }
    /**
     * Mendapatkan daftar convenience store yang tersedia
     */
    async getAvailableConvenienceStores() {
        try {
            const channels = await this.getPaymentChannels();
            return channels
                .filter(channel => channel.group === 'Convenience Store')
                .map(channel => ({
                code: channel.code,
                name: channel.name,
            }));
        }
        catch (error) {
            return [
                { code: 'ALFAMART', name: 'Alfamart' },
                { code: 'INDOMARET', name: 'Indomaret' },
            ];
        }
    }
    /**
     * Mendapatkan saldo merchant
     */
    async getMerchantBalance() {
        try {
            const response = await this.client.get('/merchant/balance');
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
        }
    }
}
exports.TripayService = TripayService;
//# sourceMappingURL=TripayService.js.map