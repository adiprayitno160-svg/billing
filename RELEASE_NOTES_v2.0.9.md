# 🚀 Release v2.0.9 - Simple Import Excel

**Release Date:** October 30, 2025

---

## 🎯 What's New

### ⭐ **Simplified Customer Import (3 Columns Only!)**

Import customer sekarang **SUPER MUDAH**! Hanya butuh 3 kolom:

```
Nama | Telepon | Alamat
```

Field lain (email, paket, status) bisa diisi manual setelah import. **No more complicated templates!**

---

## ✨ Key Features

### 📥 **3-Column Import Format**
- ✅ **Nama** - Wajib diisi
- ✅ **Telepon** - Wajib diisi (harus unik)
- ✅ **Alamat** - Opsional

**Auto-defaults:**
- Status: `inactive` (edit manual untuk activate)
- Connection Type: `pppoe` (edit manual jika static IP)
- Email: kosong (isi manual jika perlu)

### 📊 **Enhanced Logging & Debugging**
- **Real-time logging** untuk setiap baris yang diproses
- **Error messages** yang jelas dan spesifik
- **Column detection** otomatis (deteksi jika kolom salah)
- **Duplicate detection** dengan pesan informatif

### 🚀 **Auto-Deploy Scripts**
- **Windows Batch:** Double-click `AUTO-DEPLOY-SIMPLE-IMPORT.bat`
- **PowerShell:** Run `deploy-simple-import.ps1`
- **Diagnostic Tool:** `CHECK-IMPORT-ERROR.ps1` untuk auto-check errors

---

## 📋 How to Use

### **1. Create Excel File**

| Nama | Telepon | Alamat |
|------|---------|--------|
| John Doe | 08123456789 | Jl. Merdeka No. 123 |
| Jane Smith | 08234567890 | Jl. Sudirman No. 456 |

Save as: `customers.xlsx`

### **2. Upload**
- Go to: `/customers/list`
- Click: **"📥 Import Excel"**
- Select your file
- Click: **"Import Data"**

### **3. Monitor (Optional)**
```bash
pm2 logs billing-app --lines 0
```

You'll see detailed logs for each row!

---

## 🔄 Upgrade Instructions

### **Quick Deploy (One Command)**
```bash
ssh root@YOUR_IP "cd /opt/billing && git pull origin main && npm run build && pm2 restart billing-app"
```

### **Or Use Auto-Deploy Script**
1. Edit `DEPLOY-SEKARANG.bat` (set your server IP)
2. Double-click to deploy
3. Done! ✅

---

## 📖 Documentation

### **New Guides Added:**
- `TEMPLATE_IMPORT_EXCEL_SIMPLE.txt` - Excel template & format
- `DEPLOY_SIMPLE_IMPORT_NOW.txt` - Deployment guide
- `CARA_DEPLOY_OTOMATIS.md` - Comprehensive deployment docs
- `TROUBLESHOOTING_IMPORT_GAGAL.txt` - Complete troubleshooting
- `DEPLOY-CEPAT.txt` - Quick deploy commands

### **New Tools:**
- `CHECK-IMPORT-ERROR.ps1` - Auto-diagnostic script
- `AUTO-DEPLOY-SIMPLE-IMPORT.bat` - One-click deploy (Windows)
- `deploy-simple-import.ps1` - Advanced deploy (PowerShell)
- `DEPLOY-SEKARANG.bat` - Quick deploy script

---

## 🐛 Bug Fixes

- ✅ Fixed: Import gagal semua jika nama kolom tidak sesuai
- ✅ Fixed: Error message tidak informatif
- ✅ Fixed: Email validation blocking imports
- ✅ Fixed: "column cannot be null" database errors
- ✅ Fixed: No detailed logging for debugging

---

## 🎯 Example Success Log

```log
📝 Processing row 2: {
  Nama: 'John Doe',
  Telepon: '08123456789',
  Alamat: 'Jl. Merdeka No. 123',
  All keys in Excel: 'Nama, Telepon, Alamat'
}
  ✅ Validation passed: Nama dan Telepon OK
  🔍 Checking phone: "08123456789"
  ✅ Phone OK - No duplicate found
  💾 Inserting customer (SIMPLE): {
    name: 'John Doe',
    phone: '08123456789',
    address: 'Jl. Merdeka No. 123'
  }
  ✅ SUCCESS: Row 2 imported!

📊 Import completed: 1 success, 0 failed
```

---

## ⚠️ Breaking Changes

**None!** Backward compatible with old Excel format.

Old format (with Email, Kode Pelanggan, etc.) still works, but new simplified format is recommended.

---

## 📦 Download

**Full Release:** [Download v2.0.9](https://github.com/adiprayitno160-svg/billing/archive/refs/tags/v2.0.9.zip)

**Quick Commands:**
```bash
# Clone repository
git clone https://github.com/adiprayitno160-svg/billing.git
cd billing
git checkout v2.0.9

# Or update existing
git pull origin main
git checkout v2.0.9
npm install
npm run build
pm2 restart billing-app
```

---

## 🔗 Links

- **Full Changelog:** [CHANGELOG_v2.0.9.md](CHANGELOG_v2.0.9.md)
- **Deployment Guide:** [CARA_DEPLOY_OTOMATIS.md](CARA_DEPLOY_OTOMATIS.md)
- **Troubleshooting:** [TROUBLESHOOTING_IMPORT_GAGAL.txt](TROUBLESHOOTING_IMPORT_GAGAL.txt)
- **Template Excel:** [TEMPLATE_IMPORT_EXCEL_SIMPLE.txt](TEMPLATE_IMPORT_EXCEL_SIMPLE.txt)

---

## 💡 Tips

1. ✅ **Start simple:** Test with 2-3 rows first
2. ✅ **Use unique phone numbers:** Each customer needs unique phone
3. ✅ **Monitor logs:** Watch `pm2 logs` during import for debugging
4. ✅ **Edit later:** Don't worry about missing fields, edit manually after import

---

## 📞 Support

Having issues?

1. **Run diagnostic tool:**
   ```powershell
   .\CHECK-IMPORT-ERROR.ps1
   ```

2. **Read troubleshooting guide:**
   `TROUBLESHOOTING_IMPORT_GAGAL.txt`

3. **Check logs:**
   ```bash
   pm2 logs billing-app --lines 50
   ```

---

## 🎉 Summary

- ✅ Import customer dengan 3 kolom saja
- ✅ Logging detail untuk debugging
- ✅ Auto-deploy scripts untuk kemudahan
- ✅ Documentation lengkap
- ✅ Backward compatible

**Upgrade sekarang untuk pengalaman import yang lebih mudah!**

---

**Previous Release:** [v2.0.8.5](https://github.com/adiprayitno160-svg/billing/releases/tag/v2.0.8.5)  
**Next Release:** TBA

---

**🚀 Made with ❤️ for easier customer management**

