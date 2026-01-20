-- Add Bank Details to System Settings
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
('bank_name', 'BCA', 'Nama Bank Utama', 'billing'),
('bank_account_number', '1234567890', 'Nomor Rekening Bank', 'billing'),
('bank_account_name', 'PROVIDER INTERNET', 'Nama Pemilik Rekening', 'billing');

-- Update Notification Templates to include Bank Details
-- For Invoice Created
UPDATE notification_templates 
SET message_template = CONCAT(message_template, '\n\nPembayaran dapat ditransfer ke:\n🏦 {{bank_name}}\n💳 {{bank_account_number}}\n👤 {{bank_account_name}}\n\nHarap kirim bukti bayar setelah transfer.')
WHERE notification_type = 'invoice_created'
  AND message_template NOT LIKE '%{{bank_account_number}}%';

-- For Invoice Overdue
UPDATE notification_templates 
SET message_template = CONCAT(message_template, '\n\nMohon segera lunasi pembayaran ke:\n🏦 {{bank_name}}\n💳 {{bank_account_number}}\n👤 {{bank_account_name}}')
WHERE notification_type = 'invoice_overdue'
  AND message_template NOT LIKE '%{{bank_account_number}}%';

-- For Invoice Reminder (20th)
-- Ensure 'invoice_reminder' template exists first (if not seeded)
INSERT IGNORE INTO notification_templates (template_code, notification_type, channel, title_template, message_template, description, is_active, priority)
VALUES ('WA_INV_REMINDER', 'invoice_reminder', 'whatsapp', 'Pengingat Tagihan {{period}}', 'Halo *{{customer_name}}*,\n\nIni adalah pengingat untuk tagihan internet Anda periode *{{period}}*.\n\nNo. Tagihan: {{invoice_number}}\nTotal: *{{amount}}*\nJatuh Tempo: {{due_date}}\n\nSilakan lakukan pembayaran ke:\n🏦 {{bank_name}}\n💳 {{bank_account_number}}\n👤 {{bank_account_name}}\n\nTerima kasih.', 'Template pengingat tagihan bulanan', 1, 'normal');

-- Update Reminder if it already existed but missed bank info
UPDATE notification_templates 
SET message_template = CONCAT(message_template, '\n\nPembayaran:\n🏦 {{bank_name}}\n💳 {{bank_account_number}}\n👤 {{bank_account_name}}')
WHERE notification_type = 'invoice_reminder'
  AND message_template NOT LIKE '%{{bank_account_number}}%';
