# 📋 Instruksi Deployment v2.1.5

## 🎯 Masalah yang Diperbaiki

### 1. **Versi Masih Menunjukkan 2.1.4**
**Penyebab:** File `VERSION_MAJOR` dan `VERSION_HOTFIX` tidak terupdate

**Solusi:** 
- ✅ Update `VERSION_MAJOR` dari `2.1.4` → `2.1.5`
- ✅ Update `VERSION_HOTFIX` dari `2.1.4` → `2.1.5`

### 2. **Hotfix Menu 404 Not Found**
**Penyebab:** Route sudah benar, tapi server belum di-restart atau file belum ter-pull

**Solusi:**
- ✅ Pull latest dari GitHub
- ✅ Restart PM2

---

## 🚀 Cara Deploy di Server Live

### Method 1: Menggunakan Script Otomatis

```bash
# 1. Masuk ke direktori aplikasi
cd /path/to/billing

# 2. Pull script terbaru
git pull origin main

# 3. Beri permission untuk execute script
chmod +x deploy-v2.1.5.sh

# 4. Jalankan script
./deploy-v2.1.5.sh
```

### Method 2: Manual Step-by-Step

```bash
# 1. Masuk ke direktori aplikasi
cd /path/to/billing

# 2. Pull latest changes
git pull origin main

# 3. Verifikasi version files
cat VERSION          # Should show: 2.1.5
cat VERSION_MAJOR    # Should show: 2.1.5
cat VERSION_HOTFIX   # Should show: 2.1.5

# 4. Install dependencies (optional, only if package.json changed)
npm install --production

# 5. Build TypeScript
npm run build

# 6. Restart PM2
pm2 restart billing

# 7. Check status
pm2 status
pm2 logs billing --lines 50
```

---

## ✅ Verifikasi Deployment

### 1. Cek Versi di About Page

Buka di browser:
```
http://your-server-ip:3000/about
```

**Expected:**
- Versi Saat Ini: **2.1.5** ✅
- Versi Terbaru: **2.1.5** ✅

### 2. Test Hotfix Checker

Di halaman About, klik tombol **"Cek Hotfix"**

**Expected:**
- ✅ Tidak ada error JSON.parse
- ✅ Menampilkan modal dengan info hotfix
- ✅ Jika tidak ada hotfix: "Tidak Ada Hotfix - Anda menggunakan versi terbaru"

### 3. Test Import Excel

1. Buka `/customers/list`
2. Klik **"Import Excel"**
3. Upload file Excel
4. **Expected:** Import berhasil tanpa error

### 4. Test Bulk Delete

1. Buka `/customers/list`
2. Centang beberapa customer
3. Klik **"Hapus Terpilih"**
4. **Expected:** Bar merah muncul, delete berfungsi dengan validasi

---

## 🔧 Troubleshooting

### Masalah: Versi Masih 2.1.4 Setelah Deploy

```bash
# Cek file version
cat VERSION          # Harus 2.1.5
cat VERSION_MAJOR    # Harus 2.1.5
cat VERSION_HOTFIX   # Harus 2.1.5

# Jika salah satu masih 2.1.4, update manual:
echo "2.1.5" > VERSION_MAJOR
echo "2.1.5" > VERSION_HOTFIX

# Restart PM2
pm2 restart billing

# Clear browser cache dan reload halaman /about
```

### Masalah: Hotfix 404 Not Found

```bash
# Cek apakah file controller ada
ls -la src/controllers/aboutController.ts

# Cek apakah routes ter-load
grep "checkHotfix" src/routes/index.ts

# Restart PM2 dengan reload full
pm2 delete billing
pm2 start ecosystem.config.js

# Atau restart semua
pm2 restart all
```

### Masalah: Import Excel Gagal di Production

```bash
# Cek logs
pm2 logs billing | grep -i "import\|excel\|multer"

# Pastikan folder uploads ada
mkdir -p uploads
chmod 755 uploads

# Cek file size limit di nginx (jika pakai nginx)
# Edit /etc/nginx/nginx.conf
client_max_body_size 10M;

# Restart nginx
sudo systemctl restart nginx
```

### Masalah: PM2 Tidak Bisa Restart

```bash
# Cek status PM2
pm2 status

# Jika error, delete dan start ulang
pm2 delete billing
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
# Jalankan command yang muncul (biasanya dengan sudo)
```

---

## 📊 Monitoring Setelah Deploy

```bash
# Real-time logs
pm2 logs billing

# Status aplikasi
pm2 status

# Memory & CPU usage
pm2 monit

# Restart count dan uptime
pm2 info billing
```

---

## 🔄 Rollback (Jika Diperlukan)

Jika ada masalah serius, rollback ke versi sebelumnya:

```bash
# Checkout ke tag sebelumnya
git checkout v2.1.4

# Install dependencies
npm install --production

# Build
npm run build

# Restart PM2
pm2 restart billing
```

---

## 📞 Support

Jika masih ada masalah:

1. **Cek Logs:**
   ```bash
   pm2 logs billing --lines 100
   ```

2. **Cek Git Status:**
   ```bash
   git status
   git log -n 5 --oneline
   ```

3. **Cek File Versions:**
   ```bash
   cat VERSION VERSION_MAJOR VERSION_HOTFIX
   ```

4. **Contact:** Kirim screenshot error + output dari command di atas

---

## ✨ Fitur Baru di v2.1.5

1. ✅ **Bulk Delete Customers** - Hapus multiple customers dengan validasi
2. ✅ **Import Excel Fix** - Production-ready dengan better error handling
3. ✅ **Hotfix Checker Fix** - No more JSON.parse errors
4. ✅ **Better Logging** - Improved debugging di production

---

**Last Updated:** 30 Oktober 2025  
**Version:** 2.1.5  
**Status:** ✅ Production Ready



