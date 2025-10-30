# 📋 Changelog v2.1.2

**Release Date:** October 30, 2025  
**Type:** Patch Release

---

## 🎯 What's New

Minor improvements and bug fixes for better user experience.

---

## ✨ Features

### Billing Management Enhancement

**Isolated Customers Filter**
- New filter dropdown in `/billing/tagihan` page
- Three filtering options:
  - **Tampilkan Semua** - Show all customers (default)
  - **🚫 Sembunyikan Isolir** - Hide isolated customers from list
  - **⚠️ Hanya Isolir** - Show only isolated customers
- Helps manage billing separately for isolated customers
- Easy identification of customers who need attention

---

## 🐛 Bug Fixes

### Critical Fixes

**Hotfix Check Error**
- Fixed `JSON.parse: unexpected character` error in hotfix check
- Added timeout handling for Git operations (10s fetch, 5s show)
- Better error handling when GitHub is unreachable
- Graceful fallback to local version if remote unavailable
- More robust error messages for users

**Error Handling Improvements**
- Git commands now have proper timeouts
- Better fallback mechanisms
- Clearer error messages to users
- No more cryptic JSON errors

---

## 🎨 UI/UX Improvements

**Interface Cleanup**
- Removed "Node 18 • Express • MySQL" tech stack badge from header
- Cleaner, more professional look
- Better focus on content

**Text Improvements**
- Changed "About Aplikasi" to "Tentang Aplikasi"
- More formal Indonesian language
- Better consistency across the application

**Billing Filter UI**
- New visually distinct filter for isolated customers
- Orange border for isolated filter (vs blue for other filters)
- Icon indicators (🚫 and ⚠️) for easy recognition
- Responsive design works on mobile

---

## 🔧 Technical Improvements

**Backend**
- Added `hide_isolated` query parameter support
- SQL query optimization for isolated customers
- Better parameter handling in billing controller

**Frontend**
- New select dropdown with 3 options
- Proper state management for filter
- URL parameters preserved across filters

---

## 📦 Files Changed

```
views/billing/tagihan.ejs           - Added isolated filter UI
src/controllers/billingController.ts - Added isolated filter logic  
src/controllers/aboutController.ts   - Improved error handling
views/partials/header.ejs           - Removed tech stack badge
views/about/index.ejs               - Changed title
package.json                         - Version bump to 2.1.2
VERSION*                            - Updated to 2.1.2
```

---

## 🚀 Deployment

**No Breaking Changes** - Safe to deploy

```bash
# Pull latest
git pull origin main
git checkout v2.1.2

# Restart
pm2 restart billing-app

# Verify
pm2 list  # Should show v2.1.2
```

---

## 📋 Testing Checklist

- [x] Hotfix check works without errors
- [x] Isolated filter shows/hides customers correctly
- [x] "Only Isolated" filter works
- [x] UI looks clean without tech stack badge
- [x] "Tentang Aplikasi" displays correctly
- [x] All existing features still work
- [x] No console errors
- [x] Responsive on mobile

---

## 🔮 What's Next

**Planned for Future Releases:**

- Enhanced WhatsApp binding layout
- Auto-redirect to billing portal after 5 minutes inactivity
- WhatsApp bot improvements for customer status
- Telegram bot database cleanup
- Changelog viewer in sidebar
- Additional filter improvements

---

## 📞 Support

**Known Issues:** None

**If you encounter issues:**
1. Clear browser cache (Ctrl + Shift + Delete)
2. Hard refresh (Ctrl + Shift + R)
3. Check PM2 logs: `pm2 logs billing-app`
4. Verify version: `cat VERSION`

---

## 🔗 Links

- **GitHub Release:** [v2.1.2](https://github.com/adiprayitno160-svg/billing/releases/tag/v2.1.2)
- **Full Changelog:** [v2.1.1...v2.1.2](https://github.com/adiprayitno160-svg/billing/compare/v2.1.1...v2.1.2)

---

**Released with ❤️ on October 30, 2025**

**Version:** 2.1.2  
**Type:** Patch Release  
**Commits:** 3

