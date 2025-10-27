# 🔧 Quick Fix Guide

## Masalah yang Sudah Diperbaiki

### ✅ 1. Crash Loop: `Can't DROP COLUMN parent_queue_name`

**Masalah:**
```
Failed to start server: Error: Can't DROP COLUMN `parent_queue_name`; check that it exists
```

**Fix:**
- ✅ `src/db/pool.ts` sudah diupdate dengan `DROP COLUMN IF EXISTS`
- ✅ Migration SQL otomatis menambahkan column jika diperlukan
- ✅ Error handling diperbaiki untuk MariaDB compatibility

---

### ✅ 2. Missing Columns Errors

**Masalah:**
```
Unknown column 'pps.last_notified_at' in 'WHERE'
Unknown column 'mal.list_name' in 'WHERE'
```

**Fix:**
- ✅ Migration SQL `migrations/fix_missing_columns.sql` otomatis dijalankan saat install
- ✅ Menambahkan:
  - `prepaid_package_subscriptions.last_notified_at`
  - `mikrotik_address_list_items.list_name`
  - `static_ip_packages.parent_queue_name` (temporary untuk migration)

---

### ✅ 3. MariaDB Collation Error

**Masalah:**
```
Unknown collation: 'utf8mb4_0900_ai_ci'
```

**Fix:**
- ✅ `docs/billing.sql` sudah diupdate dengan `utf8mb4_unicode_ci`
- ✅ Compatible dengan MariaDB 10.x

---

## 🚀 Cara Deploy Ulang (Fresh Install)

### **Opsi 1: Auto Installer (Recommended)**

```bash
# Fresh install dengan semua fix
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-debian-tested.sh | bash
```

---

### **Opsi 2: Manual Update (Existing Installation)**

Jika sudah install sebelumnya dan mau update:

```bash
# 1. Stop aplikasi
pm2 stop billing-app

# 2. Pull update terbaru
cd /opt/billing
git pull origin main

# 3. Run migration SQL
mysql -u billing_user -pBilling123! billing < migrations/fix_missing_columns.sql

# 4. Build ulang
npm install
npm run build

# 5. Restart aplikasi
pm2 restart billing-app
pm2 logs billing-app --lines 30
```

---

### **Opsi 3: Fix Manual (Jika Masih Error)**

Jika masih ada error setelah update:

```bash
# Stop aplikasi
pm2 stop billing-app
pm2 delete billing-app

# Fix database manual
mysql -u billing_user -pBilling123! billing << 'EOF'
ALTER TABLE static_ip_packages ADD COLUMN IF NOT EXISTS parent_queue_name VARCHAR(255) NULL;
ALTER TABLE prepaid_package_subscriptions ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP NULL;
ALTER TABLE mikrotik_address_list_items ADD COLUMN IF NOT EXISTS list_name VARCHAR(255) NULL;
EOF

# Build ulang
cd /opt/billing
npm run build

# Start dengan PM2
pm2 start dist/server.js --name billing-app -i 1
pm2 save

# Monitor logs
pm2 logs billing-app
```

---

## 📊 Verifikasi Setelah Fix

### **1. Cek PM2 Status (Harus Online)**

```bash
pm2 status
```

**Expected:**
```
┌────┬─────────────┬─────────┬─────┬──────────┬─────────┬─────────┐
│ id │ name        │ mode    │ ↺   │ status   │ cpu     │ memory  │
├────┼─────────────┼─────────┼─────┼──────────┼─────────┼─────────┤
│ 0  │ billing-app │ cluster │ 0   │ online   │ 0%      │ 100mb   │
└────┴─────────────┴─────────┴─────┴──────────┴─────────┴─────────┘
```

**⚠️ Jika `↺` (restart count) > 10:**
- Aplikasi crash loop
- Lihat logs: `pm2 logs billing-app --err`

---

### **2. Cek Logs (Harus Ada "Server running")**

```bash
pm2 logs billing-app --lines 30
```

**Expected:**
```
Server running on http://localhost:3000
WebSocket available at ws://localhost:3000/ws
```

**❌ Jika ada error:**
- Paste error ke issue GitHub
- Atau hubungi support

---

### **3. Test Akses HTTP**

```bash
curl -I http://localhost:3000
```

**Expected:**
```
HTTP/1.1 200 OK
```

---

### **4. Test dari Browser**

Buka browser (Firefox Private Mode atau Chrome):

```
http://192.168.239.126:3000
```

**Expected:**
- ✅ Halaman login muncul
- ✅ Icon normal (tidak besar)
- ✅ Tidak ada SSL error

**⚠️ Jika SSL Error:**
- Gunakan `http://` (bukan `https://`)
- Clear browser cache/HSTS

---

## 🐛 Troubleshooting

### **Icon Besar di Dashboard**

```bash
cd /opt/billing
npx tailwindcss -i ./src/styles/tailwind.css -o ./public/assets/styles.css --minify
```

Lalu **hard refresh browser:** `Ctrl + Shift + R`

---

### **Browser Auto-Redirect ke HTTPS**

**Firefox:**
1. `about:networking#hsts`
2. Ketik: `192.168.239.126`
3. Klik "Delete"

**Atau gunakan Private Mode:** `Ctrl + Shift + P`

---

### **PM2 Crash Loop (Restart Terus)**

```bash
# Stop PM2
pm2 stop billing-app

# Cek logs error
pm2 logs billing-app --err --lines 100

# Test manual
cd /opt/billing
NODE_ENV=production node dist/server.js
```

Manual test akan **show error langsung** di terminal.

---

## 📞 Support

Jika masih ada masalah setelah fix:

1. **Cek GitHub Issues:** https://github.com/adiprayitno160-svg/billing/issues
2. **Buat Issue Baru** dengan info:
   - OS: `Debian 12`
   - Node.js version: `node -v`
   - Error logs: `pm2 logs billing-app --err`
   - Database: `MariaDB 10.x`

---

## ✅ Checklist Install

- [ ] Node.js v20 installed
- [ ] MariaDB running
- [ ] Database `billing` created
- [ ] User `billing_user` created with password `Billing123!`
- [ ] Repository cloned to `/opt/billing`
- [ ] `.env` file configured
- [ ] Database imported (`docs/billing.sql`)
- [ ] Migration applied (`migrations/fix_missing_columns.sql`)
- [ ] Dependencies installed (`npm install`)
- [ ] Application built (`npm run build`)
- [ ] PM2 started (`pm2 start dist/server.js`)
- [ ] Firewall configured (port 3000)
- [ ] Browser access: `http://YOUR_IP:3000`
- [ ] Login successful (admin/admin123)

---

**Last Updated:** 2025-10-27  
**Version:** 2.0 (Fixed)

