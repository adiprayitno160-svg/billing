# Changelog v2.1.20 (2025-10-30)

## 🎯 Major Feature Enhancement

### PPPoE Username Search & Filter
- ✅ **Search-as-you-type** untuk mencari username PPPoE
- ✅ **Auto-filter** username yang sudah digunakan dari database
- ✅ **Dropdown results** dengan live filtering
- ✅ **Show profile info** untuk setiap username
- ✅ Applied to Add & Edit Customer forms

## 📊 Technical Details

### Backend: Auto-Filter Used Usernames
```typescript
// GET /api/pppoe/secrets
const [usedRows] = await databasePool.execute(
    'SELECT DISTINCT pppoe_username FROM customers WHERE pppoe_username IS NOT NULL AND pppoe_username != ""'
);
const usedUsernames = new Set(usedRows.map(r => r.pppoe_username));

const data = secrets
    .map(s => ({ id: s['.id'], name: s.name, profile: s.profile }))
    .filter(item => !usedUsernames.has(item.name)); // Only show unused
```

### Frontend: Search UI
```html
<!-- Input with dropdown results -->
<input type="text" id="pppoe_search" placeholder="Ketik untuk mencari username..." />
<div id="pppoe_search_results" class="hidden">
    <!-- Results shown here -->
</div>

<script>
function searchPPPoE(query) {
    const filtered = allSecrets.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase())
    );
    // Render results
}
</script>
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
- **Problem**: Username PPPoE sangat banyak di MikroTik, sulit dicari
- **Problem**: Username yang sudah digunakan masih muncul
- **Solution**: Search-as-you-type dengan auto-filter
- **Benefit**: Hanya tampilkan username tersedia, lebih cepat

### Features
- **Live Search**: Ketik untuk mencari username
- **Auto-Filter**: Hide username yang sudah digunakan
- **Profile Display**: Tampilkan profile untuk setiap username
- **Click to Select**: Click hasil untuk autofill username
- **Outside Click**: Results auto-hide saat click luar

## 🧪 Testing

### Test Search PPPoE
1. Open `/customers/new-pppoe`
2. Click on username field
3. Type beberapa karakter
4. Verify results appear
5. Click on result
6. Verify username filled

### Test Filter Used Usernames
1. Create customer dengan username "test01"
2. Open `/customers/new-pppoe`
3. Type "test"
4. Verify "test01" NOT in results
5. Open `/customers/{id}/edit`
6. Type "test"
7. Verify "test01" NOT in results

### Edge Cases
- [ ] No MikroTik config
- [ ] MikroTik connection failed
- [ ] Empty search results
- [ ] Special characters in username
- [ ] 1000+ usernames in MikroTik

## 📁 Files Changed

### Modified Files
- ✅ `src/routes/index.ts` - Added filter for used usernames
- ✅ `views/customers/edit.ejs` - Added search input + JavaScript
- ✅ `views/customers/new_pppoe.ejs` - Added search input + JavaScript
- ✅ `VERSION`, `VERSION_MAJOR`, `VERSION_HOTFIX`, `package.json` - Updated version

---

**Release:** v2.1.20  
**Date:** 30 Oktober 2025  
**Type:** Major Feature Enhancement  
**Status:** ✅ Production Ready  
**Breaking Changes:** No  
**Requires Migration:** No

