# 🔧 FIX Database Error: Unknown column 'mikrotik_profile_name'

## ❌ Error Message:
```
Database error: Unknown column 'mikrotik_profile_name' in 'field list'
```

## ✅ Solusi:

Tabel `prepaid_packages` kehilangan beberapa kolom penting. Ikuti salah satu cara di bawah:

---

## 🚀 OPTION 1: Otomatis (Recommended)

### Windows:
1. **Double-click file ini:**
   ```
   fix-database-error.bat
   ```

2. **Masukkan kredensial database:**
   - Host: `localhost` (default)
   - Port: `3306` (default)
   - User: `root` (default)
   - Password: [password MySQL Anda]
   - Database: `billing` (default)

3. **Tunggu proses selesai** - Done! ✅

---

## 📝 OPTION 2: Manual via phpMyAdmin / MySQL Workbench

### Langkah 1: Buka phpMyAdmin
- URL: `http://localhost/phpmyadmin`
- Login dengan user `root`

### Langkah 2: Pilih database `billing`

### Langkah 3: Klik tab SQL

### Langkah 4: Copy & Paste SQL ini:

```sql
-- Add missing columns to prepaid_packages table

-- 1. Add mikrotik_profile_name column
ALTER TABLE prepaid_packages 
ADD COLUMN IF NOT EXISTS mikrotik_profile_name VARCHAR(100) NULL 
AFTER connection_type;

-- 2. Add parent_download_queue column  
ALTER TABLE prepaid_packages 
ADD COLUMN IF NOT EXISTS parent_download_queue VARCHAR(100) NULL 
AFTER mikrotik_profile_name;

-- 3. Add parent_upload_queue column
ALTER TABLE prepaid_packages 
ADD COLUMN IF NOT EXISTS parent_upload_queue VARCHAR(100) NULL 
AFTER parent_download_queue;

-- Verify columns
SELECT 'Columns added successfully!' as status;
SHOW COLUMNS FROM prepaid_packages;
```

### Langkah 5: Klik "Go" atau "Execute"

### Langkah 6: Verify
Pastikan kolom-kolom ini ada di tabel `prepaid_packages`:
- ✅ `mikrotik_profile_name` (VARCHAR 100, NULL)
- ✅ `parent_download_queue` (VARCHAR 100, NULL)
- ✅ `parent_upload_queue` (VARCHAR 100, NULL)

---

## 🔍 OPTION 3: Via MySQL Command Line

```bash
# Login ke MySQL
mysql -u root -p

# Pilih database
use billing;

# Tambah kolom-kolom
ALTER TABLE prepaid_packages 
ADD COLUMN IF NOT EXISTS mikrotik_profile_name VARCHAR(100) NULL 
AFTER connection_type;

ALTER TABLE prepaid_packages 
ADD COLUMN IF NOT EXISTS parent_download_queue VARCHAR(100) NULL 
AFTER mikrotik_profile_name;

ALTER TABLE prepaid_packages 
ADD COLUMN IF NOT EXISTS parent_upload_queue VARCHAR(100) NULL 
AFTER parent_download_queue;

# Verify
SHOW COLUMNS FROM prepaid_packages;

# Exit
exit;
```

---

## 📊 Struktur Tabel Yang Benar:

Setelah migration, tabel `prepaid_packages` harus punya struktur seperti ini:

```
+-------------------------+------------------+------+-----+
| Field                   | Type             | Null | Key |
+-------------------------+------------------+------+-----+
| id                      | int              | NO   | PRI |
| name                    | varchar(100)     | NO   |     |
| description             | text             | YES  |     |
| connection_type         | enum(...)        | NO   |     |
| mikrotik_profile_name   | varchar(100)     | YES  |     | ← HARUS ADA
| parent_download_queue   | varchar(100)     | YES  |     | ← HARUS ADA
| parent_upload_queue     | varchar(100)     | YES  |     | ← HARUS ADA
| download_mbps           | decimal(10,2)    | NO   |     |
| upload_mbps             | decimal(10,2)    | NO   |     |
| duration_days           | int              | NO   |     |
| price                   | decimal(10,2)    | NO   |     |
| is_active               | tinyint(1)       | YES  |     |
| created_at              | timestamp        | YES  |     |
| updated_at              | timestamp        | YES  |     |
+-------------------------+------------------+------+-----+
```

---

## ⚠️ Troubleshooting

### Error: "Table 'prepaid_packages' doesn't exist"
**Solusi:**
```sql
-- Create table if not exists
CREATE TABLE IF NOT EXISTS prepaid_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  connection_type ENUM('pppoe', 'static', 'both') NOT NULL DEFAULT 'pppoe',
  mikrotik_profile_name VARCHAR(100) NULL,
  parent_download_queue VARCHAR(100) NULL,
  parent_upload_queue VARCHAR(100) NULL,
  download_mbps DECIMAL(10,2) NOT NULL,
  upload_mbps DECIMAL(10,2) NOT NULL,
  duration_days INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Error: "Column already exists"
**Solusi:** Abaikan error ini, berarti kolom sudah ada.

### Error: Access denied
**Solusi:** Pastikan user MySQL Anda punya privilege `ALTER` table.

---

## ✅ Setelah Fix

1. **Restart aplikasi:**
   ```bash
   pm2 restart billing-system
   ```

2. **Test halaman prepaid:**
   - Buka: `http://localhost:3000/prepaid/packages`
   - Buka: `http://localhost:3000/prepaid/dashboard`

3. **Verify tidak ada error lagi**

---

## 📝 Notes

**Kenapa kolom ini hilang?**
- Kemungkinan database di-restore dari backup lama
- Atau migration tidak dijalankan saat instalasi
- Atau ada alter table manual yang menghapus kolom

**Kolom ini untuk apa?**
- `mikrotik_profile_name`: Nama profile PPPoE di MikroTik (untuk prepaid PPPoE)
- `parent_download_queue`: Parent queue untuk download (untuk prepaid Static IP)
- `parent_upload_queue`: Parent queue untuk upload (untuk prepaid Static IP)

**Aman untuk ditambahkan?**
- ✅ Ya, aman! Migration ini hanya **ADD COLUMN**, tidak mengubah data yang sudah ada
- ✅ Kolom bersifat NULL, jadi tidak akan error untuk data existing

---

**Created:** October 28, 2025
**Fix Version:** 1.0.0

