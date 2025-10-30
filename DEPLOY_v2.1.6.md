# 🚀 Deploy Guide v2.1.6

## ✨ What's New in v2.1.6

### UX Improvement
- ✅ **Removed annoying debug alerts** from Import Excel
- ✅ Import now runs **smoothly without popup interruptions**
- ✅ Better user experience

---

## 📦 Quick Deploy (Copy-Paste)

```bash
# Di server, jalankan command ini:
cd /path/to/billing && \
git pull origin main && \
cat VERSION && \
npm run build && \
pm2 restart billing && \
echo "✅ Deploy v2.1.6 complete!" && \
pm2 logs billing --lines 20
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
cat VERSION          # Should show: 2.1.6
cat VERSION_MAJOR    # Should show: 2.1.6
cat VERSION_HOTFIX   # Should show: 2.1.6
```

### 4. Install Dependencies (Optional)
```bash
npm install --production
```

### 5. Build TypeScript
```bash
npm run build
```

### 6. Restart PM2
```bash
pm2 restart billing
```

### 7. Check Status
```bash
pm2 status
pm2 logs billing --lines 30
```

---

## ✅ Verification

### Test Import Excel UX
1. Buka browser: `http://your-server:3000/customers/list`
2. Klik tombol **"Import Excel"**
3. **Expected:** ✅ Modal langsung muncul, **TIDAK ada alert popup**
4. Upload file Excel
5. **Expected:** ✅ Import berjalan smooth, progress indicator muncul
6. **Expected:** ✅ Success message muncul setelah selesai

### Check Version
Buka: `http://your-server:3000/about`

**Expected:**
- Versi Saat Ini: **2.1.6** ✅
- Versi Terbaru: **2.1.6** ✅

---

## 🔧 Troubleshooting

### Import Masih Gagal?

**Option 1: Run Diagnostic**
```bash
chmod +x diagnose-import-live.sh
./diagnose-import-live.sh
```

**Option 2: Auto Fix**
```bash
chmod +x fix-import-live.sh
./fix-import-live.sh
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
pm2 restart billing
```

### Check Logs
```bash
# Real-time logs
pm2 logs billing

# Filter import-related logs
pm2 logs billing | grep -i "import\|excel\|multer"

# Last 100 lines
pm2 logs billing --lines 100 --nostream
```

---

## 📊 Comparison

| Feature | v2.1.5 | v2.1.6 |
|---------|--------|--------|
| Import Excel | ✅ Works | ✅ Works |
| Debug Alerts | ❌ Annoying | ✅ Removed |
| UX | Good | ✅ Better |
| Performance | Fast | Fast |

---

## 🎯 Testing Checklist

- [ ] Deploy successful
- [ ] Version shows 2.1.6
- [ ] Import Excel opens modal without alert
- [ ] Import Excel succeeds
- [ ] Bulk Delete works
- [ ] Hotfix checker works
- [ ] No errors in PM2 logs

---

## 🔄 Rollback (If Needed)

```bash
# Rollback to v2.1.5
git checkout v2.1.5
npm install --production
npm run build
pm2 restart billing
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
pm2 logs billing --lines 50

# Restart if needed
pm2 restart billing
```

### Files Updated in v2.1.6
- `VERSION`, `VERSION_MAJOR`, `VERSION_HOTFIX` → 2.1.6
- `package.json` → 2.1.6
- `views/customers/list.ejs` → Removed debug alerts
- `CHANGELOG_v2.1.6.md` → Release notes
- `diagnose-import-live.sh` → New diagnostic tool
- `fix-import-live.sh` → New auto-fix tool

---

**Release:** v2.1.6  
**Date:** 30 Oktober 2025  
**Type:** UX Improvement  
**Status:** ✅ Production Ready  
**Breaking Changes:** None

**GitHub Release:** https://github.com/adiprayitno160-svg/billing/releases/tag/v2.1.6

