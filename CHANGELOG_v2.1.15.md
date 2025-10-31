# Changelog v2.1.15 (2025-10-30)

## 🔧 Complete Customer Code Standardization

### All Customer Code Generation Now Uses YYYYMMDDHHMMSS
- ✅ Fixed `src/services/staticIpClientService.ts` - Now uses CustomerIdGenerator
- ✅ Fixed `src/routes/index.ts` - Removed manual timestamp generation
- ✅ Fixed `src/controllers/excelController.ts` - Already fixed in v2.1.14
- ✅ All places now consistently use `CustomerIdGenerator.generateCustomerId()`

### Pagination
- ✅ Customer list pagination already working (20 per page)
- ✅ No changes needed

## 📊 Technical Details

### Files Fixed
```typescript
// src/services/staticIpClientService.ts
// Before:
const now = new Date();
const customerCode = now.getFullYear().toString() + ...;

// After:
import { CustomerIdGenerator } from '../utils/customerIdGenerator';
const customerCode = CustomerIdGenerator.generateCustomerId();

// src/routes/index.ts (multiple places)
// Before:
const { CustomerIdGenerator } = await import('../utils/customerIdGenerator');
const initial_customer_code = CustomerIdGenerator.generateCustomerId();

// After:
import { CustomerIdGenerator } from '../utils/customerIdGenerator';
const initial_customer_code = CustomerIdGenerator.generateCustomerId();
```

### Now All Customer Creation Uses Same Generator
- ✅ Excel Import: `CustomerIdGenerator.generateCustomerId()`
- ✅ PPPoE Creation: `CustomerIdGenerator.generateCustomerId()`
- ✅ Static IP Creation: `CustomerIdGenerator.generateCustomerId()`
- ✅ Manual Creation: `CustomerIdGenerator.generateCustomerId()`

## 🚀 Deployment

```bash
cd /opt/billing && \
git pull origin main && \
npm install && \
npm run build && \
npm install --production && \
pm2 restart billing-app --update-env

# Run migration to cleanup old data
mysql -u username -p database_name < migrations/fix_customer_code_format.sql
```

## ⚠️ Important Notes

### No Breaking Changes
- **None**: This is a code consistency fix
- All existing functionality remains the same
- Migration will cleanup old CUST-* format data

### What This Fixes
- No more inconsistent customer_code formats
- All new customers use YYYYMMDDHHMMSS
- Easier to maintain and debug

## 📁 Files Changed

### Modified Files
- ✅ `src/services/staticIpClientService.ts` - Use CustomerIdGenerator
- ✅ `src/routes/index.ts` - Remove dynamic imports, use static import
- ✅ `src/controllers/excelController.ts` - Already fixed in v2.1.14

### Migration
- ✅ `migrations/fix_customer_code_format.sql` - Cleanup CUST-* data

## 🧪 Testing

### Verify New Customer Creation
1. Create new PPPoE customer → Should have YYYYMMDDHHMMSS format
2. Create new Static IP customer → Should have YYYYMMDDHHMMSS format
3. Import Excel → Should have YYYYMMDDHHMMSS format
4. Check pagination still works (20 per page)

### Post-Migration Verification
```sql
-- Should return 0
SELECT COUNT(*) FROM customers WHERE customer_code LIKE 'CUST-%';

-- All should have 14-digit format
SELECT COUNT(*) FROM customers WHERE LENGTH(customer_code) != 14;
```

---

**Release:** v2.1.15  
**Date:** 30 Oktober 2025  
**Type:** Code Consistency Fix  
**Status:** ✅ Production Ready  
**Breaking Changes:** No  
**Requires Migration:** Yes (to cleanup old CUST-* data)

