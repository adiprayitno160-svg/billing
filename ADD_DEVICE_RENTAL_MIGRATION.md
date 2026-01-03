# DATABASE MIGRATION FOR DEVICE RENTAL & PPN

Please run the following SQL commands in your database client (HeidiSQL/phpMyAdmin) to enable Device Rental and PPN features.

```sql
USE billing_system;

-- 1. Add use_device_rental column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS use_device_rental BOOLEAN DEFAULT FALSE AFTER billing_mode;

-- 2. Ensure PPN columns exist in payment_requests FIRST
ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS ppn_rate DECIMAL(5,2) DEFAULT 0 AFTER payment_method_id,
ADD COLUMN IF NOT EXISTS ppn_amount DECIMAL(10,2) DEFAULT 0 AFTER ppn_rate,
ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(10,2) DEFAULT 0 AFTER ppn_amount;

-- 3. Now add device_fee column to payment_requests (safe to place after ppn_amount)
ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS device_fee DECIMAL(10,2) DEFAULT 0 AFTER ppn_amount;

-- 4. Ensure PPN columns exist in prepaid_transactions
ALTER TABLE prepaid_transactions
ADD COLUMN IF NOT EXISTS ppn_amount DECIMAL(10,2) DEFAULT 0 AFTER verified_by;

-- 5. Add device_fee column to prepaid_transactions
ALTER TABLE prepaid_transactions
ADD COLUMN IF NOT EXISTS device_fee DECIMAL(10,2) DEFAULT 0 AFTER ppn_amount;

-- 6. Add default system settings for Device Rental & PPN
INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
('device_rental_enabled', 'false', 'Enable device rental fee globally'),
('device_rental_fee', '0', 'Default device rental fee amount'),
('ppn_enabled', 'false', 'Enable PPN (VAT) globally'),
('ppn_rate', '11', 'PPN Rate in percent')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 7. Verify result
SELECT 'Migration Complete' as status;
```

After running this, the Device Rental checkbox in Customer Edit and the PPN settings will work correctly.
