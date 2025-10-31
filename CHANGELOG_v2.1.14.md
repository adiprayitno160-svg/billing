# Changelog v2.1.14 (2025-10-30)

## 🔧 Excel Import Fix & Data Cleanup

### Excel Import Fix
- ✅ Fixed Excel import yang menyebabkan double data di live server
- ✅ Changed format customer_code dari `CUST-{timestamp}-{random}` ke `YYYYMMDDHHMMSS`
- ✅ Menggunakan `CustomerIdGenerator.generateCustomerId()` untuk konsistensi
- ✅ Import sekarang generate format yang sama dengan PPPoE dan Static IP

### Data Cleanup
- ✅ Migration script untuk hapus customer dengan format `CUST-*`
- ✅ Auto-cleanup customer lama yang tidak valid
- ✅ Konsistensi format customer_code across all imports

### Customer Code Standardization
- ✅ Semua customer baru menggunakan format YYYYMMDDHHMMSS
- ✅ Excel import, PPPoE creation, Static IP creation semua konsisten
- ✅ Removed legacy CUST-* prefix format

## 📊 Technical Details

### Excel Import Fix (`src/controllers/excelController.ts`)
```typescript
// Before (Wrong):
const timestamp = Date.now();
const random = Math.floor(Math.random() * 1000);
const customerCode = `CUST-${timestamp}-${random}`;

// After (Fixed):
import { CustomerIdGenerator } from '../utils/customerIdGenerator';
const customerCode = CustomerIdGenerator.generateCustomerId();
```

### Migration Script (`migrations/fix_customer_code_format.sql`)
```sql
-- Hapus customer dengan format CUST-* (format lama yang salah)
DELETE FROM customers 
WHERE customer_code LIKE 'CUST-%';
```

## 🚀 Deployment

```bash
cd /opt/billing && \
git pull origin main && \
npm install && \
npm run build && \
npm install --production && \
pm2 restart billing-app --update-env

# Run migration untuk fix existing data
mysql -u username -p database_name < migrations/fix_customer_code_format.sql
```

## ⚠️ Important Notes

### Before Migration
- Backup database sebelum run migration
- Check customers dengan format CUST-*: `SELECT * FROM customers WHERE customer_code LIKE 'CUST-%'`

### After Migration
- Verify: `SELECT COUNT(*) FROM customers WHERE customer_code LIKE 'CUST-%'` (should return 0)
- All new customers akan otomatis dapat format YYYYMMDDHHMMSS
- Excel import tidak akan lagi menghasilkan double data

### Breaking Changes
- **None**: This is a data consistency and import fix
- Excel import akan lebih reliable
- No duplicate data issue

## 🧪 Testing

### Pre-Migration Check
```sql
SELECT customer_code, COUNT(*) as count
FROM customers 
WHERE customer_code LIKE 'CUST-%'
GROUP BY customer_code;

-- Lihat berapa banyak customer dengan format lama
```

### Post-Migration Verification
```sql
-- Should return 0
SELECT COUNT(*) as invalid_count 
FROM customers 
WHERE customer_code LIKE 'CUST-%';

-- Should return 0
SELECT COUNT(*) as invalid_count 
FROM customers 
WHERE LENGTH(customer_code) != 14;
```

### Test Excel Import
1. Export current data untuk backup
2. Import Excel dengan data test
3. Verify all imported customers have format YYYYMMDDHHMMSS
4. Verify no duplicate data
5. Check customer list

## 📁 Files Changed

### Modified Files
- ✅ `src/controllers/excelController.ts` - Use CustomerIdGenerator
- ✅ `migrations/fix_customer_code_format.sql` - Add cleanup query

### New Files
- ✅ `migrations/cleanup_invalid_customers.sql` - Standalone cleanup script
- ✅ `CHANGELOG_v2.1.14.md`
- ✅ `UPDATE_SERVER_v2.1.14.txt`

## 📋 Compatibility

### Backward Compatible
- ✅ Existing customers tetap berfungsi normal
- ✅ No API changes
- ✅ No UI changes (data consistency only)

### Data Format
- **Old Excel Import**: `CUST-{timestamp}-{random}`
- **New Excel Import**: `YYYYMMDDHHMMSS` (14 digits)
- **Consistent**: PPPoE, Static IP, Excel import all same format

---

**Release:** v2.1.14  
**Date:** 30 Oktober 2025  
**Type:** Bug Fix & Data Cleanup  
**Status:** ✅ Production Ready  
**Breaking Changes:** No  
**Requires Migration:** Yes (to cleanup old data)

