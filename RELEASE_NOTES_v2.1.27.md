# Release Notes v2.1.27

**Tanggal Release:** 16 November 2025

## 🐛 Bug Fixes

### Bookkeeping System
- **Fixed:** Error 500 pada halaman pembukuan dengan pesan error yang lebih detail
- **Fixed:** SQL query error `Unknown column 'i.paid_at'` di `bookkeepingService.ts`
- **Fixed:** Query SQL sekarang menggunakan subquery yang benar untuk mendapatkan tanggal pembayaran

### Database Auto-Fix
- **Added:** Fungsi auto-fix untuk tabel `invoices`, `payments`, `invoice_items`, dan `pppoe_profiles`
- **Added:** Tabel akan otomatis dibuat saat server start jika belum ada
- **Improved:** Error handling yang lebih baik dengan pesan error spesifik

## ✨ Improvements

### Error Handling
- **Enhanced:** Error handling di `bookkeepingController` dengan deteksi error database spesifik
- **Enhanced:** Tampilan error sekarang menampilkan detail error di mode development
- **Enhanced:** Semua method di `bookkeepingService` sekarang memiliki error handling yang komprehensif

### User Experience
- **Improved:** Pesan error lebih informatif dan membantu troubleshooting
- **Improved:** Error messages sekarang menunjukkan penyebab spesifik (tabel tidak ada, kolom tidak ada, dll)

## 📝 Technical Details

### Files Changed
- `src/controllers/accounting/bookkeepingController.ts` - Enhanced error handling
- `src/services/accounting/bookkeepingService.ts` - Fixed SQL queries and added error handling
- `src/utils/autoFixDatabase.ts` - Added `autoFixInvoicesAndPaymentsTables()` function
- `src/server.ts` - Added auto-fix call during startup
- `views/error.ejs` - Enhanced error display with details
- `package.json` - Version updated to 2.1.27

### Database Changes
- Auto-creation of `invoices` table if not exists
- Auto-creation of `invoice_items` table if not exists
- Auto-creation of `payments` table if not exists
- Auto-creation of `pppoe_profiles` table if not exists

## 🚀 Upgrade Instructions

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

3. **Restart server:**
   ```bash
   pm2 restart billing-app
   ```

4. **Verify:**
   - Server akan otomatis membuat tabel database yang diperlukan saat start
   - Cek log untuk melihat: `✅ [AutoFix] Invoices and payments tables ensured`
   - Akses halaman pembukuan untuk memastikan tidak ada error

## 📋 Migration Notes

- Tidak ada migrasi manual yang diperlukan
- Tabel database akan dibuat otomatis saat server start
- Data existing tidak akan terpengaruh

## 🔗 Related Issues

- Fixed: Error 500 pada halaman pembukuan
- Fixed: SQL query error dengan kolom `i.paid_at`

---

**Previous Version:** [v2.1.26](../RELEASE_NOTES_v2.1.26.md)

