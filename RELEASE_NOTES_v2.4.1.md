# Release Notes - Version 2.4.1
**Release Date:** 2025-12-30
**Git Tag:** v2.4.1

## 🐛 Critical Bug Fixes

### Customer Edit Page Error (Status 500)
- ✅ **Fixed "viewInterfaces is not defined" error** in `/customers/:id/edit`
- **Root Cause**: Variable `interfaces` was passed to view but could be undefined/null in some cases
- **Solution**: Added proper Array validation and default empty array fallback
- **Impact**: Customer edit page now works reliably even when MikroTik interfaces fail to load

### Technical Changes:
```typescript
// Before (could cause error):
interfaces: interfaces || [],

// After (safe with validation):
interfaces: interfaces && Array.isArray(interfaces) ? interfaces : [],
```

### Applied to all view variables:
- ✅ `packages` - Validated as array with fallback
- ✅ `interfaces` - Validated as array with fallback  
- ✅ `interfaceError` - Ensured null instead of undefined
- ✅ `odpData` - Validated as array with fallback

## 🔧 Files Changed
- `src/controllers/customerController.ts` - Enhanced getCustomerEdit function with better error handling

## 📋 Version 2.4.x Summary

### v2.4.1 (Current)
- Fixed customer edit page error 500

### v2.4.0
- Fixed TypeScript errors in production code
- Added GenieACS setParameterValues method
- Fixed type inconsistencies across services
- Updated feature documentation

## 🚀 Deployment

### Update to 2.4.1:
```bash
# Pull latest code (if using git)
git pull origin main

# Or manually replace the file:
# src/controllers/customerController.ts

# Build TypeScript
npm run build

# Restart application
pm2 restart billing-app
pm2 save
```

### Quick Fix (if PM2 not used):
```bash
# Just restart the server
npm run build
# Then restart your Node process
```

## ✅ Verification Steps
After update, test the following:
1. Navigate to **Customers List** (`/customers/list`)
2. Click **Edit** on any customer
3. Page should load without error 500
4. Interface dropdown should show either:
   - Available interfaces (if MikroTik connected)
   - Empty with error message (if MikroTik not available)
5. Form should be fully functional

## 🐛 Known Issues
None critical. Previous issues from v2.4.0 still apply:
- Test routes in `src/routes/index.ts` have TypeScript errors (non-production code)

## 📞 Support
If you still encounter issues:
1. Clear browser cache
2. Check PM2 logs: `pm2 logs billing-app`
3. Verify MikroTik connectivity (optional, not required for edit page to work)
4. Check database connection

---

**Previous Releases:**
- [v2.4.0](./RELEASE_NOTES_v2.4.0.md) - TypeScript fixes & feature documentation
- [v2.3.14](./RELEASE_NOTES_v2.3.14.md) - WhatsApp Bot & Gemini AI fixes

**Contributors:** Development Team  
**License:** ISC
