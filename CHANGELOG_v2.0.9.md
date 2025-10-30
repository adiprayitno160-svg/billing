# 📋 CHANGELOG - Version 2.0.9

**Release Date:** October 30, 2025  
**Type:** Feature Release - Simple Import Excel

---

## 🎯 HIGHLIGHTS

### ⭐ **Simple Import Excel (3 Kolom)**
Import customer sekarang jauh lebih mudah! Hanya butuh 3 kolom:
- ✅ **Nama** (wajib)
- ✅ **Telepon** (wajib)
- ✅ **Alamat** (opsional)

Field lain (email, paket, status) bisa diisi manual setelah import.

---

## ✨ NEW FEATURES

### 📥 **Simplified Customer Import**
- **3-Column Format:** Nama, Telepon, Alamat
- **Auto Defaults:** Status=inactive, connection_type=pppoe
- **Optional Fields:** Email, paket, dan field lain diisi manual
- **User-Friendly:** Format Excel lebih simple dan mudah dipahami

### 📊 **Enhanced Import Logging**
- **Detailed Per-Row Logging:** Log lengkap untuk setiap baris yang diproses
- **Clear Error Messages:** Error message spesifik untuk setiap kegagalan
- **Column Detection:** Auto-detect kolom Excel yang salah/tidak sesuai
- **Duplicate Detection:** Notifikasi jelas untuk nomor telepon duplicate
- **Real-time Monitoring:** Monitor proses import via PM2 logs

### 🚀 **Auto-Deploy Scripts**
- **Windows Batch:** `AUTO-DEPLOY-SIMPLE-IMPORT.bat` - double-click deploy
- **PowerShell:** `deploy-simple-import.ps1` - advanced deployment
- **Quick Deploy:** `DEPLOY-SEKARANG.bat` - instant deployment
- **Diagnostic Tool:** `CHECK-IMPORT-ERROR.ps1` - auto-check errors

---

## 🔧 IMPROVEMENTS

### 📝 **Import Validation**
- **Separated Validation:** Nama dan Telepon divalidasi terpisah
- **Better Error Messages:** Error message lebih informatif
- **Column Name Check:** Validasi nama kolom Excel (Nama vs Name)
- **Empty Field Detection:** Deteksi field kosong dengan pesan jelas

### 🎨 **UI/UX Updates**
- **Updated Modal:** Import modal menampilkan format 3 kolom
- **Tips Section:** Tip bahwa field lain bisa diisi manual
- **Simplified Instructions:** Instruksi import lebih ringkas
- **Format Example:** Contoh format Excel langsung di modal

### 📖 **Documentation**
- **TEMPLATE_IMPORT_EXCEL_SIMPLE.txt:** Template Excel lengkap
- **DEPLOY_SIMPLE_IMPORT_NOW.txt:** Panduan deployment
- **CARA_DEPLOY_OTOMATIS.md:** Comprehensive deployment guide
- **TROUBLESHOOTING_IMPORT_GAGAL.txt:** Troubleshooting lengkap
- **DEPLOY-CEPAT.txt:** Quick deploy commands

---

## 🐛 BUG FIXES

### ✅ **Import Error Handling**
- Fixed: Import gagal semua jika nama kolom tidak sesuai
- Fixed: Error message tidak informatif
- Fixed: Tidak ada logging detail untuk debugging
- Fixed: Email validation menyebabkan import gagal (sekarang opsional)

### ✅ **Database Constraints**
- Fixed: "column 'rate_limit_rx' cannot be null" error
- Fixed: Email duplicate check blocking imports
- Fixed: Default values tidak ter-set untuk field opsional

---

## 🔄 CHANGES

### **Backend Changes**
```typescript
// src/controllers/customerController.ts
- Simplified validation (only Nama + Telepon required)
- Removed email duplicate check
- Added detailed per-row logging
- Set default values (status=inactive, connection_type=pppoe)
```

### **Frontend Changes**
```ejs
// views/customers/list.ejs
- Updated import modal format description
- Changed from 4 fields to 3 fields
- Added tip about manual field entry
```

---

## 📋 UPGRADE NOTES

### **Migration Steps**
1. Update code via git pull
2. Rebuild TypeScript: `npm run build`
3. Restart PM2: `pm2 restart billing-app`
4. Test with 3-column Excel format

### **Excel Format Change**
**OLD FORMAT (4+ columns):**
```
Nama | Telepon | Email | Alamat | Kode Pelanggan | ...
```

**NEW FORMAT (3 columns):**
```
Nama | Telepon | Alamat
```

### **Backward Compatibility**
- ✅ Old Excel format (with Email, etc.) still works
- ✅ Existing imports not affected
- ✅ Can mix old and new format

---

## 📦 FILES CHANGED

### **Modified Files**
- `src/controllers/customerController.ts` - Simplified import logic
- `views/customers/list.ejs` - Updated import modal UI
- `package.json` - Version bump to 2.0.9
- `VERSION` - Updated to 2.0.9
- `VERSION_MAJOR` - Updated to 2.0.9

### **New Files**
- `AUTO-DEPLOY-SIMPLE-IMPORT.bat` - Auto-deploy script (Windows)
- `deploy-simple-import.ps1` - Auto-deploy script (PowerShell)
- `DEPLOY-SEKARANG.bat` - Quick deploy script
- `CHECK-IMPORT-ERROR.ps1` - Error diagnostic tool
- `TEMPLATE_IMPORT_EXCEL_SIMPLE.txt` - Simple import template
- `DEPLOY_SIMPLE_IMPORT_NOW.txt` - Deployment guide
- `CARA_DEPLOY_OTOMATIS.md` - Complete deployment docs
- `TROUBLESHOOTING_IMPORT_GAGAL.txt` - Troubleshooting guide
- `DEPLOY-CEPAT.txt` - Quick deploy commands
- `CHANGELOG_v2.0.9.md` - This changelog

---

## 🎯 TESTING GUIDE

### **Test Simple Import**
1. Create Excel with 3 columns: `Nama | Telepon | Alamat`
2. Fill 3-5 test rows
3. Upload at `/customers/list`
4. Monitor logs: `pm2 logs billing-app --lines 0`
5. Verify customers appear in table

### **Expected Result**
```
✅ Berhasil: 5, Gagal: 0
```

### **Log Example (Success)**
```
📝 Processing row 2: {
  Nama: 'John Doe',
  Telepon: '08123456789',
  Alamat: 'Jl. Merdeka No. 123'
}
  ✅ Validation passed
  ✅ Phone OK - No duplicate
  ✅ SUCCESS: Row 2 imported!
```

---

## 🚀 DEPLOYMENT

### **Quick Deploy (One-Liner)**
```bash
ssh root@YOUR_IP "cd /opt/billing && git pull origin main && npm run build && pm2 restart billing-app"
```

### **Auto-Deploy Script**
Windows users:
1. Edit `DEPLOY-SEKARANG.bat` (set your IP)
2. Double-click to deploy

PowerShell users:
```powershell
.\deploy-simple-import.ps1 -ServerUser "root" -ServerIP "YOUR_IP"
```

---

## 📊 STATISTICS

- **Files Changed:** 12 files
- **Lines Added:** ~1,200 lines
- **Lines Removed:** ~150 lines
- **New Scripts:** 5 deployment scripts
- **Documentation:** 5 new guides

---

## 🙏 ACKNOWLEDGMENTS

Thanks to all users for feedback on the import feature!

---

## 📞 SUPPORT

Need help?
- Read: `TROUBLESHOOTING_IMPORT_GAGAL.txt`
- Run: `CHECK-IMPORT-ERROR.ps1`
- Check logs: `pm2 logs billing-app`

---

## 🔗 LINKS

- **GitHub Repository:** https://github.com/adiprayitno160-svg/billing
- **Release Tag:** v2.0.9
- **Previous Release:** v2.0.8.5

---

**🎉 Happy Importing with Simple 3-Column Format!**

