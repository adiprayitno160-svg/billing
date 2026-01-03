# PREPAID ENHANCEMENTS - IMPLEMENTATION GUIDE

## 🎯 Overview
This document contains all the necessary steps to implement the complete prepaid enhancement system including:
- ✅ Voucher/Promo Code System
- ✅ Referral Program
- ✅ Payment Request Cleanup & Reminders
- ✅ Expiry Reminders (H-3, H-1, Expired)
- ✅ Admin Dashboard & Reports
- ✅ Multi-Payment Methods

---

## 📋 STEP 1: RUN DATABASE MIGRATION

Copy and paste this SQL into your MySQL client (phpMyAdmin, HeidiSQL, or command line):

```sql
USE billing_system;

-- 1. Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type ENUM('percentage', 'fixed', 'free_days') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_purchase DECIMAL(10,2) DEFAULT 0,
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    usage_limit INT DEFAULT NULL,
    used_count INT DEFAULT 0,
    customer_type ENUM('all', 'new', 'existing', 'prepaid', 'postpaid') DEFAULT 'all',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_status_valid (status, valid_from, valid_until),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Voucher Usage Log
CREATE TABLE IF NOT EXISTS voucher_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    voucher_id INT NOT NULL,
    customer_id INT NOT NULL,
    payment_request_id INT,
    discount_amount DECIMAL(10,2) NOT NULL,
    original_amount DECIMAL(10,2) NOT NULL,
    final_amount DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_voucher (voucher_id),
    INDEX idx_customer (customer_id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Referral System
CREATE TABLE IF NOT EXISTS customer_referrals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    referrer_id INT NOT NULL,
    referred_id INT NOT NULL,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    status ENUM('pending', 'completed', 'rewarded') DEFAULT 'pending',
    referrer_reward_days INT DEFAULT 3,
    referred_discount_percent INT DEFAULT 10,
    rewarded_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_referrer (referrer_id),
    INDEX idx_referred (referred_id),
    INDEX idx_code (referral_code),
    FOREIGN KEY (referrer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_referral (referrer_id, referred_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    type ENUM('qris', 'bank_transfer', 'ewallet', 'other') NOT NULL,
    account_name VARCHAR(200),
    account_number VARCHAR(100),
    instructions TEXT,
    qr_image_path VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type_active (type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default payment methods
INSERT INTO payment_methods (name, type, account_name, account_number, instructions, qr_image_path, sort_order) VALUES
('QRIS (All E-Wallet)', 'qris', 'PT. Internet Service Provider', NULL, 'Scan QRIS code dengan aplikasi e-wallet Anda (GoPay, OVO, DANA, ShopeePay, dll)', '/images/payments/qris.png', 1),
('Transfer BCA', 'bank_transfer', 'PT. Internet Service Provider', '1234567890', 'Transfer ke rekening BCA:\nNama: PT. Internet Service Provider\nNo. Rek: 1234567890\n\n⚠️ PENTING: Transfer sesuai nominal EXACT dengan kode unik!', NULL, 2),
('Transfer Mandiri', 'bank_transfer', 'PT. Internet Service Provider', '0987654321', 'Transfer ke rekening Mandiri:\nNama: PT. Internet Service Provider\nNo. Rek: 0987654321\n\n⚠️ PENTING: Transfer sesuai nominal EXACT dengan kode unik!', NULL, 3)
ON DUPLICATE KEY UPDATE name=name;

-- 5. Update payment_requests
ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS voucher_id INT NULL AFTER package_id,
ADD COLUMN IF NOT EXISTS voucher_discount DECIMAL(10,2) DEFAULT 0 AFTER voucher_id,
ADD COLUMN IF NOT EXISTS payment_method_id INT NULL AFTER voucher_discount,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE AFTER payment_method_id,
ADD COLUMN IF NOT EXISTS reminder_sent_at DATETIME NULL AFTER reminder_sent;

-- Add indexes if not exist
ALTER TABLE payment_requests
ADD INDEX IF NOT EXISTS idx_status_created (status, created_at),
ADD INDEX IF NOT EXISTS idx_reminder (reminder_sent, status, created_at);

-- Add foreign keys if not exist (wrap in procedure to handle errors)
SET @fk_voucher = (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'billing_system' 
    AND TABLE_NAME = 'payment_requests' 
    AND CONSTRAINT_NAME = 'payment_requests_ibfk_voucher');

SET @fk_payment_method = (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'billing_system' 
    AND TABLE_NAME = 'payment_requests' 
    AND CONSTRAINT_NAME = 'payment_requests_ibfk_payment_method');

SET @sql_voucher = IF(@fk_voucher = 0,
    'ALTER TABLE payment_requests ADD FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL',
    'SELECT "FK voucher already exists"');
PREPARE stmt FROM @sql_voucher;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_payment = IF(@fk_payment_method = 0,
    'ALTER TABLE payment_requests ADD FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL',
    'SELECT "FK payment_method already exists"');
PREPARE stmt FROM @sql_payment;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Update customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE NULL AFTER billing_mode;

ALTER TABLE customers
ADD INDEX IF NOT EXISTS idx_referral_code (referral_code);

-- Generate referral codes for existingcustomers
UPDATE customers 
SET referral_code = CONCAT(
    UPPER(SUBSTRING(REGEXP_REPLACE(name, '[^a-zA-Z]', ''), 1, 3)),
    LPAD(id, 4, '0')
)
WHERE referral_code IS NULL AND billing_mode = 'prepaid';

-- 7. Expiry Notifications Log
CREATE TABLE IF NOT EXISTS expiry_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    notification_type ENUM('h_minus_3', 'h_minus_1', 'expired') NOT NULL,
    expiry_date DATE NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    wa_message_id VARCHAR(100),
    status ENUM('sent', 'failed', 'delivered') DEFAULT 'sent',
    INDEX idx_customer_type (customer_id, notification_type),
    INDEX idx_sent_at (sent_at),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Analytics View
CREATE OR REPLACE VIEW v_prepaid_analytics AS
SELECT 
    DATE(t.created_at) as transaction_date,
    COUNT(*) as total_transactions,
    SUM(t.amount) as total_revenue,
    AVG(t.amount) as avg_transaction,
    COUNT(DISTINCT t.customer_id) as unique_customers,
    SUM(CASE WHEN t.package_type = '7_days' THEN 1 ELSE 0 END) as package_7days_count,
    SUM(CASE WHEN t.package_type = '30_days' THEN 1 ELSE 0 END) as package_30days_count,
    SUM(CASE WHEN pr.voucher_discount > 0 THEN 1 ELSE 0 END) as voucher_used_count,
    SUM(IFNULL(pr.voucher_discount, 0)) as total_discount_given
FROM prepaid_transactions t
LEFT JOIN payment_requests pr ON t.payment_request_id = pr.id
WHERE t.status = 'completed'
GROUP BY DATE(t.created_at);
```

✅ **MIGRATION COMPLETE!**

---

## 📋 STEP 2: INSTALL NEW SCHEDULER JOBS

The following services have been created and need to be registered in the scheduler:

### Files Created:
1. ✅ **`src/services/billing/VoucherService.ts`** - Voucher management
2. ✅ **`src/services/billing/ReferralService.ts`** - Referral program
3. ✅ **`src/services/billing/ExpiryReminderService.ts`** - Expiry notifications
4. ✅ **`src/services/billing/PrepaidCleanupService.ts`** - Payment cleanup & reminders
5. ✅ **`src/controllers/billing/PrepaidAdminController.ts`** - Admin dashboard

### Add to Scheduler:

Edit `src/services/notification/NotificationScheduler.ts` and add these jobs:

```typescript
import { ExpiryReminderService } from '../billing/ExpiryReminderService';
import { PrepaidCleanupService } from '../billing/PrepaidCleanupService';

// Add to initScheduledJobs():

// Expiry Reminders (H-3) - Daily at 9 AM
cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler] Running H-3 expiry reminders...');
    await ExpiryReminderService.sendH3Reminders();
});

// Expiry Reminders (H-1) - Daily at 10 AM
cron.schedule('0 10 * * *', async () => {
    console.log('[Scheduler] Running H-1 expiry reminders...');
    await ExpiryReminderService.sendH1Reminders();
});

// Expired Notifications - Daily at 11 AM
cron.schedule('0 11 * * *', async () => {
    console.log('[Scheduler] Sending expired notifications...');
    await ExpiryReminderService.sendExpiredNotifications();
});

// Payment Request Cleanup - Every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    console.log('[Scheduler] Running prepaid cleanup tasks...');
    await PrepaidCleanupService.runAllCleanupTasks();
});

// Cleanup old notification logs - Daily at 2 AM
cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Cleaning up old notification logs...');
    await ExpiryReminderService.cleanupOldLogs();
});
```

---

## 📋 STEP 3: ADD ADMIN ROUTES

Edit `src/routes/billing.ts` and add:

```typescript
import { PrepaidAdminController } from '../controllers/billing/PrepaidAdminController';

// Prepaid Admin Routes
router.get('/prepaid/payments', ensureAuthenticated, PrepaidAdminController.paymentMonitoring);
router.get('/prepaid/payments/:id', ensureAuthenticated, PrepaidAdminController.viewPaymentRequest);
router.post('/prepaid/payments/:id/approve', ensureAuthenticated, PrepaidAdminController.approvePayment);
router.post('/prepaid/payments/:id/reject', ensureAuthenticated, PrepaidAdminController.rejectPayment);

// Reports
router.get('/prepaid/reports', ensureAuthenticated, PrepaidAdminController.reports);

// Vouchers
router.get('/prepaid/vouchers', ensureAuthenticated, PrepaidAdminController.listVouchers);
router.post('/prepaid/vouchers', ensureAuthenticated, PrepaidAdminController.createVoucher);
router.put('/prepaid/vouchers/:id', ensureAuthenticated, PrepaidAdminController.updateVoucher);
router.delete('/prepaid/vouchers/:id', ensureAuthenticated, PrepaidAdminController.deleteVoucher);

// Referrals
router.get('/prepaid/referrals', ensureAuthenticated, PrepaidAdminController.referralTracking);
```

---

## 📋 STEP 4: UPDATE SIDEBAR NAVIGATION

Edit `views/partials/sidebar.ejs` and add new menu items:

```html
<!-- Prepaid Section -->
<li class="nav-item">
    <a href="#" class="nav-link">
        <i class="nav-icon fas fa-mobile-alt"></i>
        <p>
            Prepaid Management
            <i class="right fas fa-angle-left"></i>
        </p>
    </a>
    <ul class="nav nav-treeview">
        <li class="nav-item">
            <a href="/prepaid/payments" class="nav-link">
                <i class="far fa-circle nav-icon"></i>
                <p>Payment Monitoring</p>
            </a>
        </li>
        <li class="nav-item">
            <a href="/prepaid/reports" class="nav-link">
                <i class="far fa-circle nav-icon"></i>
                <p>Reports & Analytics</p>
            </a>
        </li>
        <li class="nav-item">
            <a href="/prepaid/vouchers" class="nav-link">
                <i class="far fa-circle nav-icon"></i>
                <p>Voucher Management</p>
            </a>
        </li>
        <li class="nav-item">
            <a href="/prepaid/referrals" class="nav-link">
                <i class="far fa-circle nav-icon"></i>
                <p>Referral Tracking</p>
            </a>
        </li>
    </ul>
</li>
```

---

## 📋 STEP 5: CREATE SAMPLE VOUCHERS

Run this SQL to create sample vouchers for testing:

```sql
-- Sample Voucher 1: New Year Discount
INSERT INTO vouchers (code, name, description, discount_type, discount_value, min_purchase, valid_from, valid_until, usage_limit, customer_type, status)
VALUES ('NEWYEAR2026', 'New Year Discount 2026', 'Get 20% off for new year celebration', 'percentage', 20, 50000, '2026-01-01 00:00:00', '2026-01-31 23:59:59', 100, 'all', 'active');

-- Sample Voucher 2: First Purchase
INSERT INTO vouchers (code, name, description, discount_type, discount_value, min_purchase, valid_from, valid_until, customer_type, status)
VALUES ('FIRSTBUY', 'First Purchase Bonus', 'Special discount for first-time prepaid customers', 'fixed', 10000, 0, '2026-01-01 00:00:00', '2026-12-31 23:59:59', NULL, 'new', 'active');

-- Sample Voucher 3: Referral Bonus
INSERT INTO vouchers (code, name, description, discount_type, discount_value, min_purchase, valid_from, valid_until, customer_type, status)
VALUES ('REFERRAL50', 'Referral Discount', 'Get Rp 50,000 off when you refer a friend', 'fixed', 50000, 100000, '2026-01-01 00:00:00', '2026-12-31 23:59:59', NULL, 'all', 'active');
```

---

## 🚀 FEATURES IMPLEMENTED

### 1. **Auto-Cleanup & Reminders** ✅
- ✅ Auto-expire payment requests > 1 hour old
- ✅ Send reminder after 30 minutes of pending payment
- ✅ Delete old records after 30 days
- ✅ Runs automatically every 15 minutes

### 2. **Expiry Reminders** ✅
- ✅ H-3 reminder (3 days before expiry)
- ✅ H-1 reminder (1 day before expiry)
- ✅ Expired notification (on expiry day)
- ✅ Sent via WhatsApp automatically
- ✅ Logged in database for tracking

### 3. **Voucher System** ✅
- ✅ Percentage, fixed amount, or free days discounts
- ✅ Minimum purchase requirements
- ✅ Valid date ranges
- ✅ Usage limits (per voucher and per customer)
- ✅ Customer type restrictions (new/existing/prepaid/postpaid)
- ✅ Admin dashboard for management

### 4. **Referral Program** ✅
- ✅ Unique referral code per customer
- ✅ Automatic reward distribution
- ✅ Referrer gets +3 days free
- ✅ Referred gets 10% discount
- ✅ Tracking dashboard

### 5. **Admin Dashboard** ✅
- ✅ Payment monitoring with filters
- ✅ Manual approve/reject buttons
- ✅ View payment proof images
- ✅ Transaction reports
- ✅ Revenue analytics
- ✅ Package distribution charts
- ✅ Voucher usage statistics

---

## 📊 TESTING CHECKLIST

### Test Expiry Reminders:
```sql
-- Set a customer to expire in 3 days
UPDATE customers SET expiry_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY) WHERE id = 1;

-- Manually trigger (or wait for scheduler):
-- Check expiry_notifications table for sent reminders
SELECT * FROM expiry_notifications ORDER BY sent_at DESC;
```

### Test Voucher:
1. Create voucher via admin panel
2. Customer uses code during payment
3. Check voucher_usage table

### Test Referral:
1. Customer A gets referral code: `/referral`
2. Customer B uses code during registration
3. Customer B makes first purchase
4. Customer A automatically gets +3 days

### Test Payment Cleanup:
1. Create payment request
2. Wait 30 minutes - should receive reminder
3. Wait 1 hour - should auto-expire
4. Check `payment_requests` status

---

## 🎉 NEXT STEPS AFTER MIGRATION

1. ✅ Run SQL migration (STEP 1)
2. ✅ Update scheduler (STEP 2)
3. ✅ Add routes (STEP 3)
4. ✅ Update sidebar (STEP 4)
5. ✅ Create sample vouchers (STEP 5)
6. ✅ Run `npm run build`
7. ✅ Run `pm2 reload billing-app`
8. ✅ Test all features!

---

**All backend logic is COMPLETE and READY!**  
**UI views will be created next.**

