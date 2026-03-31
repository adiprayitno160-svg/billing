import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

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

export class TripayService {
  private client: AxiosInstance;
  private config: TripayConfig;

  constructor(config: TripayConfig) {
    this.config = config;
    this.client = axios.create({
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
  private generateSignature(merchantRef: string, amount: number): string {
    const data = `${(this.config as any).merchantCode}${merchantRef}${amount}`;
    return crypto.createHmac('sha256', this.config.secretKey).update(data).digest('hex');
  }

  /**
   * Mendapatkan daftar channel pembayaran
   */
  async getPaymentChannels(): Promise<TripayChannel[]> {
    try {
      const response = await this.client.get('/merchant/payment-channel');
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat transaksi pembayaran
   */
  async createTransaction(request: TripayPaymentRequest): Promise<TripayPaymentResponse> {
    try {
      // Generate signature
      const signature = this.generateSignature(request.merchant_ref, request.amount);
      request.signature = signature;

      const response = await this.client.post('/transaction/create', request);
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Mendapatkan detail transaksi
   */
  async getTransactionDetail(reference: string): Promise<TripayTransactionDetail> {
    try {
      const response = await this.client.get(`/transaction/detail?reference=${reference}`);
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Virtual Account payment
   */
  async createVirtualAccountPayment(request: {
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
  }): Promise<TripayPaymentResponse> {
    try {
      const signature = this.generateSignature(request.merchant_ref, request.amount);
      const response = await this.client.post('/transaction/create', {
        ...request,
        signature,
      });
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Bank Transfer payment
   */
  async createBankTransferPayment(request: {
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
  }): Promise<TripayPaymentResponse> {
    try {
      const signature = this.generateSignature(request.merchant_ref, request.amount);
      const response = await this.client.post('/transaction/create', {
        ...request,
        signature,
      });
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat E-Wallet payment
   */
  async createEwalletPayment(request: {
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
  }): Promise<TripayPaymentResponse> {
    try {
      const signature = this.generateSignature(request.merchant_ref, request.amount);
      const response = await this.client.post('/transaction/create', {
        ...request,
        signature,
      });
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Convenience Store payment
   */
  async createConvenienceStorePayment(request: {
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
  }): Promise<TripayPaymentResponse> {
    try {
      const signature = this.generateSignature(request.merchant_ref, request.amount);
      const response = await this.client.post('/transaction/create', {
        ...request,
        signature,
      });
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verifikasi webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Memproses webhook callback
   */
  async processWebhook(payload: any): Promise<{
    transactionId: string;
    status: string;
    amount: number;
    paidAt?: string;
  }> {
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
  async getAvailableBanks(): Promise<Array<{ code: string; name: string }>> {
    try {
      const channels = await this.getPaymentChannels();
      return channels
        .filter(channel => channel.group === 'Virtual Account' || channel.group === 'Bank Transfer')
        .map(channel => ({
          code: channel.code,
          name: channel.name,
        }));
    } catch (error) {
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
  async getAvailableEwallets(): Promise<Array<{ code: string; name: string }>> {
    try {
      const channels = await this.getPaymentChannels();
      return channels
        .filter(channel => channel.group === 'E-Wallet')
        .map(channel => ({
          code: channel.code,
          name: channel.name,
        }));
    } catch (error) {
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
  async getAvailableConvenienceStores(): Promise<Array<{ code: string; name: string }>> {
    try {
      const channels = await this.getPaymentChannels();
      return channels
        .filter(channel => channel.group === 'Convenience Store')
        .map(channel => ({
          code: channel.code,
          name: channel.name,
        }));
    } catch (error) {
      return [
        { code: 'ALFAMART', name: 'Alfamart' },
        { code: 'INDOMARET', name: 'Indomaret' },
      ];
    }
  }

  /**
   * Mendapatkan saldo merchant
   */
  async getMerchantBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const response = await this.client.get('/merchant/balance');
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Tripay API Error: ${error.response?.data?.message || error.message}`);
    }
  }
}
