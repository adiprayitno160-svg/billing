USE billing_system;

-- Add is_taxable column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_taxable TINYINT(1) DEFAULT 0 AFTER use_device_rental;

-- Verify
SELECT 'Migration Complete: Added is_taxable to customers' as status;
