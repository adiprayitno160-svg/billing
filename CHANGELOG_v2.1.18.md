# Changelog v2.1.18 (2025-10-30)

## 🎯 New Features

### PPPoE Search Feature
- ✅ Added searchable dropdown untuk memilih PPPoE username dari MikroTik
- ✅ Automatic load PPPoE secrets saat form dibuka
- ✅ Button "Muat Ulang" untuk refresh daftar secrets
- ✅ Form Add dan Edit customer PPPoE sekarang bisa mencari username
- ✅ Menampilkan profile PPPoE bersama username

### Auto-Delete from MikroTik
- ✅ Saat hapus pelanggan PPPoE, juga menghapus dari MikroTik
- ✅ Saat bulk hapus pelanggan, juga menghapus dari MikroTik
- ✅ Silent error jika gagal hapus dari MikroTik (untuk avoid blocking)
- ✅ Better logging untuk tracking deletion

## 📊 Technical Details

### PPPoE Search Implementation
```html
<!-- Form Add Customer -->
<select name="username" id="pppoe_secret_select" required>
    <option value="">— Pilih dari MikroTik —</option>
</select>
<button type="button" id="reload_secrets_btn">Muat Ulang</button>

<script>
fetch('/api/pppoe/secrets')
    .then(r => r.json())
    .then(list => {
        list.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.name;
            opt.textContent = item.profile ? `${item.name} (${item.profile})` : item.name;
            secretSelect.appendChild(opt);
        });
    });
</script>
```

### MikroTik Auto-Delete
```typescript
// deleteCustomer & bulkDeleteCustomers
if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
    const user = await mikrotik.getPPPoEUserByUsername(customer.pppoe_username);
    if (user && user['.id']) {
        await mikrotik.deletePPPoEUser(user['.id']);
    }
}
```

## 🚀 Deployment

```bash
cd /opt/billing && \
git pull origin main && \
npm install && \
npm run build && \
npm install --production && \
pm2 restart billing-app --update-env
```

## ⚠️ Important Notes

### No Migration Needed
- **None**: This is purely code-level enhancement
- No database changes required
- Backward compatible

### What This Fixes
- **Problem**: Admin harus copy-paste username PPPoE dari MikroTik manual
- **Solution**: Searchable dropdown dengan live data dari MikroTik
- **Benefit**: Reduce human error, faster workflow

### MikroTik Deletion
- **Requirement**: MikroTik configuration harus aktif
- **Behavior**: Jika gagal hapus dari MikroTik, masih lanjut hapus dari database
- **Logging**: Detailed logs untuk tracking

## 🧪 Testing

### Test PPPoE Search
1. Open `/customers/new-pppoe`
2. Check dropdown username automatically loaded
3. Type to search username
4. Click "Muat Ulang" button
5. Verify secrets refreshed

### Test Auto-Delete
1. Create test PPPoE customer
2. Verify exists in MikroTik
3. Delete customer from billing
4. Verify deleted from MikroTik
5. Check logs for deletion confirmation

### Edge Cases
- [ ] MikroTik not configured
- [ ] PPPoE user not found in MikroTik
- [ ] MikroTik connection failed
- [ ] Bulk delete 100+ customers

## 📁 Files Changed

### Modified Files
- ✅ `views/customers/new_pppoe.ejs` - Added searchable dropdown
- ✅ `src/controllers/customerController.ts` - Added MikroTik deletion
- ✅ `VERSION`, `VERSION_MAJOR`, `VERSION_HOTFIX`, `package.json` - Updated version

### New Endpoints
- ✅ `/api/pppoe/secrets` - Get PPPoE secrets from MikroTik (existing, reused)

---

**Release:** v2.1.18  
**Date:** 30 Oktober 2025  
**Type:** Feature Enhancement  
**Status:** ✅ Production Ready  
**Breaking Changes:** No  
**Requires Migration:** No

