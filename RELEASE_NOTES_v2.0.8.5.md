# 🚀 Release Notes v2.0.8.5

**Release Date:** 2025-10-30  
**Type:** Bug Fixes & Improvements

## 🎯 Fixes Implemented

### 1. ✅ **Customers Import - Template Removal & Email Optional**
**Problem:** 
- Tombol template download yang tidak berfungsi muncul di beberapa tempat
- Import gagal dengan error "gagal 1" karena Email wajib diisi

**Solution:**
- ✅ Hapus semua tombol template download dari halaman customers list
- ✅ Ubah validasi import: **Email sekarang OPTIONAL** (hanya Nama dan Telepon yang wajib)
- ✅ Improve error messages untuk import failures
- ✅ Check phone uniqueness terlebih dahulu, baru email (jika provided)

**Files Changed:**
- `views/customers/list.ejs` - Remove template buttons
- `src/controllers/customerController.ts` - Fix import validation

---

### 2. ✅ **PPPoE Package Creation - Auto-fill & NULL Handling**
**Problem:**
- Error `column 'rate_limit_rx' cannot be null` saat save tanpa memilih profil PPPoE
- Rate limiting dan burst limiting tidak auto-fill dari profil MikroTik

**Solution:**
- ✅ **Auto-fill** rate limiting & burst limiting dari profil PPPoE MikroTik (sudah ada, tapi belum jelas)
- ✅ Set **default value '0'** (unlimited) untuk rate_limit_rx/tx jika tidak diisi
- ✅ Improve placeholder dan hint untuk rate limiting fields
- ✅ Menampilkan informasi bahwa field kosong = unlimited

**Files Changed:**
- `src/services/pppoeService.ts` - Default '0' untuk rate_limit
- `views/packages/pppoe_package_form.ejs` - Better placeholders and hints

---

## 📊 Technical Details

### Customers Import Validation Changes
**Before:**
```typescript
if (!row['Nama'] || !row['Email'] || !row['Telepon']) {
    // Error: Semua field wajib
}
```

**After:**
```typescript
// HANYA Nama dan Telepon yang WAJIB
if (!row['Nama'] || !row['Telepon']) {
    results.failed++;
    results.errors.push(`Baris ${rowNumber}: Nama dan Telepon harus diisi`);
    continue;
}

// Email validation hanya jika provided
if (row['Email']) {
    // Check email uniqueness
}
```

### PPPoE Package Rate Limit Defaults
**Before:**
```typescript
data.rate_limit_rx || null,  // ERROR: Database NOT NULL constraint
data.rate_limit_tx || null,
```

**After:**
```typescript
data.rate_limit_rx || '0',  // Default '0' (unlimited) jika tidak diisi
data.rate_limit_tx || '0',  // Default '0' (unlimited) jika tidak diisi
```

---

## 🔧 Deployment Instructions

### Quick Deploy (Recommended)
```bash
cd /opt/billing && git pull && npm run build && pm2 restart billing-system
```

### Manual Steps
```bash
cd /opt/billing
git pull origin main
npm install  # (optional, no new dependencies)
npm run build
pm2 restart billing-system
```

---

## ✅ Verification Steps

### 1. Customers Import
- [ ] Buka `/customers/list`
- [ ] Pastikan **tidak ada tombol "Template"**
- [ ] Klik **Import Excel**
- [ ] Upload Excel dengan hanya **Nama & Telepon** (tanpa Email)
- [ ] **Expected:** Import berhasil!

### 2. PPPoE Package Creation
- [ ] Buka `/packages/pppoe/packages/new`
- [ ] **Dengan Profil:**
  - Pilih profil PPPoE dari dropdown
  - **Expected:** Rate limiting auto-fill dari profil
- [ ] **Tanpa Profil:**
  - Biarkan profil kosong
  - Kosongkan Rate Limit RX/TX
  - Klik Save
  - **Expected:** Berhasil save (default ke '0' = unlimited)

---

## 📝 Changelog Summary

### Changed
- Customers import: Email is now optional (only Nama & Telepon required)
- PPPoE package: Rate limits default to '0' (unlimited) if not provided

### Removed
- Template download buttons from customers list page

### Improved
- Import error messages more descriptive
- Rate limiting field placeholders and hints
- User experience for PPPoE package creation

---

## 🐛 Bug Fixes
1. ✅ Fixed import error "column 'rate_limit_rx' cannot be null"
2. ✅ Fixed customers import requiring Email unnecessarily
3. ✅ Removed non-functional template buttons

---

## 📚 Related Issues
- Import customers: Template buttons tidak berfungsi
- PPPoE Package: Error NULL constraint pada rate_limit_rx
- Auto-fill dari MikroTik profile tidak jelas bagi user

---

## 🎉 Credits
**Developed by:** AI Assistant  
**Tested by:** User Feedback  
**Version:** 2.0.8.5

---

**Previous Versions:**
- [v2.0.8.4](DEPLOY_v2.0.8.4_SEKARANG.txt) - Gradual transition control for traffic graphs
- [v2.0.8.3](EMERGENCY_HOTFIX_v2.0.8.3.txt) - Realistic rate cap and byte counter corruption
- [v2.0.8](RELEASE_NOTES_v2.0.8.md) - Initial smoothing algorithms

