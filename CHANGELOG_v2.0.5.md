# Changelog v2.0.5

## 🎯 Release Date: October 29, 2025

---

## ✨ New Features

### 1. **Dynamic Footer Version** 
- Footer now displays version from `package.json` automatically
- No more hardcoded version numbers
- Updates automatically on new releases

### 2. **Interface Traffic Realtime Dashboard**
- **FIXED**: Interface Traffic Realtime chart now working
- Re-enabled Chart.js library (was temporarily disabled)
- Real-time traffic monitoring now fully functional
- Multi-interface support with color coding

### 3. **Enhanced Remote Update System**
- Improved remote update scripts (PowerShell & Bash)
- Better error handling and logging
- Force update option available
- Comprehensive UPDATE_GUIDE.md documentation

---

## 🐛 Bug Fixes

### 1. **PrepaidMonitoringScheduler Query Error**
- **Fixed**: `Unknown column 'c.ip_address' in 'field list'`
- Changed query to use proper JOIN with `static_ip_clients` table
- Query now uses `sic.ip_address` instead of `c.ip_address`

**Before:**
```sql
SELECT c.ip_address FROM customers c
```

**After:**
```sql
SELECT sic.ip_address 
FROM customers c
LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
```

### 2. **Footer Version Hardcoded**
- **Fixed**: Footer showed hardcoded "v1.0.0" 
- Now dynamically reads from `package.json`
- Automatic version display on all pages

### 3. **Interface Traffic Chart Not Loading**
- **Fixed**: Chart.js was disabled in layout
- Re-enabled Chart.js v4.4.0 CDN
- Dashboard traffic monitoring now works perfectly

---

## 🔧 Technical Changes

### New Files:
- `src/middlewares/versionMiddleware.ts` - Middleware to inject app version to all views
- `CHANGELOG_v2.0.5.md` - This changelog

### Modified Files:
- `src/schedulers/PrepaidMonitoringScheduler.ts` - Fixed IP address query
- `views/partials/footer.ejs` - Dynamic version display
- `src/server.ts` - Added version middleware
- `views/layouts/main.ejs` - Re-enabled Chart.js
- `UPDATE_GUIDE.md` - Enhanced documentation
- `remote-update.ps1` - Improved PowerShell script
- `remote-update.sh` - Improved Bash script
- `force-update.sh` - Force update capability
- `package.json` - Version bump to 2.0.5
- `VERSION` - Updated to 2.0.5

---

## 📊 What's Included from v2.0.3

All improvements from v2.0.3 are still included:
- ⚡ 90% faster prepaid pages
- 🔧 Auto-fix database system
- 📦 Aggressive MikroTik caching
- 🏥 Health monitoring

---

## 🚀 Upgrade Instructions

### From v2.0.3 or v2.0.4:

```bash
# Pull latest code
git pull origin main

# Install dependencies (if any new)
npm install

# Build TypeScript
npm run build

# Restart server
pm2 restart billing-system
# or
npm run start
```

### Via Remote Update Script:
```bash
# Windows
.\remote-update.ps1 -Host your-server-ip

# Linux/Mac
./remote-update.sh --host your-server-ip
```

### Verify:
1. Check footer shows "v2.0.5" ✅
2. Check Interface Traffic Realtime chart loads ✅
3. Check prepaid monitoring scheduler (no more ip_address errors) ✅
4. Remote update scripts working properly ✅

---

## 🎉 Summary

**v2.0.5** focuses on:
- 🎨 UI polish (dynamic version display)
- 📊 Dashboard fixes (traffic chart working)
- 🐛 Critical bug fix (scheduler query error)
- 🔄 Enhanced remote update system
- 📝 Improved documentation

Small but impactful improvements for better user experience and easier deployment!

---

**Contributors:** AI Assistant  
**Release Type:** Patch  
**Breaking Changes:** None  
**Migration Required:** No

---

**Full Changelog:** [v2.0.3...v2.0.5](https://github.com/adiprayitno160-svg/billing/compare/v2.0.3...v2.0.5)

