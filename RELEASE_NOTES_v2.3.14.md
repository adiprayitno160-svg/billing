# Version 2.3.14 - WhatsApp Bot Fixes & Gemini AI Enhancements

## 🎯 Yang Diperbaiki

### 1. WhatsApp Bot `/menu` Tidak Merespons
**Penyebab:** 
- Bot memiliki GLOBAL GUARD yang memvalidasi nomor customer terlebih dahulu
- Jika nomor tidak terdaftar di database `customers`, bot akan mengirim pesan "AKSES DITOLAK"

**Solusi:**
- Pastikan nomor WhatsApp customer sudah terdaftar di tabel `customers` dengan format yang benar
- Nomor bisa dalam format: `62812345678` atau `0812345678`
- Bot otomatis mencocokkan kedua format

**Cara Test:**
1. Pastikan nomor sudah terdaftar di database:
   ```sql
   SELECT * FROM customers WHERE phone = '62812345678' OR phone = '0812345678';
   ```
2. Kirim pesan `/menu` dari WhatsApp
3. Bot akan merespons dengan menu utama

---

## 🤖 Gemini AI Auto-Verification untuk Bukti Transfer

### Fitur Baru:
1. **Auto-Approval dengan Confidence Score**
   - Gemini AI menganalisa bukti transfer otomatis
   - Jika valid dan confidence > 70%, langsung approved
   - Customer dapat notifikasi instant

2. **Smart Error Handling**
   - Jika bukti transfer blur/tidak jelas → **FLAGGED untuk manual verification**
   - Jika jumlah tidak cocok → **FLAGGED untuk manual verification**  
   - Jika tidak ada tagihan → Notifikasi "Tagihan Sudah Lunas"

3. **Manual Verification Queue**
   - Bukti transfer yang gagal auto-verify disimpan di database
   - Admin dapat review dan approve manual
   - Customer dapat notifikasi setelah admin verify

### Cara Kerja:

**Customer mengirim gambar bukti transfer:**
```
📱 Customer → Kirim foto bukti transfer ke WhatsApp
         ↓
   🤖 Gemini AI Analisa
         ↓
    ✅ Valid & Confidence ≥ 70%?
         ├─ YES → Auto-Approve → Notif "PEMBAYARAN BERHASIL DIVERIFIKASI!"
         └─ NO  → Flag Manual Review → Notif "MEMERLUKAN VERIFIKASI MANUAL"
```

### Notifikasi yang Dikirim:

#### ✅ Auto-Approved (Success):
```
✅ PEMBAYARAN BERHASIL DIVERIFIKASI!

📄 Invoice: INV-2024-001
💰 Jumlah: Rp 250,000
📊 Status: Lunas
🎯 Confidence: 95%

🎉 Terima kasih atas pembayaran Anda!

Layanan Anda sudah aktif kembali.
```

#### ⚠️ Flagged for Manual Review:
```
⚠️ BUKTI TRANSFER MEMERLUKAN VERIFIKASI MANUAL

Alasan: Foto kurang jelas / Jumlah tidak sesuai

📋 Bukti transfer Anda telah disimpan dan akan diverifikasi oleh admin.

⏱️ Verifikasi manual biasanya selesai dalam 1-2 jam kerja.
Anda akan mendapat notifikasi WhatsApp setelah verifikasi selesai.

💡 Tips untuk verifikasi lebih cepat:
• Pastikan foto jelas dan tidak blur
• Pastikan semua informasi terlihat lengkap
• Pastikan jumlah transfer sesuai tagihan

Atau hubungi customer service: [CS Number]
```

---

## 📊 Database Migration

Jalankan SQL berikut untuk membuat tabel manual verification:

```sql
CREATE TABLE IF NOT EXISTS `manual_payment_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `invoice_id` int(11) DEFAULT NULL,
  `image_data` LONGTEXT NOT NULL COMMENT 'Base64 encoded image',
  `image_mimetype` varchar(255) DEFAULT 'image/jpeg',
  `reason` text DEFAULT NULL COMMENT 'Reason for manual verification',
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `verified_by` int(11) DEFAULT NULL COMMENT 'Admin user ID',
  `verified_at` datetime DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`),
  KEY `idx_pending_verifications` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 🚀 Deployment

### Di Server Ubuntu (via SSH):

```bash
# Pull latest version
cd /path/to/billing
git fetch --tags
git checkout v2.3.14

# Install dependencies & build
npm install
npm run build

# Restart PM2
pm2 restart billing-app
pm2 save
```

### Atau gunakan one-liner:
```bash
cd /path/to/billing && git fetch --tags && git checkout v2.3.14 && npm install && npm run build && pm2 restart billing-app && pm2 save
```

---

## 🔍 Troubleshooting WhatsApp Bot

### Bot tidak merespons `/menu`:
1. **Check nomor terdaftar:**
   ```sql
   SELECT id, name, phone FROM customers WHERE phone LIKE '%812345678%';
   ```

2. **Check WhatsApp service status:**
   - Buka `http://your-server:3001/whatsapp/status`
   - Pastikan status: `ready: true`

3. **Check logs:**
   ```bash
   pm2 logs billing-app | grep WhatsAppBot
   ```

4. **Restart WhatsApp service:**
   - Buka `http://your-server:3001/whatsapp`
   - Click "Disconnect" → "Initialize" → Scan QR Code

### Gemini AI tidak bekerja:
1. **Check AI Settings:**
   - Buka `Settings > AI Settings`
   - Pastikan "Enable AI" = ON
   - Pastikan API Key sudah diisi

2. **Test Gemini API:**
   ```bash
   # Check API key di database
   SELECT * FROM system_settings WHERE key = 'gemini_api_key';
   ```

---

## 📝 Changelog

### Version 2.3.14 (2025-12-28)

**Added:**
- ✨ Enhanced WhatsApp bot media handling dengan format validation
- 🤖 Smart error categorization untuk Gemini AI results
- 📋 Manual verification flagging system
- 💬 Improved customer notifications dengan emoji dan formatting
- 🎯 Confidence score display untuk successful verifications

**Fixed:**
- 🐛 WhatsApp bot `/menu` tidak merespons (dokumentasi updated)
- 🔧 Better error messages untuk berbagai skenario verification

**Changed:**
- 📊 Enhanced notification messages dengan lebih informatif
- 🎨 Better UX untuk flagged payments

---

## 👥 Support

Jika ada masalah:
1. Check documentation di atas
2. Check PM2 logs: `pm2 logs billing-app`
3. Check database untuk manual verifications:
   ```sql
   SELECT * FROM manual_payment_verifications 
   WHERE status = 'pending' 
   ORDER BY created_at DESC;
   ```

---

**Version:** 2.3.14  
**Release Date:** 2025-12-28  
**Git Tag:** v2.3.14  
**Commit:** 85de4b3
