# 🔧 Hotfix System

Sistem untuk menangani bugfix kecil tanpa perlu release baru atau ganti versi major.

## 📋 Konsep

**Version Format:** `MAJOR.MINOR.PATCH.HOTFIX`

Contoh:
- `2.1.0` - Release version
- `2.1.0.1` - Hotfix #1 (customer_code database fix)
- `2.1.0.2` - Hotfix #2 (future fix)
- `2.1.0.3` - Hotfix #3 (future fix)

## 🎯 Kapan Menggunakan Hotfix?

**Gunakan HOTFIX untuk:**
- ✅ Database schema fixes
- ✅ Bug fixes kecil yang tidak mengubah fitur
- ✅ Typo fixes
- ✅ Performance tweaks minor
- ✅ Security patches kecil
- ✅ Configuration fixes

**JANGAN gunakan HOTFIX untuk:**
- ❌ Fitur baru
- ❌ UI/UX changes besar
- ❌ Breaking changes
- ❌ Major refactoring
- ❌ API changes

## 🔄 Workflow Hotfix

### 1. Identifikasi Bug
```bash
# Bug ditemukan di production
# Contoh: customer_code field error
```

### 2. Fix Bug Locally
```bash
# Perbaiki bug di local environment
# Test sampai confirmed working
```

### 3. Update Hotfix Version
```bash
# Edit VERSION_HOTFIX file
echo "2.1.0.1" > VERSION_HOTFIX

# Commit
git add VERSION_HOTFIX
git commit -m "hotfix: customer_code database schema fix (v2.1.0.1)"
git push origin main
```

### 4. Deploy Hotfix ke Production
```bash
# Di server production
git pull origin main
pm2 restart billing-app
```

## 📁 File Structure

```
billing/
├── VERSION              # Full version (2.1.0.1)
├── VERSION_MAJOR        # Major version (2.1.0)
├── VERSION_HOTFIX       # Hotfix tracking (2.1.0.1)
├── HOTFIX.md           # This file
└── hotfix/
    ├── 2.1.0.1.md      # Hotfix #1 changelog
    ├── 2.1.0.2.md      # Hotfix #2 changelog
    └── ...
```

## 📝 Hotfix Changelog Format

Setiap hotfix harus punya file changelog di folder `hotfix/`:

```markdown
# Hotfix 2.1.0.1

**Date:** 2025-10-30
**Type:** Database Schema Fix
**Severity:** Critical

## Problem
- Customer import failing with "Field 'customer_code' doesn't have a default value"
- All imports returning 0 success, all failed

## Root Cause
- Database field `customer_code` was NOT NULL without default value
- Application code sends NULL but database rejects it

## Solution
- Modified customer_code field to allow NULL
- Added DEFAULT NULL
- Type: VARCHAR(191) UNIQUE NULL DEFAULT NULL

## SQL Changes
```sql
ALTER TABLE customers 
MODIFY COLUMN customer_code VARCHAR(191) UNIQUE NULL DEFAULT NULL;
```

## Files Changed
- None (database only)

## Testing
- ✅ Import 27 rows successfully
- ✅ No errors
- ✅ customer_code generates or NULL accepted

## Deploy Instructions
```bash
# Run this SQL on production database
mysql -u root -p billing < hotfix/2.1.0.1.sql
# OR run the Node.js script
node hotfix/2.1.0.1-fix.js
```
```

## 🚀 Auto-Update System

### Check for Hotfix Updates

Script untuk cek apakah ada hotfix baru:

```bash
#!/bin/bash
# check-hotfix.sh

CURRENT=$(cat VERSION_HOTFIX)
REMOTE=$(git ls-remote origin main | grep VERSION_HOTFIX | cut -f1)
LOCAL=$(git rev-parse HEAD:VERSION_HOTFIX)

if [ "$REMOTE" != "$LOCAL" ]; then
    echo "🔧 Hotfix update available!"
    echo "Current: $CURRENT"
    git pull origin main
    NEW=$(cat VERSION_HOTFIX)
    echo "Updated to: $NEW"
    pm2 restart billing-app
else
    echo "✅ No hotfix updates"
fi
```

## 📊 Hotfix History

Track semua hotfix dalam file ini:

### v2.1.0.1 - Customer Code Database Fix
- **Date:** 2025-10-30
- **Issue:** Import failing due to customer_code field constraint
- **Fix:** Allow NULL with default value
- **Impact:** Critical - All imports affected
- **Files:** Database schema only

### v2.1.0.2 - (Future hotfix)
- TBD

## 🎯 Best Practices

1. **Keep it Small:** Hotfix harus kecil dan focused
2. **Test Thoroughly:** Test di local dulu sebelum push
3. **Document Well:** Selalu buat changelog lengkap
4. **Notify Users:** Inform users about hotfix via dashboard notice
5. **Track Everything:** Catat semua hotfix di HOTFIX.md

## 🔐 Security Hotfix

Untuk security fix:
- Prioritas TERTINGGI
- Deploy immediately
- Notify admin via email/notif
- Log semua activities

## 📞 Support

Jika ada masalah dengan hotfix:
1. Check HOTFIX.md untuk detail
2. Check individual hotfix changelog di `hotfix/`
3. Rollback jika perlu: `git checkout VERSION_HOTFIX`
4. Contact developer

---

**Last Updated:** 2025-10-30
**Maintained by:** Development Team


