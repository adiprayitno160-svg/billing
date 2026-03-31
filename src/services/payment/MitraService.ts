import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

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

export class MitraService {
  private client: AxiosInstance;
  private config: MitraConfig;

  constructor(config: MitraConfig) {
    this.config = config;
    this.client = axios.create({
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
  async createPayment(request: MitraPaymentRequest): Promise<MitraPaymentResponse> {
    try {
      const response = await this.client.post('/v1/payments', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Mendapatkan status payment
   */
  async getPaymentStatus(transactionId: string): Promise<MitraPaymentResponse> {
    try {
      const response = await this.client.get(`/v1/payments/${transactionId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Bank Transfer payment
   */
  async createBankTransferPayment(request: {
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
  }): Promise<MitraPaymentResponse> {
    try {
      const response = await this.client.post('/v1/payments/bank-transfer', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Virtual Account payment
   */
  async createVirtualAccountPayment(request: {
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
  }): Promise<MitraPaymentResponse> {
    try {
      const response = await this.client.post('/v1/payments/virtual-account', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat E-Wallet payment
   */
  async createEwalletPayment(request: {
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
  }): Promise<MitraPaymentResponse> {
    try {
      const response = await this.client.post('/v1/payments/ewallet', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
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
      transactionId: payload.order_id,
      status: payload.status,
      amount: payload.amount,
      paidAt: payload.paid_at,
    };
  }

  /**
   * Mendapatkan daftar bank yang tersedia
   */
  async getAvailableBanks(): Promise<Array<{ code: string; name: string }>> {
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
  async getAvailableEwallets(): Promise<Array<{ code: string; name: string }>> {
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
  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const response = await this.client.get('/v1/balance');
      return response.data;
    } catch (error: any) {
      throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Mendapatkan riwayat transaksi
   */
  async getTransactionHistory(params: {
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
  }> {
    try {
      const response = await this.client.get('/v1/transactions', { params });
      return response.data;
    } catch (error: any) {
      throw new Error(`Mitra API Error: ${error.response?.data?.message || error.message}`);
    }
  }
}
