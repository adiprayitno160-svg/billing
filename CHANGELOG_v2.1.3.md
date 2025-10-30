# 📋 Changelog v2.1.3

**Release Date:** October 30, 2025  
**Type:** Feature Release

---

## 🎉 What's New in v2.1.3

Enhanced user experience with productivity features, better visibility of updates, and system maintenance tools.

---

## ✨ New Features

### 1. Auto-Redirect System ⏰

**Automatic redirect to billing dashboard after inactivity**

- **Idle Detection:** Monitors user activity for 5 minutes
- **Smart Warning:** Shows popup notification at 4-minute mark
- **User Control:** "Tetap Di Sini" button to cancel redirect
- **Activity Tracking:** Detects mouse movement, keyboard input, clicks, scrolls, and touch events
- **Smart Exclusions:** Won't redirect from login page or billing dashboard itself

**Benefits:**
- Automatically returns inactive users to main dashboard
- Reduces accidental session timeouts on forgotten tabs
- Improves security by moving users to main view
- Saves time by eliminating manual navigation

**User Experience:**
```
Minute 0-3: Normal usage, no interruption
Minute 4:   Warning popup appears (bottom-right)
            "Tidak Ada Aktivitas - Will redirect in 1 minute..."
            [Tetap Di Sini] button available
Minute 5:   Auto-redirect to /billing/dashboard
```

---

### 2. Changelog Widget in Sidebar 📋

**Always-visible update information**

- **Prominent Display:** Purple gradient widget at bottom of sidebar
- **Latest Version:** Shows current version number (v2.1.3)
- **Top 3 Changes:** Highlights most important updates
- **Quick Access:** Link to full changelog in About page
- **Modern Design:** Eye-catching gradient with green checkmarks

**Widget Content:**
- Version number with timestamp
- Three most recent/important changes
- Visual indicators (✓ green checkmarks)
- Call-to-action link

**Benefits:**
- Users always aware of latest version
- Quick overview of new features
- Encourages exploration of updates
- Reduces "what's new?" questions

---

### 3. Telegram Database Cleanup Tool 🧹

**Comprehensive cleanup script for Telegram bot data**

**Script:** `scripts/cleanup-telegram.js`

**Features:**
- Removes all telegram user registrations
- Clears message history
- Deletes sessions and notifications
- Resets telegram commands
- Shows detailed progress
- 3-second confirmation delay
- Comprehensive summary report

**Tables Cleaned:**
- `telegram_users`
- `telegram_messages`
- `telegram_sessions`
- `telegram_notifications`
- `telegram_commands`
- `telegram_subscriptions`

**Safety Features:**
- 3-second warning before execution
- Press Ctrl+C to cancel
- Detailed progress display
- Error handling per table
- Summary of records deleted

**Usage:**
```bash
node scripts/cleanup-telegram.js

# Output:
⚠️  WARNING: Telegram Database Cleanup
This will DELETE ALL telegram bot data including:
  • User registrations
  • Chat history
  • Sessions
  • Notifications

Starting cleanup in 3 seconds...
Press Ctrl+C to cancel

✅ Cleaned 'telegram_users': 150 records deleted
✅ Cleaned 'telegram_messages': 523 records deleted
...
📊 Total records deleted: 673
```

---

## 🎨 UI/UX Improvements (from v2.1.2)

### Isolated Customer Filter

**Better billing management**
- Filter dropdown in `/billing/tagihan`
- Three options:
  - Tampilkan Semua (show all)
  - 🚫 Sembunyikan Isolir (hide isolated)
  - ⚠️ Hanya Isolir (only isolated)
- Helps manage isolated customers separately

### Interface Cleanup

**Cleaner, more professional look**
- Removed "Node 18 • Express • MySQL" tech badge
- Changed "About Aplikasi" to "Tentang Aplikasi"
- Better error handling in hotfix check

---

## 🔧 Technical Improvements

### Backend Enhancements

**Billing Controller:**
- Added `hide_isolated` query parameter
- SQL filtering for isolated customers
- Better customer status management

**About Controller:**
- Improved error handling for hotfix checks
- Timeout handling for Git operations (10s fetch, 5s show)
- Graceful fallback when GitHub unreachable
- Better error messages for users

### Frontend Enhancements

**Main Layout:**
- Auto-redirect JavaScript implementation
- Activity event listeners
- Popup warning system
- Clean inline script

**Sidebar:**
- Dynamic changelog widget
- Version-aware display
- Responsive design
- Gradient animations

---

## 📦 Files Changed

**New Files:**
```
scripts/cleanup-telegram.js    - Telegram cleanup tool
CHANGELOG_v2.1.3.md           - This changelog
```

**Modified Files:**
```
package.json                   - Version 2.1.3
VERSION*                       - Updated to 2.1.3
views/partials/sidebar.ejs     - Added changelog widget
views/layouts/main.ejs         - Added auto-redirect script
views/billing/tagihan.ejs      - Added isolated filter (v2.1.2)
src/controllers/billingController.ts  - Filter support (v2.1.2)
src/controllers/aboutController.ts    - Error handling (v2.1.2)
views/partials/header.ejs      - Removed tech badge (v2.1.2)
views/about/index.ejs          - Title update (v2.1.2)
```

---

## 📊 Statistics

**Code Changes:**
```
Commits:       6 commits (including v2.1.2 fixes)
Files Changed: 11 files
Additions:     +700+ lines
Deletions:     -45 lines
Net Change:    +655 lines
```

**Features Added:**
- 3 major new features
- 4 UI/UX improvements
- 2 technical enhancements
- 1 cleanup tool

---

## 🚀 Deployment

### Prerequisites
- Git access to repository
- PM2 installed
- Node.js v18+ (recommended v22)
- MySQL database

### Update Steps

**Method 1: Git Pull (Recommended)**
```bash
cd /path/to/billing
git pull origin main
git checkout v2.1.3
pm2 restart billing-app
pm2 list  # Verify version 2.1.3
```

**Method 2: Fresh Clone**
```bash
git clone https://github.com/adiprayitno160-svg/billing.git
cd billing
git checkout v2.1.3
npm install
pm2 start ecosystem.config.js
```

**Method 3: Tag Checkout**
```bash
git fetch --tags
git checkout tags/v2.1.3
pm2 restart billing-app
```

### Verification

```bash
# Check version files
cat VERSION        # Should show: 2.1.3
cat VERSION_HOTFIX # Should show: 2.1.3

# Check PM2
pm2 list           # Version column: 2.1.3

# Check in browser
# Login → Check sidebar widget → Should show v2.1.3
```

---

## 🧪 Testing Checklist

### Auto-Redirect Feature
- [ ] Open any page except /billing/dashboard
- [ ] Wait 4 minutes without activity
- [ ] Warning popup appears
- [ ] Click "Tetap Di Sini" - redirect cancelled
- [ ] Wait 1 more minute - auto redirect works
- [ ] Login page doesn't redirect
- [ ] Dashboard page doesn't redirect

### Changelog Widget
- [ ] Visible in sidebar at bottom
- [ ] Shows v2.1.3
- [ ] Shows 3 latest features
- [ ] Link to About page works
- [ ] Responsive on mobile

### Telegram Cleanup
- [ ] Run: `node scripts/cleanup-telegram.js`
- [ ] 3-second warning appears
- [ ] Can cancel with Ctrl+C
- [ ] Cleans all telegram tables
- [ ] Shows progress and summary

### Isolated Filter
- [ ] Filter dropdown visible
- [ ] "Sembunyikan Isolir" hides isolated customers
- [ ] "Hanya Isolir" shows only isolated
- [ ] "Tampilkan Semua" shows all
- [ ] Filter persists in URL

---

## 🐛 Known Issues

**None reported** - This is a stable release.

If you encounter any issues:
1. Check PM2 logs: `pm2 logs billing-app`
2. Verify version: `cat VERSION`
3. Clear browser cache: Ctrl + Shift + Delete
4. Hard refresh: Ctrl + Shift + R

---

## 🔮 What's Next

### Planned for v2.2.0 or Future Releases

**WhatsApp Features:**
- Bot improvements for customer status
- Enhanced binding UI
- Message templates
- Automation features

**System Enhancements:**
- Enhanced changelog viewer
- More automation tools
- Performance optimizations
- Additional filters and reports

**User Requests:**
- (To be collected from user feedback)

---

## 🎯 Migration Notes

**From v2.1.2 to v2.1.3:**

**No Breaking Changes** - Safe to upgrade

**Database:**
- No schema changes required
- Existing data not affected

**Configuration:**
- No config changes needed
- All settings preserved

**Sessions:**
- Users won't be logged out
- No session disruption

---

## 📞 Support

**Getting Help:**

1. **Check Documentation:**
   - HOTFIX.md for hotfix system
   - This CHANGELOG for release notes
   - README.md for general info

2. **Common Issues:**
   - Auto-redirect too aggressive? Activity detection is very sensitive
   - Telegram cleanup failed? Check database permissions
   - Changelog not showing? Hard refresh browser

3. **Contact:**
   - Check GitHub Issues
   - Review closed issues for solutions
   - Create new issue if needed

---

## 🔗 Links

- **GitHub Release:** [v2.1.3](https://github.com/adiprayitno160-svg/billing/releases/tag/v2.1.3)
- **Full Changelog:** [v2.1.2...v2.1.3](https://github.com/adiprayitno160-svg/billing/compare/v2.1.2...v2.1.3)
- **Previous Release:** [v2.1.2](https://github.com/adiprayitno160-svg/billing/releases/tag/v2.1.2)

---

## 🙏 Acknowledgments

All features in this release were implemented based on user feedback and requests. Thank you for your continued support and suggestions!

**Special Thanks:**
- Users who reported issues
- Testers who verified fixes
- Everyone using the system

---

**Released with ❤️ on October 30, 2025**

**Version:** 2.1.3  
**Type:** Feature Release  
**Stability:** Stable  
**Recommended:** Yes

