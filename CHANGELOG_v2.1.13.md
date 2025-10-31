# Changelog v2.1.13 (2025-10-30)

## 🔧 Data Integrity & Customer Management

### Customer Code Format Fix
- ✅ Perbaikan format `customer_code` untuk konsistensi database
- ✅ Format standar: `YYYYMMDDHHMMSS` (14 digit)
- ✅ Auto-generate `customer_code` untuk customer lama yang tidak punya
- ✅ Migration script untuk fix existing data
- ✅ Konsistensi dengan format PPPoE dan Static IP

### Customer Import & Excel
- ✅ Excel import sudah menggunakan format yang benar
- ✅ Setiap customer baru otomatis dapat `customer_code` timestamp
- ✅ Validasi format customer_code

### Database Cleanup
- ✅ Migration untuk fix customer_code format
- ✅ Update customer lama dengan format timestamp
- ✅ Consistent customer ID format across all types

## 📊 Technical Details

### CustomerCodeGenerator
```typescript
// Format: YYYYMMDDHHMMSS
static generateCustomerId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}
```

### Migration Script (`migrations/fix_customer_code_format.sql`)
```sql
-- Update customers tanpa customer_code
UPDATE customers 
SET customer_code = CONCAT(
    YEAR(created_at), 
    LPAD(MONTH(created_at), 2, '0'),
    LPAD(DAY(created_at), 2, '0'),
    LPAD(HOUR(created_at), 2, '0'),
    LPAD(MINUTE(created_at), 2, '0'),
    LPAD(SECOND(created_at), 2, '0')
)
WHERE customer_code IS NULL OR customer_code = '' 
   OR LENGTH(customer_code) != 14;
```

## 📁 Files Changed

### New Files
- ✅ `migrations/fix_customer_code_format.sql` - Migration script

### Updated Behavior
- ✅ Excel import uses `CustomerIdGenerator.generateCustomerId()`
- ✅ PPPoE customer creation uses format YYYYMMDDHHMMSS
- ✅ Static IP customer creation uses format YYYYMMDDHHMMSS
- ✅ All customer endpoints ensure valid customer_code format

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
- Check existing customers dengan query: `SELECT id, customer_code FROM customers WHERE customer_code IS NULL OR LENGTH(customer_code) != 14`

### After Migration
- Verify: `SELECT id, customer_code FROM customers WHERE LENGTH(customer_code) != 14` (should return 0 rows)
- Check: `SELECT id, customer_code FROM customers` (all should have 14-digit code)

### Breaking Changes
- **None**: This is a data consistency fix, not breaking existing functionality
- All new customers akan otomatis dapat format yang benar
- Existing customers akan di-update jika format mereka tidak valid

## 🧪 Testing

### Pre-Migration Check
```sql
SELECT COUNT(*) as invalid_codes 
FROM customers 
WHERE customer_code IS NULL 
   OR customer_code = '' 
   OR LENGTH(customer_code) != 14 
   OR customer_code NOT REGEXP '^[0-9]{14}$';
```

### Post-Migration Verification
```sql
-- Should return 0
SELECT COUNT(*) as invalid_codes 
FROM customers 
WHERE customer_code IS NULL 
   OR customer_code = '' 
   OR LENGTH(customer_code) != 14;
```

### Test New Customer Creation
1. Create new PPPoE customer → verify customer_code format
2. Create new Static IP customer → verify customer_code format
3. Import Excel → verify all imported customers have valid codes
4. Check pagination masih berfungsi

## 📋 Compatibility

### Backward Compatible
- ✅ Existing queries tetap berfungsi
- ✅ Customer list pagination tetap normal
- ✅ No changes to API or UI (data consistency only)

### Data Format
- **Old**: Customer_code bisa NULL atau format apapun
- **New**: Semua customer_code format YYYYMMDDHHMMSS (14 digit)

---

**Release:** v2.1.13  
**Date:** 30 Oktober 2025  
**Type:** Data Integrity Fix  
**Status:** ✅ Production Ready  
**Breaking Changes:** No (data consistency only)  
**Requires Migration:** Yes (for existing data)

