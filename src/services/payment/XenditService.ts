import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

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

export class XenditService {
  private client: AxiosInstance;
  private config: XenditConfig;

  constructor(config: XenditConfig) {
    this.config = config;
    this.client = axios.create({
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
  async createInvoice(request: XenditPaymentRequest): Promise<XenditPaymentResponse> {
    try {
      const response = await this.client.post('/v2/invoices', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Mendapatkan detail invoice
   */
  async getInvoice(invoiceId: string): Promise<XenditPaymentResponse> {
    try {
      const response = await this.client.get(`/v2/invoices/${invoiceId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Virtual Account
   */
  async createVirtualAccount(request: {
    external_id: string;
    bank_code: string;
    name: string;
    virtual_account_number?: string;
    suggested_amount?: number;
    is_closed?: boolean;
    expected_amount?: number;
    expiration_date?: string;
    is_single_use?: boolean;
  }): Promise<XenditPaymentResponse> {
    try {
      const response = await this.client.post('/virtual_accounts', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat E-Wallet payment
   */
  async createEwalletPayment(request: {
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
  }): Promise<XenditPaymentResponse> {
    try {
      const response = await this.client.post('/ewallets', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Retail Outlet payment
   */
  async createRetailOutletPayment(request: {
    external_id: string;
    retail_outlet_name: 'ALFAMART' | 'INDOMARET';
    name: string;
    expected_amount: number;
    payment_code?: string;
    expiration_date?: string;
    is_single_use?: boolean;
  }): Promise<XenditPaymentResponse> {
    try {
      const response = await this.client.post('/retail_outlets', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Membuat Credit Card payment
   */
  async createCreditCardPayment(request: {
    token_id: string;
    external_id: string;
    amount: number;
    currency?: string;
    authentication_id?: string;
    card_cvn?: string;
    capture?: boolean;
    descriptor?: string;
  }): Promise<XenditPaymentResponse> {
    try {
      const response = await this.client.post('/credit_card_charges', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Xendit API Error: ${error.response?.data?.message || error.message}`);
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
      transactionId: payload.external_id,
      status: payload.status,
      amount: payload.amount,
      paidAt: payload.paid_at,
    };
  }

  /**
   * Mendapatkan daftar bank yang tersedia untuk Virtual Account
   */
  async getAvailableBanks(): Promise<Array<{ code: string; name: string }>> {
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
  async getAvailableEwallets(): Promise<Array<{ code: string; name: string }>> {
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
  async getAvailableRetailOutlets(): Promise<Array<{ code: string; name: string }>> {
    return [
      { code: 'ALFAMART', name: 'Alfamart' },
      { code: 'INDOMARET', name: 'Indomaret' },
    ];
  }
}
