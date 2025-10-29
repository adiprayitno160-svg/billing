# 🔍 DEBUG: Error 500 di Mikrotik Setup

## 🐛 Langkah Debug:

### **Step 1: Test Route Simple**

Buka browser, akses:
```
http://192.168.239.126:3000/prepaid/mikrotik-setup/test-simple
```

**Jika muncul "Mikrotik Setup Route Working!":**
✅ Routes OK, masalah di controller

**Jika masih error 500:**
❌ Routes belum register atau server belum restart

---

### **Step 2: Restart Server**

```bash
pm2 restart billing-system

# Atau jika pakai npm
# Ctrl+C stop dulu
npm start
```

---

### **Step 3: Cek Logs Real-Time**

```bash
pm2 logs billing-system --lines 100
```

Atau:
```bash
pm2 logs
```

Cari error message yang muncul saat akses `/prepaid/mikrotik-setup`

---

### **Step 4: Test Database Connection**

Buka MySQL/phpMyAdmin, jalankan:

```sql
-- Cek table system_settings
SHOW TABLES LIKE 'system_settings';

-- Jika belum ada, create manual:
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_setting_key (setting_key),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default settings
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
('prepaid_portal_url', 'http://192.168.239.126:3000', 'URL server billing untuk redirect prepaid portal', 'prepaid'),
('prepaid_portal_enabled', 'true', 'Enable/disable prepaid portal system', 'prepaid'),
('prepaid_redirect_splash_page', 'true', 'Redirect ke splash page atau langsung login', 'prepaid'),
('prepaid_auto_whatsapp_notification', 'true', 'Auto WhatsApp notification untuk prepaid', 'prepaid');
```

---

### **Step 5: Test Sederhana di Node**

Buat file test: `test-mikrotik-setup.js`

```javascript
const pool = require('./dist/db/pool').default;

async function test() {
  try {
    console.log('Testing database connection...');
    
    // Test query
    const [rows] = await pool.query('SELECT 1+1 as result');
    console.log('✅ Database OK:', rows);
    
    // Test mikrotik_settings table
    const [mikrotik] = await pool.query('SELECT * FROM mikrotik_settings LIMIT 1');
    console.log('✅ Mikrotik settings:', mikrotik);
    
    // Test system_settings table
    const [settings] = await pool.query('SELECT * FROM system_settings LIMIT 1');
    console.log('✅ System settings:', settings);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();
```

Run:
```bash
node test-mikrotik-setup.js
```

---

## 🔥 SOLUSI CEPAT:

### **Solusi 1: Fresh Restart**

```bash
# Stop server
pm2 stop billing-system

# Kill node processes
pm2 delete billing-system

# Start lagi
pm2 start ecosystem.config.js
```

---

### **Solusi 2: Manual Create Table**

Jalankan SQL di database:

```sql
USE billing_db;

-- Create table
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_setting_key (setting_key),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert settings
INSERT INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
('prepaid_portal_url', 'http://192.168.239.126:3000', 'URL server billing', 'prepaid'),
('prepaid_portal_enabled', 'true', 'Enable prepaid', 'prepaid')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
```

Lalu restart server.

---

### **Solusi 3: Check View File**

```bash
# Cek file ada
ls -la views/prepaid/mikrotik-setup.ejs

# Windows
dir views\prepaid\mikrotik-setup.ejs
```

Jika tidak ada, view file belum ter-save. Re-download atau re-create.

---

### **Solusi 4: TypeScript Compile**

```bash
# Re-compile TypeScript
npm run build

# Lalu restart
pm2 restart billing-system
```

---

## 📊 ERROR MESSAGES UMUM:

### ❌ **"Cannot read property 'host' of undefined"**

**Penyebab:** `mikrotikSettings` undefined

**Solusi:**
- Config Mikrotik di Settings > Mikrotik
- Set IP, username, password
- Save & test connection

---

### ❌ **"Table 'system_settings' doesn't exist"**

**Penyebab:** Table belum dibuat

**Solusi:**
- Jalankan SQL manual (Solusi 2 di atas)
- Atau akses page sekali lagi (otomatis create)

---

### ❌ **"Cannot find module 'prepaid/mikrotik-setup'"**

**Penyebab:** View file tidak ada

**Solusi:**
- Re-create file `views/prepaid/mikrotik-setup.ejs`
- Pastikan folder `views/prepaid/` ada

---

### ❌ **"setupStatus is not defined"**

**Penyebab:** Controller error

**Solusi:**
- Sudah di-fix di latest version
- Re-compile TypeScript: `npm run build`
- Restart server

---

## ✅ CHECKLIST DEBUG:

- [ ] Server sudah restart
- [ ] Test simple route berhasil (`/prepaid/mikrotik-setup/test-simple`)
- [ ] Cek pm2 logs (no error messages)
- [ ] Table `system_settings` sudah ada
- [ ] Table `mikrotik_settings` sudah ada
- [ ] File `views/prepaid/mikrotik-setup.ejs` ada
- [ ] TypeScript compiled (folder `dist/` ada)
- [ ] Database connection OK

---

## 📞 JIKA MASIH ERROR:

**Copy paste error message lengkap dari:**

```bash
pm2 logs billing-system --lines 50
```

**Dan screenshot dari browser:**
- Full error message
- URL yang diakses
- Network tab (F12 > Network)

**Info tambahan:**
- Node version: `node -v`
- NPM version: `npm -v`
- PM2 status: `pm2 status`

---

## 🚀 QUICK FIX SCRIPT:

```bash
#!/bin/bash
# quick-fix-mikrotik-setup.sh

echo "🔧 Fixing Mikrotik Setup..."

# Stop server
pm2 stop billing-system

# Compile TypeScript
npm run build

# Create system_settings table
mysql -u root -p billing_db <<EOF
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO system_settings (setting_key, setting_value, category) VALUES
('prepaid_portal_url', 'http://192.168.239.126:3000', 'prepaid');
EOF

# Start server
pm2 start billing-system

echo "✅ Done! Try access /prepaid/mikrotik-setup again"
```

Save sebagai `quick-fix.sh` dan run:
```bash
chmod +x quick-fix.sh
./quick-fix.sh
```

---

**Restart server dulu, lalu test simple route! 🔍**

