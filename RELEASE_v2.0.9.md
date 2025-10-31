# 🚀 Release v2.0.9 - Excel Import & PPPoE Profile Management

**Release Date:** October 30, 2025  
**Status:** ✅ PRODUCTION READY

---

## 📋 SUMMARY

Major update focusing on Excel import fixes, PPPoE profile management, and MikroTik integration improvements.

---

## ✨ NEW FEATURES

### 1. **PPPoE Profile CRUD Management** 🔧
- ✅ Manual Create PPPoE Profile with burst limiting support
- ✅ Edit existing PPPoE profiles
- ✅ Delete PPPoE profiles
- ✅ Full burst limiting fields (RX/TX Burst, Threshold, Time)
- ✅ Color-coded table headers for better UX
- ✅ Sticky columns for better scrolling

### 2. **Enhanced MikroTik Sync** 🔄
- ✅ Improved burst data fetching from MikroTik
- ✅ Fallback mechanism for different RouterOS versions
- ✅ Detailed logging for debugging
- ✅ Support for `=detail=` flag in MikroTik API

---

## 🐛 BUG FIXES

### 1. **Excel Import Fixed** 📊
- ✅ Simplified validation (only Nama & Telepon required)
- ✅ Email & Alamat now optional
- ✅ Fixed "berhasil 0 gagal 20" error
- ✅ Added detailed import logging
- ✅ Removed "Template" buttons from UI
- ✅ Updated import modal with correct format

### 2. **PPPoE Package Creation Fixed** 📦
- ✅ Fixed "column 'rate_limit_rx' cannot be null" error
- ✅ Default rate limit set to '0' (unlimited) when empty
- ✅ Auto-fill rate/burst limits from selected profile

### 3. **Burst Limiting Data Loading** 🚀
- ✅ Fixed burst data not loading from MikroTik
- ✅ Implemented fallback parsing mechanism
- ✅ Support for separate burst-limit fields
- ✅ All burst columns now display correctly

### 4. **UI Improvements** 🎨
- ✅ Removed session timeout fields (not useful)
- ✅ Removed idle timeout fields (not useful)
- ✅ Better table layout for PPPoE profiles
- ✅ Added info boxes for burst limiting explanation

---

## 🗄️ DATABASE CHANGES

No schema changes required for this release.

---

## 📦 FILES CHANGED

### Controllers
- `src/controllers/customerController.ts` - Excel import logic improved
- `src/controllers/pppoeController.ts` - Added CRUD methods for profiles

### Services
- `src/services/pppoeService.ts` - Added createProfile, updateProfile, deleteProfile
- `src/services/mikrotikService.ts` - Enhanced burst data fetching with fallback

### Views
- `views/customers/list.ejs` - Removed template buttons, simplified import
- `views/packages/pppoe_profiles.ejs` - Added CRUD UI, burst columns
- `views/packages/pppoe_profile_form.ejs` - NEW: Profile form

### Routes
- `src/routes/index.ts` - Added PPPoE profile CRUD routes

### Configuration
- `VERSION` → 2.0.9
- `VERSION_MAJOR` → 2.0.9
- `package.json` → 2.0.9

---

## 🚀 DEPLOYMENT INSTRUCTIONS

### Option 1: Auto Deploy (One-Click)
```bash
ssh root@192.168.239.126 "cd /opt/billing && git pull origin main && npm run build && pm2 restart billing-app"
```

### Option 2: Step-by-Step
```bash
# 1. Connect to server
ssh root@192.168.239.126

# 2. Navigate to project
cd /opt/billing

# 3. Pull latest code
git pull origin main

# 4. Install dependencies (if needed)
npm install

# 5. Build TypeScript
npm run build

# 6. Restart application
pm2 restart billing-app

# 7. Verify
pm2 list
pm2 logs billing-app --lines 50
```

---

## ✅ POST-DEPLOYMENT TESTING

### 1. Test Excel Import
1. Create Excel file with columns: `Nama`, `Telepon`, `Alamat`
2. Go to http://SERVER_IP:3000/customers/list
3. Click "Import Excel"
4. Upload file
5. Verify: "Import selesai berhasil: X, gagal: 0"

### 2. Test PPPoE Profile CRUD
1. Go to http://SERVER_IP:3000/packages/pppoe/profiles
2. Test "Tambah Manual" - create new profile
3. Test "Edit" - modify existing profile
4. Test "Hapus" - delete profile
5. Verify burst limiting data displays correctly

### 3. Test PPPoE Package Creation
1. Go to http://SERVER_IP:3000/packages/pppoe/new
2. Select a PPPoE profile from dropdown
3. Verify rate/burst limits auto-fill
4. Create package without profile selected (should work with default '0')

### 4. Test MikroTik Sync
1. Click "Sinkronkan dari MikroTik" in PPPoE Profiles page
2. Verify burst data loads from MikroTik
3. Check logs: `pm2 logs billing-app --lines 100`

---

## 🔍 MONITORING

### Check Logs
```bash
# Real-time logs
pm2 logs billing-app

# Last 100 lines
pm2 logs billing-app --lines 100

# Error logs only
pm2 logs billing-app --err
```

### Check Status
```bash
pm2 status
pm2 monit
```

---

## 📚 RELATED DOCUMENTATION

- [CHANGELOG_v2.0.9.md](CHANGELOG_v2.0.9.md) - Detailed changelog
- [RELEASE_NOTES_v2.0.9.md](RELEASE_NOTES_v2.0.9.md) - Release notes
- [AUTO_UPDATE_SYSTEM.md](AUTO_UPDATE_SYSTEM.md) - Auto-update guide

---

## 🐛 KNOWN ISSUES

None currently identified.

---

## 🎯 NEXT RELEASE PLAN (v2.0.10)

- Further Excel import enhancements based on user feedback
- Additional MikroTik integration features
- Performance optimizations

---

## 💡 TIPS

### Excel Import Format
Create Excel file with these exact column names:
```
Nama | Telepon | Alamat
```

All columns should have headers in row 1, data starts from row 2.

### Burst Limiting Explanation
- **Burst RX/TX**: Maximum burst speed
- **Threshold RX/TX**: When burst activates
- **Time RX/TX**: How long burst lasts

---

## 📞 SUPPORT

If you encounter issues:
1. Check logs: `pm2 logs billing-app --lines 100`
2. Verify database connection
3. Test MikroTik connectivity
4. Review TROUBLESHOOTING.md

---

**🎉 Happy deploying!**



