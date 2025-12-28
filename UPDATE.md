# 🚀 Update Guide - Version 2.3.14

## Update via SSH (Ubuntu Server)

```bash
# One-liner update
cd /path/to/billing && git fetch --tags && git checkout v2.3.14 && npm install && npm run build && pm2 restart billing-app && pm2 save
```

## Database Migration

```sql
CREATE TABLE IF NOT EXISTS `manual_payment_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `invoice_id` int(11) DEFAULT NULL,
  `image_data` LONGTEXT NOT NULL,
  `image_mimetype` varchar(255) DEFAULT 'image/jpeg',
  `reason` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## What's New in 2.3.14

✅ WhatsApp Bot fixes  
✅ Gemini AI auto-verification untuk bukti transfer  
✅ Manual verification queue untuk admin  
✅ Enhanced notifications  

## Troubleshooting

**Bot tidak merespons `/menu`?**
- Pastikan nomor WhatsApp sudah terdaftar di database customers

**Gemini AI tidak bekerja?**  
- Check Settings > AI Settings
- Pastikan API Key sudah diisi

---
**Version:** 2.3.14  
**Tag:** v2.3.14  
**GitHub:** https://github.com/adiprayitno160-svg/billing
