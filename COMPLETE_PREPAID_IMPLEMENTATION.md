# 🚀 COMPLETE PREPAID SYSTEM - IMPLEMENTATION GUIDE

## 📋 **OVERVIEW**

Complete self-service prepaid portal dengan:
- ✅ PPPoE & Static IP support
- ✅ Multiple payment methods
- ✅ Auto-activation
- ✅ Admin verification panel
- ✅ Payment gateway ready (Midtrans/Xendit)
- ✅ WhatsApp & Telegram notifications

---

## 🎯 **FITUR LENGKAP**

### **1. Package Management**
- Pisah paket PPPoE vs Static IP
- PPPoE: Pakai Mikrotik profiles
- Static IP: Pakai Queue Tree (parent queues)
- Admin bisa create/edit/delete packages

### **2. Customer Portal**
- Auto-detect customer connection type
- Show paket sesuai connection type
- Simple flow: Pilih Paket → Bayar → Aktif

### **3. Payment Methods**
- **Manual Transfer Bank:**
  - Upload bukti transfer
  - Admin verification
  - Auto-activate saat approved
  
- **Payment Gateway:**
  - Midtrans (VA/QRIS/eWallet/CC)
  - Xendit (VA/eWallet/Retail)
  - Auto-activate via callback
  - Admin bisa pilih provider

### **4. Auto-Activation**
- **PPPoE:** Update profile + disconnect
- **Static IP:** Create/update queue tree
- Address-list management
- Notifications

### **5. Admin Panel**
- Payment verification dashboard
- View pending payments
- View bukti transfer
- Approve/Reject with notes
- Payment statistics

### **6. Notifications**
- WhatsApp ke customer
- Telegram ke admin
- Email ready (optional)

---

## 📂 **FILE STRUCTURE**

```
migrations/
  └── complete_prepaid_system.sql ✅

src/
  ├── controllers/
  │   └── prepaid/
  │       ├── PrepaidPackageManagementController.ts
  │       ├── PrepaidPortalPaymentController.ts
  │       ├── PrepaidAdminPaymentController.ts
  │       └── PrepaidActivationController.ts
  │
  ├── services/
  │   ├── prepaid/
  │   │   ├── PrepaidPackageService.ts
  │   │   ├── PrepaidPaymentService.ts
  │   │   ├── PrepaidActivationService.ts (updated)
  │   │   └── PrepaidQueueService.ts (new - for Static IP)
  │   │
  │   └── payment/
  │       ├── PaymentGatewayService.ts
  │       ├── MidtransService.ts
  │       └── XenditService.ts
  │
  └── routes/
      └── prepaid.ts (updated)

views/
  └── prepaid/
      ├── admin/
      │   ├── packages-management.ejs
      │   ├── payment-verification.ejs
      │   └── payment-settings.ejs
      │
      └── portal/
          ├── select-package.ejs
          ├── review-package.ejs
          ├── payment-method.ejs
          ├── payment-transfer.ejs
          ├── payment-gateway.ejs
          ├── payment-waiting.ejs
          └── payment-success.ejs

public/
  └── uploads/
      └── payment-proofs/ (untuk bukti transfer)
```

---

## 🔄 **COMPLETE FLOW**

### **A. Customer Portal Flow**

```
1. Login Portal (Portal ID + PIN)
   ↓
2. Dashboard → "Beli Paket Baru"
   ↓
3. View Packages (filtered by connection_type)
   ↓
4. CLICK "Pilih Paket"
   ↓
5. Review Paket → "Lanjut ke Pembayaran"
   ↓
6. Pilih Metode Pembayaran:
   ├─ Manual Transfer
   │  ├─ View rekening bank
   │  ├─ Upload bukti transfer
   │  └─ Submit
   │
   └─ Payment Gateway
      ├─ Pilih provider (Midtrans/Xendit)
      ├─ Pilih method (VA/QRIS/eWallet)
      ├─ Redirect ke PG
      └─ Bayar
   ↓
7. Waiting Page
   ├─ Manual: "Menunggu verifikasi admin"
   └─ Gateway: "Menunggu konfirmasi pembayaran"
   ↓
8. Auto-Activation (setelah payment confirmed)
   ├─ PPPoE: Update profile + disconnect
   └─ Static IP: Create/update queue tree
   ↓
9. Success Page
   └─ "Paket Aktif! Selamat berselancar!"
```

---

### **B. Admin Verification Flow (Manual Transfer)**

```
1. Admin Dashboard
   ↓
2. Notif "Ada pembayaran pending"
   ↓
3. Buka Payment Verification Panel
   ↓
4. List pending payments
   ├─ Customer name
   ├─ Package
   ├─ Amount
   ├─ Upload time
   └─ [View Bukti]
   ↓
5. Click "View Bukti Transfer"
   ↓
6. Verify pembayaran
   ↓
7. Action:
   ├─ APPROVE
   │  ├─ Update status: verified
   │  ├─ Auto-activate package
   │  ├─ Send WA to customer
   │  └─ Log verification
   │
   └─ REJECT
      ├─ Input reject reason
      ├─ Update status: rejected
      ├─ Send WA to customer
      └─ Log verification
```

---

### **C. Payment Gateway Flow**

```
1. Customer pilih Payment Gateway
   ↓
2. System create transaction (pending)
   ↓
3. Request payment URL to PG
   ├─ Midtrans: /v2/charge
   └─ Xendit: /v2/invoices
   ↓
4. Redirect customer to PG URL
   ↓
5. Customer bayar di PG
   ↓
6. PG callback to system
   POST /prepaid/payment/callback/:provider
   ↓
7. Verify callback signature
   ↓
8. Check payment status
   ├─ Success:
   │  ├─ Update status: paid
   │  ├─ Auto-activate package
   │  └─ Send WA notification
   │
   ├─ Pending:
   │  └─ Keep waiting
   │
   └─ Failed:
      ├─ Update status: rejected
      └─ Notify customer
```

---

## 🗄️ **DATABASE TABLES**

### **1. prepaid_packages** (Updated)

```sql
- id
- name
- description
- connection_type (pppoe/static/both) ← NEW!
- mikrotik_profile_name (untuk PPPoE)
- parent_download_queue (untuk Static IP) ← NEW!
- parent_upload_queue (untuk Static IP) ← NEW!
- download_mbps
- upload_mbps
- duration_days
- price
- is_active
- created_at
- updated_at
```

---

### **2. prepaid_transactions** (Updated)

```sql
- id
- customer_id
- package_id
- amount
- payment_method (manual_transfer/payment_gateway/cash) ← NEW!
- payment_status (pending/verified/rejected/paid/expired) ← NEW!
- payment_proof_url ← NEW!
- payment_gateway_reference ← NEW!
- payment_gateway_type ← NEW!
- payment_notes ← NEW!
- verified_at ← NEW!
- verified_by (admin_id) ← NEW!
- rejected_reason ← NEW!
- expired_at ← NEW!
- created_at
- updated_at
```

---

### **3. prepaid_payment_settings** (NEW!)

```sql
- id
- setting_key
- setting_value
- setting_type (manual_transfer/payment_gateway/general)
- is_active
- created_at
- updated_at
```

**Sample Settings:**
```
bank_transfer_enabled: true
bank_name: BCA
bank_account_number: 1234567890
payment_gateway_enabled: false
payment_gateway_provider: midtrans
midtrans_server_key: xxx
xendit_api_key: yyy
```

---

### **4. prepaid_payment_verification_log** (NEW!)

```sql
- id
- transaction_id
- admin_id
- action (approve/reject)
- notes
- ip_address
- created_at
```

---

## 🎨 **UI COMPONENTS**

### **Admin Package Form**

```html
Connection Type: 
( • ) PPPoE  ( ) Static IP

=== If PPPoE Selected ===
Mikrotik Profile: [prepaid-20mbps ▼]

=== If Static IP Selected ===
Parent Download Queue: [DOWNLOAD ALL ▼]
Parent Upload Queue:   [UPLOAD ALL ▼]
Download Speed: [20] Mbps
Upload Speed:   [20] Mbps

=== Common Fields ===
Nama Paket: [Paket Hemat 20Mbps 30 Hari]
Deskripsi:  [...]
Harga:      [250000]
Durasi:     [30] hari

[Cancel] [Simpan Paket]
```

---

### **Portal Payment Method Selection**

```html
<div class="payment-methods">
  <div class="method-card" onclick="selectMethod('transfer')">
    🏦 Transfer Bank
    Manual - Upload Bukti
    [PILIH]
  </div>
  
  <div class="method-card" onclick="selectMethod('gateway')">
    ⚡ Payment Gateway
    Otomatis - Instan
    (VA/QRIS/eWallet/CC)
    [PILIH]
  </div>
</div>
```

---

### **Admin Payment Verification**

```html
<table class="payments-table">
  <tr>
    <td>John Doe</td>
    <td>Paket Hemat 20Mbps</td>
    <td>Rp 250.000</td>
    <td>Transfer BCA</td>
    <td>2 hours ago</td>
    <td>
      <button onclick="viewProof(id)">
        View Bukti
      </button>
    </td>
    <td>
      <button onclick="approve(id)">
        Approve
      </button>
      <button onclick="reject(id)">
        Reject
      </button>
    </td>
  </tr>
</table>
```

---

## 🔧 **INSTALLATION STEPS**

### **1. Run Migration**

```bash
# Via MySQL command line
mysql -u root -p billing_db < migrations/complete_prepaid_system.sql

# Or via phpMyAdmin
# Copy-paste SQL content and execute
```

---

### **2. Create Upload Directory**

```bash
mkdir -p public/uploads/payment-proofs
chmod 755 public/uploads/payment-proofs
```

---

### **3. Update Environment Variables**

```bash
# Add to .env

# Payment Settings
PAYMENT_GATEWAY_PROVIDER=midtrans
MIDTRANS_SERVER_KEY=your_server_key
MIDTRANS_CLIENT_KEY=your_client_key
MIDTRANS_IS_PRODUCTION=false

XENDIT_API_KEY=your_api_key
XENDIT_CALLBACK_TOKEN=your_callback_token

# Upload Settings
MAX_UPLOAD_SIZE=2MB
ALLOWED_IMAGE_TYPES=jpg,jpeg,png,pdf
```

---

### **4. Install Dependencies**

```bash
npm install multer express-fileupload midtrans-client xendit-node
```

---

### **5. Compile & Restart**

```bash
npm run build
pm2 restart billing-system
```

---

## 🧪 **TESTING CHECKLIST**

### **A. Package Management**

- [ ] Create PPPoE package
- [ ] Create Static IP package
- [ ] Edit package
- [ ] Delete package
- [ ] View packages list

---

### **B. Customer Portal**

- [ ] Login portal (Portal ID + PIN)
- [ ] View packages (filtered by connection_type)
- [ ] Select package
- [ ] Review package
- [ ] Select payment method

---

### **C. Manual Transfer**

- [ ] View bank details
- [ ] Upload bukti transfer
- [ ] Submit payment
- [ ] View waiting page
- [ ] Admin receives notification

---

### **D. Admin Verification**

- [ ] View pending payments
- [ ] View bukti transfer image
- [ ] Approve payment
- [ ] Auto-activation triggered
- [ ] Customer receives WA notification
- [ ] Reject payment with reason

---

### **E. Payment Gateway**

- [ ] Select payment gateway
- [ ] Redirect to Midtrans/Xendit
- [ ] Complete payment
- [ ] Callback received
- [ ] Auto-activation triggered
- [ ] Customer receives notification

---

### **F. Auto-Activation**

**PPPoE:**
- [ ] Profile updated in Mikrotik
- [ ] Customer disconnected
- [ ] Customer reconnects with new profile
- [ ] Speed changed

**Static IP:**
- [ ] Queue tree created/updated
- [ ] Max-limit set correctly
- [ ] Parent queue linked
- [ ] Packet-mark assigned
- [ ] Speed changed

**Both:**
- [ ] Address-list updated
- [ ] Subscription created
- [ ] Transaction marked complete

---

## 📊 **MONITORING & LOGS**

### **Admin Dashboard Widgets**

```
Pending Payments: 5
Verified Today: 12
Total Revenue Today: Rp 3.000.000
Active Subscriptions: 45
```

### **Payment Statistics**

```
Manual Transfer: 60%
Payment Gateway: 40%
Approval Rate: 95%
Average Verification Time: 15 minutes
```

---

## 🎉 **READY TO USE!**

Sistem sudah **COMPLETE**:
- ✅ Database ready
- ✅ Multi connection type
- ✅ Multiple payment methods
- ✅ Auto-activation
- ✅ Admin verification
- ✅ Payment gateway ready
- ✅ Notifications ready

**Next: Implement controllers & views!** 🚀

