# 🚀 Manual Deploy Steps - Production Server

## 📍 Target Server
**URL:** http://192.168.239.126:3000

---

## ⚠️ Issues Found (Current Production)

| URL | Status | Issue |
|-----|--------|-------|
| `/prepaid/packages` | ✅ OK | Working |
| `/prepaid/speed-profiles` | ✅ OK | Working |
| `/prepaid/mikrotik-setup` | ❌ 404 | Route not found |
| `/prepaid/address-list` | ❌ Error | Route error |

**Root Cause:** Production server running OLD code without these routes.

---

## 🔧 Solution: Deploy Latest Code

### Option 1: SSH Deploy (Recommended)

```bash
# 1. SSH to production
ssh user@192.168.239.126

# 2. Navigate to project
cd /var/www/billing  # Adjust path!

# 3. Create backup
cp -r . ../billing-backup-$(date +%Y%m%d)

# 4. Pull latest code
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

### Option 2: FTP/SFTP Upload

If you can't use Git on production:

```bash
# On LOCAL machine:
# 1. Build locally first
npm run build

# 2. Upload these folders to production:
# - dist/ (compiled JS)
# - src/ (TypeScript source)
# - views/ (EJS templates)
# - public/ (static assets)
# - node_modules/ (or run npm install on server)

# 3. SSH to production and restart:
ssh user@192.168.239.126
cd /var/www/billing
pm2 restart billing-system
```

### Option 3: Using PM2 Deploy (If configured)

```bash
# On LOCAL machine:
pm2 deploy production update
```

---

## ✅ Verification Steps

After deploy, check these URLs:

### 1. **Mikrotik Setup** (NEW Route)
```
http://192.168.239.126:3000/prepaid/mikrotik-setup
```
**Expected:** Setup wizard page (not 404)

### 2. **Address List Management** (NEW Route)
```
http://192.168.239.126:3000/prepaid/address-list
```
**Expected:** Address list management page (no errors)

### 3. **Speed Profiles** (Should already work)
```
http://192.168.239.126:3000/prepaid/speed-profiles
```
**Expected:** Profile list page

### 4. **Packages** (Should already work)
```
http://192.168.239.126:3000/prepaid/packages
```
**Expected:** Package management page

### 5. **Footer Version**
Check footer on ANY page:
**Expected:** Shows "v2.0.4" (not "v1.0.0")

### 6. **Interface Traffic Chart**
Dashboard page:
**Expected:** Traffic chart loads and updates

---

## 🔍 Check Server Logs

### Check for errors:
```bash
pm2 logs billing-system --lines 50
```

### Look for these SUCCESS messages:
```
✅ [AutoFix] prepaid_packages table is OK
✅ Server running on port 3000
✅ Database connected
```

### Look for these ERRORS (should NOT appear):
```
❌ Unknown column 'c.ip_address'
❌ Unknown column 'mikrotik_profile_name'
❌ 404 Not Found: /prepaid/mikrotik-setup
```

---

## 🗄️ Database Check

### Run on production database:

```sql
-- Check if all required tables exist
SHOW TABLES LIKE 'prepaid%';

-- Expected tables:
-- - prepaid_packages
-- - prepaid_package_subscriptions
-- - portal_customers

-- Check prepaid_packages columns
SHOW COLUMNS FROM prepaid_packages;

-- Expected columns (new ones):
-- - mikrotik_profile_name
-- - parent_download_queue
-- - parent_upload_queue
-- - download_mbps
-- - upload_mbps
```

If columns missing, **auto-fix** will add them on server restart!

---

## 🐛 Troubleshooting

### Issue 1: Still getting 404 on `/prepaid/mikrotik-setup`

**Solution:**
```bash
# Check if routes file exists
ls -la src/routes/prepaid.ts

# Check if it's imported in main routes
grep "prepaid" src/routes/index.ts

# Rebuild
npm run build

# Force restart
pm2 delete billing-system
pm2 start ecosystem.config.js
```

### Issue 2: "Unknown column" errors

**Solution:**
```bash
# Auto-fix should run on startup
# Check logs:
pm2 logs billing-system | grep "AutoFix"

# If not found, restart again:
pm2 restart billing-system

# Or run SQL manually:
mysql -u USER -p DATABASE < migrations/fix_prepaid_packages_columns.sql
```

### Issue 3: npm build fails

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue 4: Port 3000 already in use

**Solution:**
```bash
# Find process on port 3000
lsof -i :3000
# or
netstat -tulpn | grep 3000

# Kill old process
kill -9 <PID>

# Restart
pm2 restart billing-system
```

---

## 📋 Pre-Deploy Checklist

Before deploying to production:

- [ ] Code tested on local ✅
- [ ] All routes working on local ✅
- [ ] Database auto-fix tested ✅
- [ ] Backup created on production
- [ ] Server access confirmed (SSH/FTP)
- [ ] PM2 process name confirmed
- [ ] Database credentials correct in `.env`

---

## 🎯 Post-Deploy Checklist

After deploying:

- [ ] Server restarted successfully
- [ ] No errors in `pm2 logs`
- [ ] `/prepaid/mikrotik-setup` loads (not 404)
- [ ] `/prepaid/address-list` loads (no errors)
- [ ] Footer shows v2.0.4
- [ ] Interface Traffic chart working
- [ ] Database auto-fix ran successfully
- [ ] Tested creating/editing prepaid package
- [ ] Tested all prepaid admin pages

---

## 🆘 Need Help?

### Check logs:
```bash
pm2 logs billing-system
```

### Check status:
```bash
pm2 status
pm2 info billing-system
```

### Restart:
```bash
pm2 restart billing-system
```

### Monitor live:
```bash
pm2 monit
```

---

## 📞 Contact

Jika masih error setelah deploy, screenshot:
1. PM2 logs (`pm2 logs --lines 50`)
2. Browser console errors (F12)
3. Network tab errors (404/500)

Lalu tanyakan ke saya! 🤝

