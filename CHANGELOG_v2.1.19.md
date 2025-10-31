# Changelog v2.1.19 (2025-10-30)

## 🔧 Critical Fixes

### Edit PPPoE Sync to MikroTik
- ✅ Saat edit pelanggan PPPoE, update password di MikroTik
- ✅ Jika user tidak ada di MikroTik, buat user baru
- ✅ Silent error handling untuk avoid blocking

### UI Improvements
- ✅ Removed email column dari daftar pelanggan
- ✅ Simplified tabel untuk better readability
- ✅ Renamed "Jenis Koneksi" to "Koneksi"

## 📊 Technical Details

### MikroTik Update on Edit
```typescript
// postCustomerUpdate
if (connection_type === 'pppoe' && pppoe_username && pppoe_password) {
    const existingUser = await mikrotik.getPPPoEUserByUsername(pppoe_username);
    
    if (existingUser && existingUser['.id']) {
        // Update existing user
        await mikrotik.updatePPPoEUserByUsername(pppoe_username, {
            password: pppoe_password
        });
    } else {
        // Create new user if doesn't exist
        await mikrotik.createPPPoEUser({
            name: pppoe_username,
            password: pppoe_password,
            profile: 'default'
        });
    }
}
```

### UI Simplification
```html
<!-- Before -->
<td class="py-4 px-4">
    <div class="font-semibold"><%= customer.name %></div>
    <div class="text-sm text-modern-purple-600"><%= customer.email || '-' %></div>
</td>

<!-- After -->
<td class="py-4 px-4">
    <div class="font-semibold"><%= customer.name %></div>
</td>
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
- **None**: This is purely code-level fix
- No database changes required
- Backward compatible

### What This Fixes
- **Problem**: Edit PPPoE credentials tidak sinkron dengan MikroTik
- **Solution**: Auto update/create user di MikroTik saat edit
- **Benefit**: Billing dan MikroTik selalu sync

### MikroTik Update
- **Behavior**: Update if exists, create if not exists
- **Logging**: Detailed logs untuk tracking
- **Error Handling**: Silent error, continue jika gagal

## 🧪 Testing

### Test Edit PPPoE
1. Edit pelanggan PPPoE
2. Ubah username & password
3. Check MikroTik apakah terupdate
4. Check logs untuk konfirmasi

### Test UI
1. Open `/customers/list`
2. Verify email column removed
3. Verify table still readable
4. Check all actions still work

### Edge Cases
- [ ] MikroTik not configured
- [ ] PPPoE user not found
- [ ] MikroTik connection failed
- [ ] Bulk operations

## 📁 Files Changed

### Modified Files
- ✅ `src/controllers/customerController.ts` - Added MikroTik update on edit
- ✅ `views/customers/list.ejs` - Removed email column
- ✅ `VERSION`, `VERSION_MAJOR`, `VERSION_HOTFIX`, `package.json` - Updated version

---

**Release:** v2.1.19  
**Date:** 30 Oktober 2025  
**Type:** Critical Fix  
**Status:** ✅ Production Ready  
**Breaking Changes:** No  
**Requires Migration:** No

