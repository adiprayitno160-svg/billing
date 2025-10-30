# Release Notes v2.0.8.5

**Release Date:** October 30, 2025  
**Type:** Feature Update & Bug Fixes

---

## 🎯 What's New

### ✨ Profile PPPoE CRUD Management
- **Create/Edit/Delete Profile Manually**: Tambah fitur untuk membuat, mengedit, dan menghapus profil PPPoE secara manual
- **Rate Limiting Display**: Tampilkan kolom Rate Limit RX/TX dan Burst Limit di tabel profil
- **Complete Form**: Form lengkap dengan semua parameter rate limiting dan burst limiting
- **Delete Protection**: Profil yang digunakan oleh paket tidak dapat dihapus

### 📊 About Page - Major Updates Only
- **Smart Versioning**: About page hanya menampilkan dan cek major updates (2.0.8 → 2.0.9)
- **Ignore Hotfixes**: Hotfixes (2.0.8.1, 2.0.8.2, dll) tidak muncul di About page
- **Dual Versioning System**:
  - `VERSION_MAJOR` → Untuk About page (stable releases only)
  - `VERSION` → Untuk footer/internal tracking (includes hotfixes)

---

## 🔧 Technical Improvements

### Backend
- Added `getProfileById()`, `createProfile()`, `updateProfile()`, `deleteProfile()` in `pppoeService.ts`
- Added `getMajorVersion()` and `checkForMajorUpdates()` in `GitHubService.ts`
- Enhanced profile CRUD with complete rate/burst limiting fields

### Frontend
- New view: `pppoe_profiles.ejs` with rate limiting columns
- New view: `pppoe_profile_form.ejs` with complete form
- Updated routes for profile CRUD operations

### Versioning Strategy
```
VERSION_MAJOR (2.0.8) ─────> About Page (Stable)
                            └─> GitHub Release Check
                            
VERSION (2.0.8.5) ────────> Footer Display
                          └─> Internal Tracking
```

---

## 🐛 Bug Fixes

- **Session/Idle Timeout**: Removed unused session_timeout and idle_timeout fields from forms
- **About Page Button**: "Cek Update" button now correctly checks only for major releases
- **Rate Limiting**: Fixed rate limit display in profile table

---

## 📦 Database Changes

No database migrations required for this release.

---

## 🚀 Deployment

### Method 1: Auto Update (Recommended)
```bash
# On server
cd /opt/billing
bash auto-update-views.sh  # For view-only changes
# OR
bash full-deploy.sh        # For full deployment
```

### Method 2: Manual
```bash
git pull origin main
npm run build
pm2 restart billing-app  # or billing-system/billing
```

---

## 📝 Migration Guide

No special migration steps required. Just pull and restart.

---

## 🎉 Complete Features

### Profile PPPoE Management
1. **List Profiles**: Lihat semua profil dengan rate limiting
2. **Sync from MikroTik**: Sync otomatis dari router
3. **Create Manual**: Buat profil baru tanpa MikroTik
4. **Edit Profile**: Update rate limit dan burst setting
5. **Delete Profile**: Hapus profil (dengan validasi usage)

### About Page Improvements
- Only show stable releases (2.0.8, 2.0.9, etc)
- Ignore hotfixes for cleaner UI
- Footer shows full version for internal reference

---

## 🔗 Related Issues

- Profile PPPoE tidak bisa di-manage secara manual ✅
- About page menampilkan terlalu banyak hotfix updates ✅
- Rate limiting tidak terlihat di tabel profil ✅

---

## 👥 Contributors

- adiprayitno160-svg

---

## 📌 Notes

- This is a **feature update** with no breaking changes
- Backward compatible with v2.0.8.4
- Safe to deploy on production

**Full Changelog**: https://github.com/adiprayitno160-svg/billing/compare/v2.0.8.4...v2.0.8.5
