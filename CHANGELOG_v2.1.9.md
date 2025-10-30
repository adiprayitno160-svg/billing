# Changelog v2.1.9 (2025-10-30)

## 🐛 Bug Fixes

### Bulk Delete Customers
- ✅ Fixed: Bulk delete sekarang bisa menghapus pelanggan sampai ke database
- ✅ Added comprehensive logging untuk troubleshooting
- ✅ Added checks untuk related records:
  - Active invoices
  - Active subscriptions
  - Static IP configurations
  - Portal accounts
- ✅ Better error messages dengan alasan spesifik mengapa pelanggan tidak bisa dihapus

### Excel Import - Duplikasi Data
- ✅ Fixed: Import Excel tidak lagi menghasilkan data duplikat
- ✅ Added phone number normalization:
  - Clean spaces, dashes, dots dari nomor telepon
  - Check duplicate dengan original dan cleaned phone
  - Store cleaned phone ke database untuk konsistensi
- ✅ Improved duplicate detection:
  - Check existing customer by phone (original & cleaned)
  - Show existing customer name if duplicate found
  - Better error messages

## 📊 Technical Details

### Bulk Delete Improvements
```typescript
// Added comprehensive checks before deletion
- Check if customer exists
- Check for active invoices (sent, partial, overdue)
- Check for active subscriptions
- Check for static IP configuration
- Check for portal accounts
// If any constraint found, customer is skipped with reason
```

### Import Excel Improvements
```typescript
// Phone normalization
const cleanPhone = String(row['Telepon']).replace(/[\s\-.]/g, '');

// Duplicate check with both versions
const [existingCustomer] = await databasePool.execute(
    'SELECT id, name FROM customers WHERE phone = ? OR phone = ?',
    [row['Telepon'], cleanPhone]
);

// Store cleaned phone
await databasePool.execute(insertQuery, [
    row['Nama'],
    cleanPhone, // Use cleaned phone
    ...
]);
```

## 🚀 Deployment

```bash
git pull
npm install --no-audit --no-fund
npm run build
pm2 restart billing-app
```

## ✅ Testing Checklist

- [ ] Bulk delete pelanggan tanpa related records
- [ ] Bulk delete pelanggan dengan active invoices (should skip)
- [ ] Bulk delete pelanggan dengan subscriptions (should skip)
- [ ] Import Excel dengan nomor telepon bersih
- [ ] Import Excel dengan nomor telepon dengan spasi/dash/dot
- [ ] Import Excel duplikat (should fail with message)
- [ ] Check logs untuk debugging

## 🔍 Logging

Bulk delete sekarang log:
```
🗑️ Bulk delete request received
📋 Parsed IDs: [...]
🔍 Processing customer ID: X
✅ Customer found: [name]
⚠️ Customer X has Y active invoice(s)
🗑️ Attempting to delete customer X...
✅ Customer X deleted successfully
📊 Bulk delete completed: X deleted, Y skipped
```

Import Excel sekarang log:
```
📝 Processing row X
🔍 Checking phone: "0812-3456-7890" -> "081234567890"
✅ Phone OK - No duplicate found
💾 Inserting customer (SIMPLE): {...}
✅ SUCCESS: Row X imported!
```

---

**Release:** v2.1.9  
**Date:** 30 Oktober 2025  
**Type:** Bug Fixes  
**Status:** ✅ Production Ready  
**Breaking Changes:** None

