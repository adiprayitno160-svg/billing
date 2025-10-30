# 📋 Changelog v2.0.10

**Release Date:** October 30, 2025

## 🎨 Dashboard UI Improvements

### Prepaid System Card Redesign
- **New Vibrant Gradient Background:** Purple → Pink → Orange gradient for modern, premium look
- **Enhanced Icon Visibility:** Clean white icons with drop shadow on dark background
- **Removed Decorative Dots Pattern:** Clean, smooth gradient without distracting patterns
- **Improved Text Contrast:** All text now in white with drop shadow for maximum readability

### Stats Cards Enhancement
- **Better Icon Proportions:** Reduced icon sizes from large to balanced (w-5 h-5)
- **Clearer Visual Hierarchy:** Better spacing and layout
- **Total Prepaid Icon:** Updated to user group icon for better representation
- **Improved Hover Effects:** Smooth transitions and shadow effects

### Status Scheduler Clean Design
- **Removed Background Box:** Eliminated samar-samar (faint) white background box
- **Transparent Integration:** Status now blends seamlessly with gradient background
- **Better Badge Design:** Green badge with white text and pulse animation
- **Enhanced Typography:** White text with drop shadow for clarity

### Bulk Delete Action Bar
- **Inline Positioning:** Moved from fixed bottom to inline above table
- **Smart Visibility:** Only appears when items are selected
- **Smooth Transitions:** Uses max-height and opacity for elegant animation
- **Modern Confirmation Modal:** Custom styled modal replacing browser confirm dialog

## ⚡ Performance Optimization

### Interface Traffic Realtime Chart
- **Fetch Interval:** Increased from 2 seconds to 4 seconds
- **Reduced CPU Usage:** Less frequent data fetching = smoother performance
- **Better Smoothing:** Adjusted smoothing buffer from 5 to 10 samples (40 seconds)
- **Accurate Rate Calculation:** Updated to divide by 4 seconds instead of 2
- **Overflow Detection:** Increased threshold to 4GB in 4 seconds
- **Chart Labels:** Updated to reflect 4-second intervals

### Benefits
- ✅ Smoother chart animations
- ✅ Reduced system load
- ✅ Better user experience
- ✅ More stable data visualization

## 🐛 Bug Fixes

### Customer Import Error
- **Issue:** `Field 'customer_code' doesn't have a default value` error during Excel import
- **Root Cause:** Database field required value but application sent empty string
- **Solution:**
  - Updated database schema to allow NULL for `customer_code`
  - Modified `excelController.ts` to generate unique customer codes
  - Added fallback to NULL if code generation fails
  - Format: `CUST-{timestamp}-{random}` for uniqueness

### Delete Button UX
- **Issue:** Delete button always visible near filter icon, confusing users
- **Solution:**
  - Removed fixed delete button from header
  - Implemented inline bulk action bar that appears only when items are selected
  - Added clear "Cancel" and "Delete Selected" actions
  - Shows count of selected items dynamically

### Text Contrast Issues
- **Issue:** Text not visible on light/pastel backgrounds
- **Solution:**
  - Changed to dark gradient backgrounds
  - Applied white text with drop shadows
  - Ensured WCAG contrast ratio compliance
  - Tested readability across different screen types

## 📦 Files Changed

### Backend
- `package.json` - Version bump to 2.0.10
- `src/controllers/customerController.ts` - Customer code handling
- `src/controllers/excelController.ts` - Import error fixes

### Frontend
- `views/dashboard/index.ejs` - Prepaid System card redesign, stats cards, scheduler
- `views/customers/list.ejs` - Bulk action bar implementation
- `views/prepaid/admin/dashboard.ejs` - Traffic chart performance optimization

## 🔄 Breaking Changes

None. This release is fully backward compatible.

## 📊 Statistics

- **Files Changed:** 6
- **Insertions:** 609 lines
- **Deletions:** 147 lines
- **Net Change:** +462 lines

## 🚀 Upgrade Instructions

1. Pull latest changes:
   ```bash
   git pull origin main
   ```

2. Restart PM2:
   ```bash
   pm2 restart billing-app
   ```

3. Clear browser cache for UI changes to take effect

## 🎯 Next Steps

Future improvements planned:
- [ ] Additional performance optimizations
- [ ] More UI/UX enhancements based on user feedback
- [ ] Enhanced error handling and validation
- [ ] Additional chart customization options

## 🙏 Credits

All improvements based on real user feedback and testing.

---

**Full Changelog:** [v2.0.9...v2.0.10](https://github.com/adiprayitno160-svg/billing/compare/v2.0.9...v2.0.10)

