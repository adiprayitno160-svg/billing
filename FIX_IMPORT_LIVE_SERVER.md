# 🔧 FIX IMPORT GAGAL DI LIVE SERVER

## Problem
- Import di **local server**: ✅ Berhasil
- Import di **live server**: ❌ Berhasil 0, Gagal 27
- File Excel yang **SAMA**

## Root Cause
Live server kemungkinan:
1. ❌ Code belum di-rebuild (masih pakai dist/ lama)
2. ❌ PM2 belum restart dengan code terbaru
3. ❌ Case sensitivity kolom Excel (Windows vs Linux)

## Quick Fix - Jalankan di Live Server

### Option 1: SSH Manual
```bash
# 1. SSH ke live server
ssh user@your-live-server-ip

# 2. Masuk ke folder project
cd /path/to/billing

# 3. Backup dulu
git stash

# 4. Pull code terbaru
git pull origin main

# 5. Install dependencies (jika ada update)
npm install

# 6. Rebuild TypeScript
npm run build

# 7. Restart PM2
pm2 restart billing-app
# atau
pm2 reload billing-app

# 8. Cek logs
pm2 logs billing-app --lines 50
```

### Option 2: Pakai Script Auto-Deploy
```bash
# Di local, jalankan:
./deploy.ps1
# atau
./auto-deploy.ps1
```

## Verifikasi Setelah Deploy

### 1. Cek PM2 Status
```bash
pm2 list
pm2 logs billing-app --lines 100
```

### 2. Cek Log Import
```bash
# Saat import, lihat log real-time
pm2 logs billing-app --lines 0

# Di log, harus muncul:
# "📂 Processing Excel file: namafile.xlsx"
# "🔍 First row columns: Nama, Telepon, Alamat"
# "📋 Row 2: Nama="...", Telepon="...", Alamat="...""
```

### 3. Test Import Lagi
- Upload file Excel yang sama
- Harusnya sekarang berhasil

## Debug Lebih Lanjut

### Cek Versi Code di Live
```bash
# Cek apakah file excelController sudah ada flexible column handling
grep -A 20 "const name =" dist/controllers/excelController.js

# Harus ada:
# row['Nama'] || row['nama'] || row['NAMA'] || row['Name'] || row['name']
```

### Cek Database Connection
```bash
# Di live server
mysql -u billing_user -p billing

# Test query
SELECT COUNT(*) FROM customers;
SHOW CREATE TABLE customers;
```

### Export Log untuk Debugging
```bash
# Di live server
pm2 logs billing-app --lines 500 --nostream > /tmp/import-error.log

# Download log
scp user@live-server:/tmp/import-error.log ./
```

## Prevention untuk Kedepannya

### 1. Tambahkan Version Check
Di halaman import, tambahkan display versi:
```
Version: 2.1.4 (Build: [timestamp])
```

### 2. Automated Testing
Buat test script untuk import sebelum deploy:
```bash
npm run test:import
```

### 3. Monitoring
Setup alert jika import gagal > 50%

## Troubleshooting Specific Errors

### Error: "Kolom Nama kosong atau tidak ditemukan"
**Penyebab:** Excel pakai kolom "NAME" atau "name" (lowercase)
**Fix:** Code sekarang sudah support case-insensitive

### Error: "Telepon sudah terdaftar"
**Penyebab:** Data duplicate di database
**Fix:** Normal validation, cek database:
```sql
SELECT name, phone FROM customers WHERE phone = '0812xxxxx';
```

### Error: "Database connection timeout"
**Penyebab:** DB server overload atau network issue
**Fix:** 
```bash
# Restart MySQL
sudo systemctl restart mysql

# Cek connection pool
pm2 restart billing-app
```

## Contact
Jika masih gagal setelah rebuild:
1. Cek PM2 logs: `pm2 logs billing-app`
2. Cek MySQL logs: `sudo tail -f /var/log/mysql/error.log`
3. Export sample Excel yang gagal untuk debugging

---
**Last Updated:** $(date)
**Version:** 2.1.4

