# 🚀 QUICK DEPLOY GUIDE - Complete Prepaid System

## ✅ **READY TO DEPLOY!**

Sistem prepaid lengkap dengan self-service portal sudah siap untuk production!

---

## 📦 **WHAT'S INCLUDED**

✅ **Database Layer** - Tables, views, stored procedures  
✅ **Services Layer** - Business logic (Queue, Package, Payment, Activation)  
✅ **Controllers Layer** - Request handlers (Admin & Portal)  
✅ **Routes** - API endpoints configured  
✅ **Views** - Complete UI (Admin & Customer portal)  
✅ **Auto-Activation** - Mikrotik integration (PPPoE & Static IP)  
✅ **Payment Flow** - Manual transfer with verification  
✅ **Payment Gateway** - Structure ready (Midtrans/Xendit)  

---

## 🚀 **DEPLOYMENT STEPS**

### **Step 1: Run Database Migration** ⚠️ CRITICAL!

```bash
# Login to MySQL
mysql -u root -p

# Select database
use billing_db;

# Run migration
source migrations/complete_prepaid_system.sql;

# Or if using phpMyAdmin:
# 1. Open billing_db
# 2. Click SQL tab
# 3. Copy content of migrations/complete_prepaid_system.sql
# 4. Click Go
```

**Verify Migration:**
```sql
-- Check if tables exist
SHOW TABLES LIKE 'prepaid%';

-- Should show:
-- prepaid_packages
-- prepaid_transactions  
-- prepaid_payment_settings
-- prepaid_payment_verification_log
-- (and other existing prepaid tables)

-- Check new columns
DESCRIBE prepaid_packages;
-- Should show: connection_type, parent_download_queue, parent_upload_queue

DESCRIBE prepaid_transactions;
-- Should show: payment_method, payment_status, payment_proof_url, etc.
```

---

### **Step 2: Create Upload Directory**

```bash
# Create directory for payment proofs
mkdir -p public/uploads/payment-proofs

# Set permissions (Linux/Mac)
chmod 755 public/uploads/payment-proofs

# Windows: No chmod needed, just ensure folder exists
```

---

### **Step 3: Install Dependencies**

```bash
# Install multer for file upload
npm install multer

# Install types (if using TypeScript)
npm install --save-dev @types/multer
```

---

### **Step 4: Compile TypeScript**

```bash
npm run build
```

**Expected output:**
```
> tsc

# Should complete without errors
# Check dist/ folder for compiled .js files
```

---

### **Step 5: Restart Server**

```bash
# Using PM2
pm2 restart billing-system

# Or restart all
pm2 restart all

# Check logs
pm2 logs billing-system --lines 50
```

---

### **Step 6: Configure Payment Settings**

```sql
-- Update bank account details
UPDATE prepaid_payment_settings 
SET setting_value = 'BCA' 
WHERE setting_key = 'bank_name';

UPDATE prepaid_payment_settings 
SET setting_value = '1234567890' 
WHERE setting_key = 'bank_account_number';

UPDATE prepaid_payment_settings 
SET setting_value = 'PT. ISP Indonesia' 
WHERE setting_key = 'bank_account_name';

-- Enable bank transfer
UPDATE prepaid_payment_settings 
SET setting_value = 'true' 
WHERE setting_key = 'bank_transfer_enabled';

-- Check settings
SELECT * FROM prepaid_payment_settings;
```

---

## 🧪 **TESTING GUIDE**

### **Test 1: Admin - Create PPPoE Package**

1. **Login as Admin**
   ```
   URL: http://localhost:3000/auth/login
   ```

2. **Navigate to Package Management**
   ```
   URL: http://localhost:3000/prepaid/packages
   ```

3. **Create Package**
   - Click "Buat Paket Baru"
   - Select "PPPoE"
   - Fill form:
     * Name: `Paket PPPoE 20Mbps 30 Hari`
     * Mikrotik Profile: `prepaid-20mbps`
     * Download: `20` Mbps
     * Upload: `20` Mbps
     * Duration: `30` days
     * Price: `250000`
     * Active: ✅ Yes
   - Click "Simpan Paket"

4. **Verify**
   - Package appears in list
   - Shows "PPPoE" badge
   - Shows profile name

---

### **Test 2: Admin - Create Static IP Package**

1. **Navigate to Package Management**
   ```
   URL: http://localhost:3000/prepaid/packages
   ```

2. **Create Package**
   - Click "Buat Paket Baru"
   - Select "Static IP"
   - Fill form:
     * Name: `Paket Static 50Mbps 30 Hari`
     * Parent Download Queue: `DOWNLOAD ALL`
     * Parent Upload Queue: `UPLOAD ALL`
     * Download: `50` Mbps
     * Upload: `50` Mbps
     * Duration: `30` days
     * Price: `500000`
     * Active: ✅ Yes
   - Click "Simpan Paket"

3. **Verify**
   - Package appears in list
   - Shows "Static IP" badge
   - Shows parent queue name

---

### **Test 3: Customer - Purchase Package (Manual Transfer)**

1. **Login to Portal**
   ```
   URL: http://localhost:3000/prepaid/portal/login
   Use customer Portal ID + PIN (created by admin)
   ```

2. **Select Package**
   ```
   URL: http://localhost:3000/prepaid/portal/packages
   ```
   - Should only see packages matching customer's connection type
   - Click "Pilih Paket" on desired package

3. **Review Package**
   - Check package details
   - Click "Lanjut ke Pembayaran"

4. **Select Payment Method**
   - Choose "Transfer Bank"
   - View bank details

5. **Upload Proof** (Simulated)
   ```
   // For testing, you can:
   // 1. Use browser's file upload
   // 2. Select any image file
   // 3. Add notes (optional)
   // 4. Submit
   ```

6. **Waiting Page**
   - Should show "Menunggu Verifikasi"
   - Page auto-refreshes every 10 seconds

---

### **Test 4: Admin - Verify Payment**

1. **Navigate to Payment Verification**
   ```
   URL: http://localhost:3000/prepaid/payment-verification
   ```

2. **View Pending Payments**
   - Should see customer's payment in list
   - Click "Lihat Bukti" to view proof image

3. **Approve Payment**
   - Click "Approve" button
   - Wait for processing (5-10 seconds)
   - Should show success message

4. **Verify Activation**
   - Check Mikrotik configuration:
     ```
     # For PPPoE
     /ppp secret print where name="customer-username"
     # Should show new profile

     # For Static IP
     /queue tree print where name~"CustomerName"
     # Should show new queue tree
     
     /ip firewall address-list print where list="prepaid-active"
     # Should show customer IP
     ```

5. **Customer Auto-Redirected**
   - Customer's waiting page should auto-redirect to success page
   - Shows confetti animation 🎉

---

### **Test 5: Verify Customer Dashboard**

1. **Login as Customer**
   ```
   URL: http://localhost:3000/prepaid/portal/dashboard
   ```

2. **Check Subscription Status**
   - Should show active package
   - Shows expiry date
   - Shows remaining days

---

## 🎯 **ADMIN URLS**

```
Packages Management:
http://localhost:3000/prepaid/packages

Create Package:
http://localhost:3000/prepaid/packages/create

Payment Verification:
http://localhost:3000/prepaid/payment-verification

Mikrotik Setup:
http://localhost:3000/prepaid/mikrotik-setup

Speed Profiles:
http://localhost:3000/prepaid/speed-profiles

Address List:
http://localhost:3000/prepaid/address-list
```

---

## 🌐 **CUSTOMER PORTAL URLS**

```
Login:
http://localhost:3000/prepaid/portal/login

Splash Page (for redirect):
http://localhost:3000/prepaid/portal/splash

Dashboard:
http://localhost:3000/prepaid/portal/dashboard

Select Package:
http://localhost:3000/prepaid/portal/packages
```

---

## 📊 **DATABASE QUERIES FOR MONITORING**

```sql
-- Check active subscriptions
SELECT 
  c.name,
  pp.name as package_name,
  pps.activation_date,
  pps.expiry_date,
  DATEDIFF(pps.expiry_date, NOW()) as days_remaining
FROM prepaid_package_subscriptions pps
INNER JOIN customers c ON pps.customer_id = c.id
INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
WHERE pps.status = 'active';

-- Check pending payments
SELECT * FROM v_prepaid_pending_payments;

-- Check payment statistics (today)
SELECT * FROM v_prepaid_payment_stats 
WHERE payment_date = CURDATE();

-- Check all packages
SELECT 
  name,
  connection_type,
  CONCAT(download_mbps, '/', upload_mbps, ' Mbps') as speed,
  duration_days,
  price,
  is_active
FROM prepaid_packages
ORDER BY connection_type, price;
```

---

## 🔧 **TROUBLESHOOTING**

### **Problem: Package form not showing parent queues**

**Solution:**
```
1. Check Mikrotik connection
2. Run Mikrotik Setup Wizard first
3. Create parent queues manually if needed:
   /queue tree add name="DOWNLOAD ALL" parent=global
   /queue tree add name="UPLOAD ALL" parent=global
```

---

### **Problem: Upload folder permission denied**

**Solution:**
```bash
# Linux/Mac
sudo chmod -R 755 public/uploads/payment-proofs
sudo chown -R www-data:www-data public/uploads/payment-proofs

# Or your user
sudo chown -R $USER:$USER public/uploads/payment-proofs
```

---

### **Problem: Compilation errors**

**Solution:**
```bash
# Clean build
rm -rf dist/
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

---

### **Problem: Migration fails**

**Solution:**
```sql
-- Check if columns already exist
SHOW COLUMNS FROM prepaid_packages;

-- If columns exist, migration might have already run
-- Check prepaid_payment_settings table
SELECT COUNT(*) FROM prepaid_payment_settings;
-- Should return > 0 if migration ran successfully
```

---

## 📱 **OPTIONAL: Payment Gateway Integration**

**Structure sudah ready!** Tinggal tambahkan API keys:

### **Midtrans:**
```sql
UPDATE prepaid_payment_settings SET setting_value = 'true' WHERE setting_key = 'payment_gateway_enabled';
UPDATE prepaid_payment_settings SET setting_value = 'midtrans' WHERE setting_key = 'payment_gateway_provider';
UPDATE prepaid_payment_settings SET setting_value = 'YOUR_SERVER_KEY' WHERE setting_key = 'midtrans_server_key';
UPDATE prepaid_payment_settings SET setting_value = 'YOUR_CLIENT_KEY' WHERE setting_key = 'midtrans_client_key';
```

### **Xendit:**
```sql
UPDATE prepaid_payment_settings SET setting_value = 'true' WHERE setting_key = 'payment_gateway_enabled';
UPDATE prepaid_payment_settings SET setting_value = 'xendit' WHERE setting_key = 'payment_gateway_provider';
UPDATE prepaid_payment_settings SET setting_value = 'YOUR_API_KEY' WHERE setting_key = 'xendit_api_key';
```

---

## 📧 **OPTIONAL: Notifications**

**Structure ready!** Tinggal integrate dengan:
- WhatsApp Business API
- Telegram Bot API
- Email (SMTP)

---

## ✅ **SYSTEM CHECKLIST**

Before going to production:

- [ ] Migration completed successfully
- [ ] Upload directory created & writable
- [ ] Dependencies installed (multer)
- [ ] TypeScript compiled without errors
- [ ] Server restarted
- [ ] Payment settings configured
- [ ] Mikrotik connection working
- [ ] PPPoE profiles exist (if using PPPoE)
- [ ] Parent queues exist (if using Static IP)
- [ ] Test package creation (PPPoE & Static IP)
- [ ] Test customer purchase flow
- [ ] Test admin payment verification
- [ ] Test auto-activation (check Mikrotik)

---

## 🎉 **READY FOR PRODUCTION!**

**Sistem sudah COMPLETE dan siap digunakan!**

Features yang sudah jalan:
- ✅ Multi connection type (PPPoE & Static IP)
- ✅ Self-service portal
- ✅ Manual transfer payment
- ✅ Upload bukti transfer
- ✅ Admin verification panel
- ✅ Auto-activation (Mikrotik)
- ✅ Queue tree management (Static IP)
- ✅ PPPoE profile management
- ✅ Address-list management
- ✅ Payment statistics
- ✅ Audit logging

**Optional (dapat diaktifkan nanti):**
- ⚠️ Payment gateway (Midtrans/Xendit)
- ⚠️ WhatsApp notifications
- ⚠️ Telegram notifications

---

## 📞 **SUPPORT**

Jika ada masalah saat deployment:
1. Check PM2 logs: `pm2 logs billing-system`
2. Check MySQL errors: `SHOW ERRORS;`
3. Check browser console (F12)
4. Verify Mikrotik connection

**Good luck! 🚀**

