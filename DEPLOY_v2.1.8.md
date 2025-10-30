# 🚀 Deploy Guide v2.1.8

## ✨ What's New in v2.1.8

### Excel Import Improvements
- ✅ **Enhanced header normalization** untuk deteksi kolom telepon yang lebih robust
- ✅ **Removes NBSP, dots, underscores** dari header
- ✅ **Case-insensitive matching** - lowercase semua header
- ✅ **Fusion spaces** - gabungkan multiple spaces jadi satu
- ✅ **Phone number cleaning** - hapus dots selain spaces & dash
- ✅ **Support lebih banyak varian**: "Nomor Telepon", "No. Telepon", "No Telp", "Telp", "Tlp", "HP", dst.

---

## 📦 Quick Deploy (Copy-Paste)

```bash
# Di server, jalankan command ini:
cd /path/to/billing && \
git pull origin main && \
cat VERSION && \
npm install --production && \
npm run build && \
pm2 restart billing-app && \
echo "✅ Deploy v2.1.8 complete!" && \
pm2 logs billing-app --lines 20
```

---

## 📋 Step-by-Step Deployment

### 1. Masuk ke Server
```bash
ssh user@your-server
cd /path/to/billing
```

### 2. Pull Latest Changes
```bash
git pull origin main
```

### 3. Verify Version
```bash
cat VERSION          # Should show: 2.1.8
cat VERSION_MAJOR    # Should show: 2.1.8
cat VERSION_HOTFIX   # Should show: 2.1.8
```

### 4. Install Dependencies
```bash
npm install --production --no-audit --no-fund
```

### 5. Build TypeScript
```bash
npm run build
```

### 6. Restart PM2
```bash
pm2 restart billing-app
```

### 7. Check Status
```bash
pm2 status
pm2 logs billing-app --lines 30
```

---

## ✅ Verification

### Test Excel Import dengan Header Variasi
1. Buka browser: `http://your-server:3000/customers/list`
2. Klik tombol **"Import Excel"**
3. Upload file Excel dengan header variasi seperti:
   - "Nomor Telepon"
   - "No. Telepon" 
   - "No Telp"
   - "Telp"
   - "HP"
4. **Expected:** ✅ Import berhasil, tidak ada "Berhasil 0 / Gagal N"
5. **Expected:** ✅ Nomor telepon ter-cleaning dengan benar (tanpa dots berlebih)

### Check Version
Buka: `http://your-server:3000/about`

**Expected:**
- Versi Saat Ini: **2.1.8** ✅
- Versi Terbaru: **2.1.8** ✅

---

## 🔧 Troubleshooting

### Version Tetap Menunjukkan 2.1.6

**Masalah:** Setelah update, halaman About masih menunjukkan versi 2.1.6

**Solusi:**

1. **Clear cache dan rebuild:**
```bash
cd /path/to/billing
rm -rf dist node_modules
npm install --production
npm run build
pm2 restart billing-app --update-env
```

2. **Check file VERSION:**
```bash
cat VERSION VERSION_MAJOR VERSION_HOTFIX
# Semua harus menunjukkan: 2.1.8
```

3. **Hard refresh browser:**
- Tekan `Ctrl + Shift + R` (Windows/Linux)
- Tekan `Cmd + Shift + R` (Mac)

4. **Clear browser cache:**
- Chrome: Settings → Privacy → Clear browsing data → Cached images and files

---

### Import Masih Gagal?

**Option 1: Run Diagnostic**
```bash
chmod +x diagnose-import-live.sh
./diagnose-import-live.sh
```

**Option 2: Check Logs**
```bash
# Real-time logs
pm2 logs billing-app

# Filter import-related logs
pm2 logs billing-app | grep -i "import\|excel\|multer"

# Last 100 lines
pm2 logs billing-app --lines 100 --nostream
```

**Option 3: Manual Fix**
```bash
# Fix uploads folder
mkdir -p uploads
chmod 755 uploads

# Fix Nginx (if using nginx)
sudo nano /etc/nginx/nginx.conf
# Add: client_max_body_size 10M;
sudo systemctl reload nginx

# Restart PM2
pm2 restart billing-app --update-env
```

---

## 📊 Comparison

| Feature | v2.1.6 | v2.1.7 | v2.1.8 |
|---------|--------|--------|--------|
| Import Excel | ✅ Works | ✅ Works | ✅ Works |
| Header Variasi | Basic | ✅ Enhanced | ✅ **Robust** |
| Phone Cleaning | Basic | Basic | ✅ **Enhanced** |
| Debug Alerts | ✅ Removed | ✅ Removed | ✅ Removed |
| UX | Good | Good | ✅ Best |

---

## 🎯 Testing Checklist

- [ ] Deploy successful
- [ ] Version shows **2.1.8** ✅
- [ ] Import Excel works with "Nomor Telepon"
- [ ] Import Excel works with "No. Telepon"
- [ ] Import Excel works with "Telp"
- [ ] Phone number cleaning removes dots
- [ ] Bulk Delete works
- [ ] Hotfix checker works
- [ ] No errors in PM2 logs

---

## 🔄 Rollback (If Needed)

```bash
# Rollback to v2.1.7
git checkout v2.1.7
npm install --production
npm run build
pm2 restart billing-app

# Or rollback to v2.1.6
git checkout v2.1.6
npm install --production
npm run build
pm2 restart billing-app
```

---

## 📞 Support

### Quick Commands
```bash
# Check version
cat VERSION VERSION_MAJOR VERSION_HOTFIX

# Check PM2 status
pm2 status

# View logs
pm2 logs billing-app --lines 50

# Restart if needed
pm2 restart billing-app --update-env

# Hard reload
pm2 reload billing-app --update-env
```

### Files Updated in v2.1.8
- `VERSION`, `VERSION_MAJOR`, `VERSION_HOTFIX` → 2.1.8
- `package.json` → 2.1.8
- `src/controllers/customerController.ts` → Enhanced header normalization
- `CHANGELOG_v2.1.8.md` → Release notes

---

**Release:** v2.1.8  
**Date:** 30 Oktober 2025  
**Type:** Excel Import Enhancement  
**Status:** ✅ Production Ready  
**Breaking Changes:** None  
**Requires Rebuild:** ✅ Yes

**GitHub Release:** https://github.com/adiprayitno160-svg/billing/releases/tag/v2.1.8

