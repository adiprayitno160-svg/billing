# 💳 Payment Gateway Integration

Panduan lengkap integrasi payment gateway dengan Billing System.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Supported Payment Gateways](#-supported-payment-gateways)
- [Midtrans Setup](#-midtrans-setup)
- [Xendit Setup](#-xendit-setup)
- [Tripay Setup](#-tripay-setup)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)

---

## 🌟 Overview

Billing System mendukung multiple payment gateway untuk mempermudah pembayaran customer:

### Payment Methods Available

| Method | Midtrans | Xendit | Tripay |
|--------|----------|--------|--------|
| **Bank Transfer** | ✅ | ✅ | ✅ |
| **E-Wallet** | ✅ | ✅ | ✅ |
| **Credit Card** | ✅ | ✅ | ✅ |
| **QRIS** | ✅ | ✅ | ✅ |
| **Virtual Account** | ✅ | ✅ | ✅ |
| **Convenience Store** | ✅ | ❌ | ✅ |

---

## 💰 Supported Payment Gateways

### 1. Midtrans

**Website:** https://midtrans.com

**Features:**
- ✅ Most popular in Indonesia
- ✅ Low transaction fee (1.8% + Rp2,000)
- ✅ Multiple payment methods
- ✅ Easy integration
- ✅ Good documentation

**Best For:**
- Small to medium ISP
- Need variety of payment methods
- Budget-friendly

### 2. Xendit

**Website:** https://xendit.co

**Features:**
- ✅ Simple API
- ✅ Good customer support
- ✅ Fast disbursement
- ✅ Modern dashboard

**Best For:**
- Modern payment flow
- Need fast settlements
- International payment

### 3. Tripay

**Website:** https://tripay.co.id

**Features:**
- ✅ Focus on Indonesia market
- ✅ Many payment channels
- ✅ Competitive pricing
- ✅ Good for gaming/digital products

**Best For:**
- Digital products
- Need many local payment channels
- Gaming/entertainment

---

## 🔧 Midtrans Setup

### Step 1: Create Midtrans Account

1. **Register**
   - Visit: https://dashboard.midtrans.com/register
   - Fill form dan verify email
   - Complete business information

2. **Get API Keys**
   - Login to dashboard
   - Go to Settings → Access Keys
   - Copy:
     - **Server Key**
     - **Client Key**

### Step 2: Configure Billing System

Edit `.env`:

```env
# Midtrans Configuration
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false

# Callback URL (akan di-set otomatis)
MIDTRANS_CALLBACK_URL=https://yourdomain.com/api/payment/midtrans/callback
```

**Note:** 
- `SB-` prefix = Sandbox (testing)
- Remove `SB-` prefix untuk production

### Step 3: Setup Webhook/Callback

**Di Midtrans Dashboard:**
```
1. Settings → Configuration
2. Payment Notification URL:
   https://yourdomain.com/api/payment/midtrans/callback
3. Finish Redirect URL:
   https://yourdomain.com/payment/success
4. Error Redirect URL:
   https://yourdomain.com/payment/failed
5. Save
```

### Step 4: Enable Payment Methods

**Di Midtrans Dashboard:**
```
1. Settings → Configuration
2. Enable payment methods:
   ✅ Credit Card
   ✅ Bank Transfer (BCA, BNI, BRI, Permata, Mandiri)
   ✅ E-Wallet (GoPay, ShopeePay, Dana)
   ✅ QRIS
   ✅ Convenience Store (Alfamart, Indomaret)
3. Save
```

### Step 5: Test Integration

**Test dengan Sandbox:**
```javascript
// Billing system akan create transaction
POST /api/payment/create
{
  "invoice_id": 123,
  "payment_method": "midtrans",
  "amount": 150000
}

// Response:
{
  "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/..."
}
```

**Test Cards (Sandbox):**
```
# Success
Card: 4811 1111 1111 1114
CVV: 123
Exp: 01/25

# Failed
Card: 4911 1111 1111 1113
CVV: 123
Exp: 01/25
```

**Test VA Numbers:**
```
BCA VA:  Pay with any amount
BNI VA:  Pay with any amount
Mandiri: Use bill key + company code
```

---

## 🚀 Xendit Setup

### Step 1: Create Xendit Account

1. **Register**
   - Visit: https://dashboard.xendit.co/register
   - Fill form
   - Verify email & phone
   - Submit documents

2. **Get API Key**
   - Login to dashboard
   - Go to Settings → Developers → API Keys
   - Copy **Secret Key**

### Step 2: Configure Billing System

Edit `.env`:

```env
# Xendit Configuration
XENDIT_API_KEY=xnd_development_xxxxxxxxxxxxxxxxxxxxx

# Callback URL
XENDIT_CALLBACK_URL=https://yourdomain.com/api/payment/xendit/callback
```

### Step 3: Setup Webhook

**Di Xendit Dashboard:**
```
1. Settings → Webhooks
2. Create Webhook:
   - Environment: Development/Production
   - Webhook URL: https://yourdomain.com/api/payment/xendit/callback
   - Events:
     ✅ invoice.paid
     ✅ invoice.expired
     ✅ virtual_account.paid
     ✅ qr_code.paid
3. Save
4. Copy Webhook Verification Token
```

**Update .env:**
```env
XENDIT_WEBHOOK_TOKEN=your_webhook_verification_token
```

### Step 4: Test Integration

**Create Invoice:**
```javascript
POST /api/payment/create
{
  "invoice_id": 123,
  "payment_method": "xendit",
  "amount": 150000
}

// Response:
{
  "invoice_id": "123",
  "invoice_url": "https://checkout.xendit.co/web/...",
  "expiry_date": "2025-01-27T10:00:00.000Z"
}
```

**Test Payment:**
1. Open invoice URL
2. Select payment method
3. Complete payment (use test credentials)
4. Webhook akan callback ke system
5. Invoice status update otomatis

---

## 💎 Tripay Setup

### Step 1: Create Tripay Account

1. **Register**
   - Visit: https://tripay.co.id/register
   - Fill form
   - Verify email

2. **Get API Credentials**
   - Login to dashboard
   - Go to API → Settings
   - Copy:
     - **API Key**
     - **Private Key**
     - **Merchant Code**

### Step 2: Configure Billing System

Edit `.env`:

```env
# Tripay Configuration
TRIPAY_API_KEY=your_api_key
TRIPAY_PRIVATE_KEY=your_private_key
TRIPAY_MERCHANT_CODE=T1234

# Environment
TRIPAY_IS_PRODUCTION=false

# Callback URL
TRIPAY_CALLBACK_URL=https://yourdomain.com/api/payment/tripay/callback
```

### Step 3: Setup Callback URL

**Di Tripay Dashboard:**
```
1. Settings → Callback URL
2. Set: https://yourdomain.com/api/payment/tripay/callback
3. Test Callback
4. Save
```

### Step 4: Enable Payment Channels

**Di Tripay Dashboard:**
```
1. Settings → Payment Channels
2. Enable channels:
   ✅ QRIS (All E-Wallet)
   ✅ Virtual Account (BCA, BNI, BRI, Mandiri, dll)
   ✅ Convenience Store (Alfamart, Indomaret)
   ✅ Bank Transfer
3. Save
```

### Step 5: Test Integration

**Create Transaction:**
```javascript
POST /api/payment/create
{
  "invoice_id": 123,
  "payment_method": "tripay",
  "channel": "BRIVA",  // BRI Virtual Account
  "amount": 150000
}

// Response:
{
  "reference": "T1234567890",
  "merchant_ref": "INV-123",
  "payment_method": "BRIVA",
  "pay_code": "12345678901234",
  "checkout_url": "https://tripay.co.id/checkout/T1234567890",
  "qr_url": "https://tripay.co.id/qr/...",
  "expired_time": "2025-01-26 23:59:59"
}
```

---

## 🧪 Testing

### Test Mode vs Production

| Gateway | Test Mode | Production |
|---------|-----------|------------|
| **Midtrans** | Prefix `SB-` | Remove `SB-` |
| **Xendit** | Key starts `xnd_development_` | Key starts `xnd_production_` |
| **Tripay** | `.env`: `TRIPAY_IS_PRODUCTION=false` | `=true` |

### Test Payment Flow

1. **Create Invoice**
   ```bash
   # Login as admin
   # Create invoice for customer
   # Amount: Rp 150,000
   ```

2. **Customer Payment**
   ```bash
   # Customer login
   # View invoice
   # Click "Pay Now"
   # Select payment method (Midtrans/Xendit/Tripay)
   # Select channel (VA/E-Wallet/QRIS/etc)
   ```

3. **Complete Payment**
   ```bash
   # Use test credentials
   # Complete payment
   # Wait for callback
   ```

4. **Verify**
   ```bash
   # Check invoice status changed to "Paid"
   # Check payment record created
   # Check customer unblocked (if was isolated)
   # Check notification sent
   ```

### Test Callbacks Manually

**Simulate Midtrans Callback:**
```bash
curl -X POST https://yourdomain.com/api/payment/midtrans/callback \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_status": "settlement",
    "order_id": "INV-123",
    "gross_amount": "150000.00",
    "payment_type": "bank_transfer",
    "signature_key": "..."
  }'
```

**Simulate Xendit Callback:**
```bash
curl -X POST https://yourdomain.com/api/payment/xendit/callback \
  -H "Content-Type: application/json" \
  -H "x-callback-token: your_webhook_token" \
  -d '{
    "id": "123",
    "external_id": "INV-123",
    "status": "PAID",
    "amount": 150000
  }'
```

**Simulate Tripay Callback:**
```bash
curl -X POST https://yourdomain.com/api/payment/tripay/callback \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "T1234567890",
    "merchant_ref": "INV-123",
    "status": "PAID",
    "amount": 150000
  }'
```

---

## 🐛 Troubleshooting

### Payment Gateway Not Available

**Problem:** Payment method tidak muncul di halaman pembayaran

**Solutions:**
```bash
# 1. Check .env configuration
cat .env | grep MIDTRANS
cat .env | grep XENDIT
cat .env | grep TRIPAY

# 2. Check API keys valid
# Test via Postman atau curl

# 3. Restart application
pm2 restart billing-system

# 4. Check logs
pm2 logs billing-system | grep payment
```

### Callback Not Received

**Problem:** Payment sukses tapi invoice tidak update

**Solutions:**
```bash
# 1. Check callback URL accessible from internet
curl https://yourdomain.com/api/payment/midtrans/callback

# 2. Check nginx configuration
sudo nginx -t

# 3. Check firewall
sudo ufw status

# 4. Check payment gateway webhook settings

# 5. Test callback manually (see Testing section)

# 6. Check application logs
pm2 logs billing-system --lines 100 | grep callback
```

### Signature Verification Failed

**Problem:** Callback rejected karena signature invalid

**Solutions:**
```bash
# 1. Check API keys correct (Server Key, Private Key)

# 2. Check request body not modified by proxy/firewall

# 3. Midtrans: Verify signature algorithm
# Hash: SHA512(order_id + status_code + gross_amount + server_key)

# 4. Check system time synchronized
sudo ntpdate -s time.nist.gov

# 5. Check logs for detailed error
pm2 logs billing-system | grep signature
```

### Payment Timeout

**Problem:** Payment process timeout

**Solutions:**
```bash
# 1. Check network connectivity to payment gateway
ping api.midtrans.com
ping api.xendit.co
ping tripay.co.id

# 2. Check timeout settings in code
# Increase timeout if needed

# 3. Check payment gateway status page
# Midtrans: https://status.midtrans.com
# Xendit: https://status.xendit.co

# 4. Retry failed payment
```

### Amount Mismatch

**Problem:** Amount di payment gateway berbeda dengan invoice

**Solutions:**
```bash
# 1. Check invoice amount calculation

# 2. Check currency (IDR)

# 3. Check rounding (no decimal for IDR)

# 4. Check admin fee if any

# 5. Check logs
pm2 logs billing-system | grep amount
```

---

## 🔒 Security Best Practices

### 1. Verify Callback Signature

Always verify callback signature before processing:

```javascript
// Midtrans
const crypto = require('crypto');
const signatureKey = orderId + statusCode + grossAmount + serverKey;
const signature = crypto.createHash('sha512').update(signatureKey).digest('hex');

if (signature !== receivedSignature) {
  throw new Error('Invalid signature');
}
```

### 2. Use HTTPS

```nginx
# Force HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

### 3. Validate Callback Source

```javascript
// Check callback IP from whitelist
const allowedIPs = [
  '103.127.16.0/22',  // Midtrans
  '52.77.15.129',     // Xendit
  // Add payment gateway IPs
];
```

### 4. Log All Transactions

```javascript
// Log every payment attempt
logger.info('Payment callback received', {
  gateway: 'midtrans',
  order_id: orderId,
  amount: amount,
  status: status,
  ip: req.ip
});
```

### 5. Rate Limiting

```javascript
// Limit callback requests
const rateLimit = require('express-rate-limit');

const callbackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // max 100 requests per minute
});

app.post('/api/payment/*/callback', callbackLimiter, ...);
```

---

## 💰 Fee Comparison

### Transaction Fees (Indicative)

| Method | Midtrans | Xendit | Tripay |
|--------|----------|--------|--------|
| **Credit Card** | 2.9% + Rp2k | 2.9% + Rp2k | 3.0% |
| **Bank Transfer** | Rp4,000 | Rp4,000 | Rp3,500 |
| **VA (BCA)** | Rp4,000 | Rp4,000 | Rp3,500 |
| **VA (Other Banks)** | Rp4,000 | Rp4,000 | Rp3,500 |
| **GoPay** | 2% | 2% | 2% |
| **OVO** | 2% | 2% | 2% |
| **QRIS** | 0.7% | 0.7% | 0.7% |
| **Alfamart/Indomaret** | 2.5% | 2.5% | 2.5% |

*Fees may change, check with each provider*

### Monthly Fee

| Gateway | Monthly Fee | Notes |
|---------|-------------|-------|
| Midtrans | Free | Pay-as-you-go |
| Xendit | Free | Pay-as-you-go |
| Tripay | Free | Pay-as-you-go |

---

## 📊 Best Practices

### 1. Use Multiple Gateways

Enable 2-3 payment gateways untuk:
- Backup jika satu gateway down
- Provide more payment options
- Compare fees

### 2. Set Proper Expiry Time

```env
# Invoice expiry (hours)
PAYMENT_EXPIRY_TIME=24

# Recommended:
# - Bank Transfer: 24 hours
# - E-Wallet: 1 hour
# - QRIS: 30 minutes
```

### 3. Auto Retry Failed Payments

```javascript
// Implement retry logic
if (paymentFailed && retryCount < 3) {
  setTimeout(() => {
    retryPayment();
  }, 5000); // Retry after 5 seconds
}
```

### 4. Send Payment Instructions

```javascript
// After creating payment, send:
// - SMS with VA number
// - Email with payment link
// - WhatsApp with QR code
```

### 5. Monitor Payment Status

```javascript
// Cron job every 5 minutes
// Check pending payments
// Update status if paid
// Send reminder if near expiry
```

---

## 📚 API Documentation

### Create Payment

```javascript
POST /api/payment/create
Content-Type: application/json

{
  "invoice_id": 123,
  "payment_method": "midtrans", // or "xendit", "tripay"
  "channel": "gopay", // optional, specific channel
  "customer_email": "customer@example.com",
  "customer_phone": "08123456789"
}

Response:
{
  "success": true,
  "data": {
    "payment_id": "PAY-123",
    "redirect_url": "https://...",
    "payment_code": "1234567890", // for VA
    "qr_code": "https://...", // for QRIS
    "expired_at": "2025-01-27 10:00:00"
  }
}
```

### Check Payment Status

```javascript
GET /api/payment/status/:invoice_id

Response:
{
  "success": true,
  "data": {
    "invoice_id": 123,
    "payment_status": "pending", // pending, paid, expired, failed
    "payment_method": "midtrans",
    "payment_date": null,
    "amount": 150000
  }
}
```

---

## 📞 Support

### Payment Gateway Support

**Midtrans:**
- 📧 support@midtrans.com
- 💬 Live Chat: https://midtrans.com
- 📖 Docs: https://docs.midtrans.com

**Xendit:**
- 📧 support@xendit.co
- 💬 Live Chat: https://dashboard.xendit.co
- 📖 Docs: https://developers.xendit.co

**Tripay:**
- 📧 support@tripay.co.id
- 💬 WhatsApp: Check dashboard
- 📖 Docs: https://tripay.co.id/developer

---

**Last Updated**: January 26, 2025  
**Version**: 1.0.0

[← Back to Documentation](../README_INSTALLATION.md)

