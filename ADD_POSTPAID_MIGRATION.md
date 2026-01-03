# DATABASE MIGRATION FOR POSTPAID PPN & DEVICE RENTAL

Please run the following SQL commands in your database client (HeidiSQL/phpMyAdmin) to enable PPN and Device Rental features for **Postpaid Invoices**.

```sql
USE billing_system;

-- Add PPN and Device Fee columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS ppn_rate DECIMAL(5,2) DEFAULT 0 AFTER discount_amount,
ADD COLUMN IF NOT EXISTS ppn_amount DECIMAL(10,2) DEFAULT 0 AFTER ppn_rate,
ADD COLUMN IF NOT EXISTS device_fee DECIMAL(10,2) DEFAULT 0 AFTER ppn_amount;

-- Verify
SELECT 'Postpaid Migration Complete' as status;
```
