# SETUP PPN & DEVICE RENTAL SETTINGS

Script ini akan menambahkan/update settings untuk PPN dan Device Rental.
Jalankan SQL di bawah ini di **phpMyAdmin** atau **MySQL command line**.

---

## 📋 SQL Script

```sql
-- ================================================
-- SETUP PPN & DEVICE RENTAL SETTINGS
-- ================================================

USE isp_billing;

-- 1. Tambah/Update PPN Settings
INSERT INTO system_settings (setting_key, setting_value, description, created_at, updated_at)
VALUES 
    ('ppn_enabled', 'true', 'Enable PPN (VAT) globally', NOW(), NOW()),
    ('ppn_rate', '11', 'PPN rate in percentage (e.g., 11 for 11%)', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = NOW();

-- 2. Tambah/Update Device Rental Settings
INSERT INTO system_settings (setting_key, setting_value, description, created_at, updated_at)
VALUES 
    ('device_rental_enabled', 'true', 'Enable device rental fee globally', NOW(), NOW()),
    ('device_rental_fee', '50000', 'Monthly device rental fee amount', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = NOW();

-- 3. Verifikasi Settings
SELECT 
    setting_key,
    setting_value,
    description
FROM system_settings
WHERE setting_key IN ('ppn_enabled', 'ppn_rate', 'device_rental_enabled', 'device_rental_fee')
ORDER BY setting_key;
```

---

## 🎯 CARA MENJALANKAN

### Opsi 1: Via phpMyAdmin (TERCEPAT)
1. Buka **phpMyAdmin** → http://localhost/phpmyadmin
2. Pilih database **isp_billing**
3. Klik tab **SQL**
4. Copy-paste script SQL di atas
5. Klik **Go** / **Kirim**

### Opsi 2: Via MySQL Command Line
```bash
mysql -u root -p isp_billing < SETUP_PPN_SETTINGS.md
```

---

## 📊 NILAI DEFAULT

Setelah menjalankan script, settings berikut akan aktif:

| Setting | Nilai | Keterangan |
|---------|-------|------------|
| `ppn_enabled` | `true` | PPN aktif |
| `ppn_rate` | `11` | PPN 11% |
| `device_rental_enabled` | `true` | Sewa Perangkat aktif |
| `device_rental_fee` | `50000` | Rp 50.000/bulan |

**Anda bisa mengubah nilai-nilai ini sesuai kebutuhan!**

---

## ⚠️ JANGAN LUPA!

Setelah menjalankan script:
1. **Restart aplikasi:**
   ```bash
   pm2 restart billing-app
   ```

2. **Jalankan juga migration postpaid** (jika belum):
   Lihat file: `ADD_POSTPAID_MIGRATION.md`

---

## 🔍 CARA AKSES SETTINGS DI APLIKASI

Setelah settings diinsert, Anda bisa:
1. Akses langsung via URL: **http://localhost/settings/system**
2. Atau tambahkan menu di sidebar (jika belum ada)
