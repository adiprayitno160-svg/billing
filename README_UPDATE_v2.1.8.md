# 🔄 Cara Update ke v2.1.8

## ❓ Masalah
Aplikasi di server live masih menampilkan versi **2.1.6** di halaman About, padahal di GitHub sudah ada versi terbaru **2.1.7** dan **2.1.8**.

## ✅ Solusi

### Opsi 1: Update via Script (Recommended)

**Untuk server Linux/Ubuntu:**

```bash
# 1. Upload script ke server
scp update-to-2.1.8.sh user@your-server:/opt/billing/

# 2. SSH ke server
ssh user@your-server

# 3. Jalankan script
cd /opt/billing
chmod +x update-to-2.1.8.sh
./update-to-2.1.8.sh

# 4. Selesai! ✅
```

### Opsi 2: Update Manual (Step by Step)

```bash
# 1. SSH ke server
ssh user@your-server
cd /opt/billing

# 2. Pull latest code
git pull origin main

# 3. Cek versi (harus 2.1.8)
cat VERSION

# 4. Install dependencies
npm install --production --no-audit --no-fund

# 5. Build aplikasi
npm run build

# 6. Restart PM2 (penting!)
pm2 restart billing-app --update-env

# 7. Cek status
pm2 status
pm2 logs billing-app --lines 30

# 8. Selesai! ✅
```

### Opsi 3: Update via Web Interface (jika tersedia)

1. Login ke aplikasi sebagai admin
2. Buka halaman: `http://your-server:3000/about`
3. Klik tombol **"Cek Update"**
4. Jika ada update, klik **"Update Sekarang"**
5. Tunggu proses selesai
6. Aplikasi akan restart otomatis

## 🔍 Verifikasi

### Cek Versi
Buka: `http://your-server:3000/about`

**Harus menunjukkan:**
- ✅ Versi Saat Ini: **2.1.8**
- ✅ Versi Terbaru: **2.1.8**

### Test Fitur
1. Import Excel dengan header variasi
2. Cek apakah nomor telepon ter-cleaning dengan benar
3. Pastikan tidak ada error di logs

## ⚠️ Troubleshooting

### Versi Tetap 2.1.6 Setelah Update

**Penyebab:** Cache browser atau build lama

**Solusi:**

1. **Clear cache browser:**
   - Tekan `Ctrl + Shift + R` (hard refresh)
   - Atau hapus cache browser

2. **Clear dan rebuild:**
   ```bash
   cd /opt/billing
   rm -rf dist node_modules
   npm install --production
   npm run build
   pm2 restart billing-app --update-env
   ```

3. **Check file VERSION:**
   ```bash
   cat VERSION VERSION_MAJOR VERSION_HOTFIX
   # Semua harus: 2.1.8
   ```

### Build Error

```bash
# Clear node_modules
rm -rf node_modules package-lock.json

# Install ulang
npm install --production --no-audit --no-fund

# Build
npm run build
```

### PM2 Error

```bash
# Stop dan hapus
pm2 stop billing-app
pm2 delete billing-app

# Start ulang
pm2 start ecosystem.config.js --env production

# Save
pm2 save
```

## 📊 Perubahan di v2.1.8

| Item | Perubahan |
|------|-----------|
| Excel Import | ✅ Header normalization lebih robust |
| Phone Cleaning | ✅ Hapus dots berlebih |
| Variasi Header | ✅ Support lebih banyak format |

## 📚 Dokumentasi Lengkap

Lihat: `DEPLOY_v2.1.8.md` untuk panduan lengkap

---

**Release:** v2.1.8  
**Date:** 30 Oktober 2025  
**Status:** ✅ Production Ready

