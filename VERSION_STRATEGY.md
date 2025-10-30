# 📦 Versioning Strategy

## 🎯 Konsep Versioning

### Format: `MAJOR.MINOR.PATCH.HOTFIX`

- **MAJOR** (2.x.x) → Breaking changes, fitur besar
- **MINOR** (x.1.x) → Fitur baru, tidak breaking
- **PATCH** (x.x.1) → Bug fixes yang perlu rebuild TypeScript
- **HOTFIX** (x.x.x.1) → Fix view/frontend tanpa rebuild

---

## 📋 Version Types

### 1. **Major Update** (2.0.0 → 3.0.0)
**Kapan:** Breaking changes, arsitektur baru
**Yang Berubah:** Backend logic, database schema, API
**Deployment:**
```bash
git pull
npm install
npm run build
pm2 restart billing-system
```
**Tampil di About:** ✅ YES

---

### 2. **Minor Update** (2.0.0 → 2.1.0)
**Kapan:** Fitur baru, enhancement
**Yang Berubah:** Backend + Frontend
**Deployment:**
```bash
git pull
npm install  # (jika ada dependency baru)
npm run build
pm2 restart billing-system
```
**Tampil di About:** ✅ YES

---

### 3. **Patch Update** (2.0.8 → 2.0.9)
**Kapan:** Bug fixes di backend/frontend
**Yang Berubah:** TypeScript code, perlu compile
**Deployment:**
```bash
git pull
npm run build
pm2 restart billing-system
```
**Tampil di About:** ✅ YES

---

### 4. **Hotfix Update** (2.0.8 → 2.0.8.1, 2.0.8.2)
**Kapan:** Fix UI/view cepat, tidak ubah backend
**Yang Berubah:** HANYA views/*.ejs, public/*, CSS
**Deployment:**
```bash
bash auto-update-views.sh
```
**Tampil di About:** ❌ NO (internal version only)

---

## 🗂️ File Structure

### VERSION Files
```
/billing
├── VERSION              → Full version (2.0.8.5)
├── VERSION_MAJOR        → Major version only (2.0.8)  [untuk About page]
├── package.json         → npm version (2.0.8.5)
└── views/about.ejs      → Read VERSION_MAJOR
```

---

## 🎨 About Page Display

**Tampilan:**
```
Billing System v2.0.8
Latest Stable Release
```

**Internal Version (footer):**
```
v2.0.8.5 (includes hotfixes)
```

---

## 📝 Examples

### Example 1: Interface Traffic Graph Fix (Hotfix)
```
Current: 2.0.8
Changes: views/prepaid/admin/dashboard.ejs (JavaScript smoothing)
New Version: 2.0.8.1
Deploy: bash auto-update-views.sh
About Page: Still shows v2.0.8
```

### Example 2: Import Bug Fix (Patch)
```
Current: 2.0.8
Changes: src/controllers/customerController.ts
New Version: 2.0.9
Deploy: git pull && npm run build && pm2 restart
About Page: Shows v2.0.9
```

### Example 3: New Prepaid Feature (Minor)
```
Current: 2.0.9
Changes: New prepaid modules, database schema
New Version: 2.1.0
Deploy: Full deployment with migration
About Page: Shows v2.1.0
```

---

## 🚀 Deployment Scripts

### For HOTFIX (Views Only)
```bash
bash auto-update-views.sh
```

### For PATCH/MINOR/MAJOR
```bash
bash full-deploy.sh
```

---

## 📊 Version History

| Version | Type | Changes | Rebuild? | About? |
|---------|------|---------|----------|--------|
| 2.0.8 | Patch | Address list fix | ✅ | ✅ |
| 2.0.8.1 | Hotfix | Graph smoothing v1 | ❌ | ❌ |
| 2.0.8.2 | Hotfix | Graph smoothing v2 | ❌ | ❌ |
| 2.0.8.3 | Hotfix | Rate cap + corruption | ❌ | ❌ |
| 2.0.8.4 | Hotfix | Gradual transition | ❌ | ❌ |
| 2.0.8.5 | Hotfix | Import + PPPoE fix | ❌ | ❌ |
| **2.0.9** | **Patch** | **Next stable** | ✅ | ✅ |

---

## 🔄 Migration Plan

### Current State (v2.0.8.5)
- Terlalu banyak hotfix (.1, .2, .3, .4, .5)
- About page bingung harus tampilkan apa

### Recommended Next Version
**v2.0.9** (Stable Release)
- Merge semua hotfix 2.0.8.1 - 2.0.8.5
- Test semua fitur
- Release sebagai v2.0.9 stable
- About page: Show "v2.0.9"

---

## 🛠️ Implementation

### 1. Create VERSION_MAJOR file
```bash
echo "2.0.8" > VERSION_MAJOR
```

### 2. Update versionMiddleware.ts
```typescript
// Read VERSION_MAJOR for About page
const majorVersion = readFileSync('VERSION_MAJOR').trim();

// Read VERSION for footer/internal
const fullVersion = readFileSync('VERSION').trim();

res.locals.appVersion = majorVersion;      // 2.0.8 for About
res.locals.fullVersion = fullVersion;       // 2.0.8.5 for footer
```

### 3. Update About page
```html
<h2>Billing System v<%= appVersion %></h2>
<small>Build: <%= fullVersion %></small>
```

---

## ✅ Benefits

1. **Clear versioning** - User tahu versi stable (2.0.8)
2. **Fast hotfix** - No rebuild untuk fix UI
3. **About page clean** - Tidak tampilkan .1, .2, .3 yang membingungkan
4. **Internal tracking** - Still track full version (2.0.8.5) di footer
5. **Auto-update capable** - Script untuk update views only

---

## 📞 Support

For questions about versioning strategy:
- Major/Minor updates: Koordinasi dengan team
- Hotfix: Dapat dilakukan sendiri dengan auto-update-views.sh

