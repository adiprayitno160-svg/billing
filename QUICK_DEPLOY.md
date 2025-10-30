# ⚡ Quick Deploy Guide v2.1.5

## 🎯 Masalah & Solusi

| Masalah | Penyebab | Sudah Fixed? |
|---------|----------|--------------|
| Versi masih 2.1.4 | VERSION_MAJOR tidak terupdate | ✅ YES |
| Hotfix 404 | Perlu git pull + restart | ✅ YES |

---

## 🚀 Deploy Sekarang (Copy-Paste)

```bash
# Di server, jalankan command ini:
cd /path/to/billing && \
git pull origin main && \
cat VERSION_MAJOR && \
pm2 restart billing && \
pm2 logs billing --lines 20
```

**Expected Output:**
```
VERSION_MAJOR: 2.1.5
PM2: billing restarted
```

---

## ✅ Verifikasi

Buka browser: `http://your-server:3000/about`

**Harus tampil:**
- Versi Saat Ini: **2.1.5** ✅
- Versi Terbaru: **2.1.5** ✅
- Tombol "Cek Hotfix" berfungsi ✅

---

## 🔧 Jika Masih 2.1.4

```bash
# Force update version files
echo "2.1.5" > VERSION_MAJOR
echo "2.1.5" > VERSION_HOTFIX
pm2 restart billing
```

Then clear browser cache & reload.

---

## 📞 Need Help?

```bash
# Check logs
pm2 logs billing

# Check files
cat VERSION VERSION_MAJOR VERSION_HOTFIX

# Check PM2
pm2 status
```


