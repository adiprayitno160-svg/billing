# 🔧 FIX: Mikrotik Sudah Terhubung Tapi Tidak Terdeteksi

## 🐛 **MASALAH:**

User bilang: "Mikrotik sudah terhubung tapi tidak bisa"

Page menampilkan: "Mikrotik Belum Dikonfigurasi"

**Root Cause:** Query `SELECT * FROM mikrotik_settings WHERE is_active = 1` tidak return data.

**Kemungkinan:**
1. Column `is_active` tidak ada di table
2. Column `is_active` ada tapi value = 0 (inactive)
3. Table `mikrotik_settings` kosong
4. Database connection issue

---

## ✅ **LANGKAH FIX:**

### **Step 1: Check Database (WAJIB!)**

Buka **phpMyAdmin** atau MySQL client, jalankan:

```sql
USE billing_db;

-- Check table structure
DESCRIBE mikrotik_settings;

-- Check all data
SELECT * FROM mikrotik_settings;
```

**Expected output:**
```
id | host        | username | password | api_port | is_active
1  | 192.168.1.1 | admin    | ******   | 8728     | 1
```

---

### **Step 2: Fix Column is_active (Jika Tidak Ada)**

Jika column `is_active` **TIDAK ADA**, jalankan:

```sql
ALTER TABLE mikrotik_settings 
ADD COLUMN is_active TINYINT(1) DEFAULT 1;
```

Lalu update semua record:

```sql
UPDATE mikrotik_settings SET is_active = 1;
```

---

### **Step 3: Fix Data (Jika is_active = 0)**

Jika column `is_active` **ADA** tapi nilainya **0**, update:

```sql
UPDATE mikrotik_settings 
SET is_active = 1 
WHERE id = 1;  -- atau WHERE host = '192.168.1.1'
```

---

### **Step 4: Verify Data**

```sql
SELECT 
    id,
    host,
    username,
    api_port,
    is_active,
    created_at
FROM mikrotik_settings 
WHERE is_active = 1 
LIMIT 1;
```

**Harus return 1 row!** ✅

---

### **Step 5: Restart Server**

```bash
npm run build
pm2 restart billing-system
```

---

### **Step 6: Check Logs**

```bash
pm2 logs billing-system --lines 30
```

Cari output:
```
[MikrotikSetup] Query result: [...]
[MikrotikSetup] Checking setup status for: 192.168.1.1
```

Jika muncul:
```
[MikrotikSetup] No mikrotik settings found in database
```

Berarti **database belum punya data!**

---

## 🔍 **DEBUG: Cek Data Mikrotik**

### **Query 1: Apakah table ada?**

```sql
SHOW TABLES LIKE 'mikrotik_settings';
```

**Expected:** 1 row

---

### **Query 2: Apakah ada data?**

```sql
SELECT COUNT(*) as total FROM mikrotik_settings;
```

**Expected:** total > 0

---

### **Query 3: Apakah ada yang active?**

```sql
SELECT COUNT(*) as active 
FROM mikrotik_settings 
WHERE is_active = 1;
```

**Expected:** active > 0

---

### **Query 4: Show all data**

```sql
SELECT 
    id,
    host,
    username,
    CASE WHEN password IS NOT NULL THEN '***' ELSE 'NULL' END as password,
    api_port,
    is_active
FROM mikrotik_settings;
```

**Expected:** At least 1 row dengan `is_active = 1`

---

## 🛠️ **SOLUSI ALTERNATIF:**

### **Jika Table Kosong (Tidak Ada Data):**

**Opsi 1: Setup Ulang via UI**

1. Buka: `/settings/mikrotik`
2. Isi form:
   - **Host:** 192.168.1.1 (IP Mikrotik Anda)
   - **Username:** admin
   - **Password:** (password Mikrotik)
   - **API Port:** 8728
3. Klik **Test Connection**
4. Jika berhasil, klik **Save**

---

**Opsi 2: Insert Manual**

```sql
INSERT INTO mikrotik_settings 
(host, username, password, api_port, is_active, created_at) 
VALUES 
('192.168.1.1', 'admin', 'your_password', 8728, 1, NOW());
```

Ganti:
- `192.168.1.1` → IP Mikrotik Anda
- `admin` → Username Mikrotik
- `your_password` → Password Mikrotik

---

### **Jika Column is_active Tidak Ada:**

```sql
-- Check columns
SHOW COLUMNS FROM mikrotik_settings;

-- Jika is_active tidak ada, tambahkan:
ALTER TABLE mikrotik_settings 
ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 
AFTER api_port;

-- Update existing records
UPDATE mikrotik_settings SET is_active = 1;
```

---

## 📊 **AFTER FIX:**

### **Test 1: Check Database**

```sql
SELECT * FROM mikrotik_settings WHERE is_active = 1;
```

**Harus return 1 row!** ✅

---

### **Test 2: Check Page**

Buka:
```
http://192.168.239.126:3000/prepaid/mikrotik-setup
```

**Harus tampil:**
```
✅ Mikrotik Connection
   Host: 192.168.1.1
   Port: 8728
   [Test Connection]
```

**BUKAN:**
```
❌ Mikrotik Belum Dikonfigurasi
```

---

### **Test 3: Check Logs**

```bash
pm2 logs billing-system --lines 20
```

**Expected output:**
```
[MikrotikSetup] Query result: [ { id: 1, host: '192.168.1.1', ... } ]
[MikrotikSetup] Checking setup status for: 192.168.1.1
[MikrotikSetup] Setup status: { profiles: false, natRules: false, ... }
```

---

## ✅ **QUICK FIX SCRIPT:**

Copy-paste ini di MySQL:

```sql
-- Quick fix untuk mikrotik_settings
USE billing_db;

-- 1. Tambah column is_active jika belum ada
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'mikrotik_settings' 
  AND COLUMN_NAME = 'is_active' 
  AND TABLE_SCHEMA = DATABASE();

SET @query = IF(@col_exists = 0,
    'ALTER TABLE mikrotik_settings ADD COLUMN is_active TINYINT(1) DEFAULT 1',
    'SELECT "Column is_active already exists" as result');
    
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Set semua record jadi active
UPDATE mikrotik_settings SET is_active = 1;

-- 3. Verify
SELECT 
    id,
    host,
    username,
    api_port,
    is_active
FROM mikrotik_settings;
```

---

## 📞 **JIKA MASIH TIDAK MUNCUL:**

**Kirim hasil query ini:**

```sql
-- 1. Table structure
SHOW CREATE TABLE mikrotik_settings;

-- 2. All data
SELECT * FROM mikrotik_settings;

-- 3. Column info
DESCRIBE mikrotik_settings;
```

Dan screenshot:
- Halaman `/prepaid/mikrotik-setup`
- Output `pm2 logs` (20 lines)

---

## 🎯 **MOST LIKELY FIX:**

**90% kemungkinan masalahnya adalah:**

Column `is_active` tidak ada atau nilainya 0.

**Solusi kilat:**

```sql
ALTER TABLE mikrotik_settings ADD COLUMN is_active TINYINT(1) DEFAULT 1;
UPDATE mikrotik_settings SET is_active = 1;
```

Lalu restart:
```bash
pm2 restart billing-system
```

**Seharusnya langsung fix! ✅**

