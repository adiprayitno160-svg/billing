# 🚀 Sync Local to Production Guide

## 📍 Production Server
**URL:** http://192.168.239.126:3000

---

## ⚠️ Issues Found
1. ❌ Menu prepaid tidak sama dengan lokal
2. ❌ Database kemungkinan tidak sama
3. ❌ Perlu sync schema & data

---

## 🔍 Step 1: Check Production Database

### Run SQL Check:
```bash
# SSH ke production server atau akses phpMyAdmin
# Run file: CHECK_PRODUCTION_DB.sql
```

Output akan menunjukkan:
- ✅ Tabel apa saja yang ada
- ✅ Kolom apa yang missing
- ✅ Data terakhir

---

## 🔧 Step 2: Fix Production Database

### Option A: Auto-Fix (Recommended)
Code v2.0.4 sudah include **auto-fix on startup**!

```bash
# Di production server:
git pull origin main
npm install
npm run build
pm2 restart billing-system

# Check logs untuk auto-fix:
pm2 logs billing-system --lines 50 | grep "AutoFix"
```

Expected output:
```
🔧 [AutoFix] Checking prepaid_packages table...
✅ [AutoFix] prepaid_packages table is OK
```

### Option B: Manual Fix
Jika auto-fix gagal, run SQL manual:

```bash
# Copy file migrations/fix_prepaid_packages_columns.sql ke production
# Run via phpMyAdmin atau MySQL CLI
mysql -u YOUR_USER -p YOUR_DATABASE < fix_prepaid_packages_columns.sql
```

---

## 📦 Step 3: Deploy Latest Code

### Full Deploy Steps:

```bash
# 1. SSH ke production
ssh user@192.168.239.126

# 2. Navigate to project
cd /path/to/billing

# 3. Backup current code (optional but recommended)
cp -r . ../billing-backup-$(date +%Y%m%d)

# 4. Pull latest
git pull origin main

# 5. Install dependencies
npm install

# 6. Build TypeScript
npm run build

# 7. Restart server
pm2 restart billing-system

# 8. Check status
pm2 status
pm2 logs billing-system --lines 30
```

---

## ✅ Step 4: Verify Production

### Check List:

1. **Footer Version:**
   - Visit: http://192.168.239.126:3000
   - Footer should show: **v2.0.4** ✅
   - (bukan v1.0.0 hardcoded)

2. **Interface Traffic Realtime:**
   - Dashboard should show traffic chart
   - Chart should update every 3 seconds
   - No console errors

3. **Prepaid Menu:**
   - Visit: http://192.168.239.126:3000/prepaid/speed-profiles
   - Should show profile list without errors
   - No "Unknown column" errors

4. **Database Logs:**
   ```bash
   pm2 logs billing-system --lines 50 | grep "AutoFix"
   pm2 logs billing-system --lines 50 | grep "Error"
   ```

5. **Test Prepaid Functions:**
   - Create package ✅
   - Edit package ✅
   - Delete package ✅
   - Assign to customer ✅

---

## 🔄 Step 5: Sync Local ↔ Production

### If Production has NEW data that Local doesn't:

```bash
# Export from production
mysqldump -u USER -p DATABASE_NAME prepaid_packages prepaid_package_subscriptions > production_prepaid.sql

# Import to local
mysql -u root -p billing_db < production_prepaid.sql
```

### If Local has NEW features that Production doesn't:
Already covered by deploy steps above! ✅

---

## 🐛 Common Issues & Solutions

### Issue 1: "Unknown column" errors
**Solution:** Auto-fix didn't run. Check:
```bash
pm2 logs billing-system | grep "AutoFix"
```
If not found, restart server again.

### Issue 2: Menu prepaid shows old layout
**Solution:** Clear browser cache or hard refresh (Ctrl+F5)

### Issue 3: Chart.js not loading
**Solution:** Check browser console for errors. Ensure Chart.js CDN is accessible.

### Issue 4: Database connection error
**Solution:** Check `.env` file on production:
```bash
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_database
```

---

## 📝 Checklist Before Release

- [ ] Production database checked with `CHECK_PRODUCTION_DB.sql`
- [ ] All missing tables/columns fixed
- [ ] Code deployed to production
- [ ] Server restarted successfully
- [ ] Footer shows v2.0.4
- [ ] Interface Traffic chart working
- [ ] Prepaid menu accessible without errors
- [ ] No "Unknown column" errors in logs
- [ ] Tested all prepaid functions (CRUD)
- [ ] Local and Production are in sync

---

## 🎯 After Everything is OK:

Then we can proceed with:
```bash
# Create release v2.0.4
gh release create v2.0.4 --title "v2.0.4 - UI & Bug Fixes" --notes "See CHANGELOG_v2.0.4.md" --latest
```

---

**Need Help?**
- Check logs: `pm2 logs billing-system`
- Check status: `pm2 status`
- Restart: `pm2 restart billing-system`
- Monitor: `pm2 monit`

