# 🚀 Auto-Update System

## 🎯 Problem Statement

Sebelumnya setiap fix kecil (hotfix UI) harus:
1. ❌ `git pull`
2. ❌ `npm run build` → **ERROR: `tsc: not found`**
3. ❌ Wait 5-10 minutes untuk compile TypeScript
4. ❌ Version di About page jadi bingung (2.0.8.1, 2.0.8.2, dst)

## ✅ Solution: Dual Versioning + Auto-Update

### 📦 Version Strategy

**Format: `MAJOR.MINOR.PATCH.HOTFIX`**

| Type | Example | Changes | Rebuild? | About Page | Deploy Script |
|------|---------|---------|----------|------------|---------------|
| **Major** | 2.0.0 → 3.0.0 | Breaking changes | ✅ | ✅ Shows 3.0.0 | `full-deploy.sh` |
| **Minor** | 2.0.0 → 2.1.0 | New features | ✅ | ✅ Shows 2.1.0 | `full-deploy.sh` |
| **Patch** | 2.0.8 → 2.0.9 | Backend bug fixes | ✅ | ✅ Shows 2.0.9 | `full-deploy.sh` |
| **Hotfix** | 2.0.8 → 2.0.8.1 | View/UI fixes | ❌ | ❌ Shows 2.0.8 | `auto-update-views.sh` |

---

## 📁 File Structure

```
/billing
├── VERSION              → Full version (2.0.8.5) - internal tracking
├── VERSION_MAJOR        → Major version (2.0.8) - untuk About page
├── package.json         → npm version (2.0.8.5)
│
├── auto-update-views.sh → Deploy HOTFIX (views only, no rebuild)
├── full-deploy.sh       → Deploy PATCH/MINOR/MAJOR (full rebuild)
├── setup-dependencies.sh → Fix "tsc: not found" error
│
└── VERSION_STRATEGY.md  → Complete versioning documentation
```

---

## 🚀 Usage

### For HOTFIX (UI/View Changes Only)

**When:** Fix JavaScript, EJS templates, CSS without changing backend

```bash
bash auto-update-views.sh
```

**What it does:**
- ✅ Pull latest views & public files from GitHub
- ✅ Update VERSION file
- ✅ Backup old views (for safety)
- ✅ Restart PM2 (optional)
- ❌ **NO TypeScript rebuild** (faster!)

**Example:** Interface traffic graph smoothing fix

---

### For PATCH/MINOR/MAJOR (Backend Changes)

**When:** Bug fixes in TypeScript, new features, backend logic changes

```bash
bash full-deploy.sh
```

**What it does:**
- ✅ Pull all changes from GitHub
- ✅ Install new dependencies (if any)
- ✅ **Build TypeScript** (`npm run build`)
- ✅ Restart PM2
- ✅ Save PM2 configuration

**Example:** Customer import bug fix, PPPoE package creation fix

---

### Fix "tsc: not found" Error

**When:** TypeScript compiler missing on server

```bash
bash setup-dependencies.sh
```

**What it does:**
- ✅ Clean node_modules
- ✅ Fresh `npm install`
- ✅ Install TypeScript globally if needed
- ✅ Build project

---

## 📊 Version Display

### About Page (`/about`)
```html
<h2>Billing System v2.0.8</h2>
<p>Latest Stable Release</p>
```
- Shows **VERSION_MAJOR** (clean, stable version)
- Does NOT show hotfix numbers (.1, .2, .3)

### Footer (All Pages)
```html
<span>v2.0.8.5 (includes hotfixes)</span>
```
- Shows **VERSION** (full version)
- Internal tracking with hotfix numbers

---

## 🔄 Deployment Workflow

### Scenario 1: Fix Graph Smoothing (Hotfix)

**Current:** `2.0.8`  
**Files Changed:** `views/prepaid/admin/dashboard.ejs`  
**New Version:** `2.0.8.6`

**Steps:**
```bash
# Developer
git commit -m "Fix: Improve graph smoothing algorithm"
echo "2.0.8.6" > VERSION  # Update full version
git push origin main

# Server
bash auto-update-views.sh
```

**Result:**
- About page: Still shows `v2.0.8` ✅
- Footer: Shows `v2.0.8.6`
- Deploy time: **~30 seconds** (no rebuild)

---

### Scenario 2: Fix Import Bug (Patch)

**Current:** `2.0.8`  
**Files Changed:** `src/controllers/customerController.ts`  
**New Version:** `2.0.9`

**Steps:**
```bash
# Developer
git commit -m "Fix: Make email optional in customer import"
echo "2.0.9" > VERSION
echo "2.0.9" > VERSION_MAJOR  # Update major version!
npm version 2.0.9
git push origin main

# Server
bash full-deploy.sh
```

**Result:**
- About page: Shows `v2.0.9` ✅
- Footer: Shows `v2.0.9`
- Deploy time: **~5 minutes** (rebuild needed)

---

## 📝 Best Practices

### When to Use Hotfix (.1, .2, .3)?
✅ **YES:**
- JavaScript changes in EJS files
- CSS/styling updates
- Text/label changes
- View logic improvements

❌ **NO:**
- TypeScript controller changes
- Database migrations
- New API endpoints
- Service layer changes

### When to Bump PATCH (2.0.8 → 2.0.9)?
- After accumulating multiple hotfixes
- Backend bug fixes
- Merge all hotfixes into stable release

### When to Bump MINOR (2.0.x → 2.1.0)?
- New features
- New modules
- Major enhancements

### When to Bump MAJOR (2.x.x → 3.0.0)?
- Breaking changes
- Complete redesign
- Architecture changes

---

## 🛠️ Troubleshooting

### Problem: `tsc: not found`
**Solution:**
```bash
bash setup-dependencies.sh
```

### Problem: PM2 process not found
**Solution:**
```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

### Problem: Build failed after git pull
**Solution:**
```bash
npm install  # Update dependencies
npm run build
```

### Problem: Views not updating
**Solution:**
```bash
pm2 restart billing-system  # Clear cache
# Or
pm2 reload billing-system
```

---

## 📈 Version History Example

```
2.0.7 (Patch) → Interface traffic feature
2.0.8 (Patch) → Address list fix
├── 2.0.8.1 (Hotfix) → Graph smoothing v1
├── 2.0.8.2 (Hotfix) → Graph smoothing v2  
├── 2.0.8.3 (Hotfix) → Rate cap + corruption
├── 2.0.8.4 (Hotfix) → Gradual transition
└── 2.0.8.5 (Hotfix) → Import + PPPoE fix

2.0.9 (Patch) → Merge all 2.0.8.x hotfixes [NEXT STABLE]
```

---

## 🎉 Benefits

1. ⚡ **Fast Hotfix** - Deploy UI fixes in seconds
2. 🔧 **No Build Errors** - Avoid `tsc: not found` for hotfixes
3. 📱 **Clean About Page** - Users see stable version only
4. 📊 **Internal Tracking** - Full version in footer for debugging
5. 🚀 **Auto-Update** - Scripts handle everything automatically

---

## 📞 Support

**For Developers:**
- Hotfix changes: Use `auto-update-views.sh`
- Backend changes: Use `full-deploy.sh`

**For Server Admin:**
- Missing packages: Run `setup-dependencies.sh`
- Check logs: `pm2 logs billing-system`

---

## 🔗 Related Files

- `VERSION_STRATEGY.md` - Detailed versioning strategy
- `auto-update-views.sh` - Hotfix deployment script
- `full-deploy.sh` - Full deployment script
- `setup-dependencies.sh` - Fix missing dependencies
- `src/middlewares/versionMiddleware.ts` - Version injection logic

---

**Last Updated:** 2025-10-30  
**System Version:** v2.0.8.5  
**Status:** ✅ Ready for Production

