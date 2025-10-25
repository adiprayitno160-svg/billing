# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-25

### ✨ Added
- **Auto-Update System** - Complete auto-update functionality from GitHub
  - Check for updates with one click
  - Automatic backup before update
  - Automatic rollback on failure
  - Update history tracking
  - Update channel selection (stable/beta/dev)
- **GitHub Integration Service** - Service to interact with GitHub API
  - Fetch latest releases
  - Compare versions
  - Download updates
- **Update Service** - Core update engine with safety features
  - Backup current state before update
  - Git-based update mechanism
  - Automatic dependency installation
  - TypeScript rebuild after update
  - PM2 restart management
- **Database Tables** - New tables for system management
  - `system_settings` - Application configuration
  - `update_history` - Track all updates
- **Database Migration** - SQL migration script for new tables
- **Updated About Page** - Modern UI with update controls
  - Version information display
  - Update settings panel
  - Feature list with status
  - Changelog display
  - Update history table
  - Update modal with changelog

### 🔧 Changed
- Updated About controller with update endpoints
- Updated About service to integrate with update system
- Reorganized routes for better structure

### 🧹 Removed
- **Debug/Fix Documentation** (17 files) - Removed temporary documentation
  - FIX_TELEGRAM_AND_ABOUT_PAGE.md
  - THERMAL_PRINT_TOTAL_BOX_FIX.md
  - PAYMENT_PAGE_MODERNIZATION.md
  - THERMAL_PRINT_CONSISTENCY_FIX.md
  - BACKUP_RESTORE_GUIDE.md
  - THERMAL_PRINT_REVISIONS.md
  - THERMAL_PRINT_IMPROVEMENTS.md
  - PRINT_ODC_FULL_INVOICE_FORMAT.md
  - FIX_PRINT_SIDEBAR_ISSUE.md
  - PRINT_BUTTONS_CSP_FIX.md
  - KASIR_FIXES_FINAL.md
  - KASIR_REPORTS_FIX.md
  - KASIR_PRINT_ACCESS_FIX.md
  - KASIR_FIXES_COMPLETE.md
  - PRINT_THERMAL_COMPLETE_SUMMARY.md
  - FIX_PRINT_THERMAL_INDIVIDUAL.md
  - PRINT_ODC_IMPLEMENTATION_COMPLETE.md
- **Test/Debug HTML Files** (6 files)
  - fix-telegram-settings-table.html
  - TEST_PRINT_KASIR.html
  - PRINT_THERMAL_QUICK_GUIDE.html
  - fix-sla-database.html
  - public/test-buttons-debug.html
  - public/test-cache.html
- **Debug JavaScript Files** (3 files)
  - check-kasir-user.js
  - test-kasir-login.js
  - fix-kasir-password.js
- **Debug SQL Files** (2 files)
  - sql_telegram_settings.sql
  - FIX-KASIR-LOGIN.sql
- **Test Batch Files** (3 files)
  - cleanup-before-git.bat
  - FIX-KASIR-LOGIN.bat
  - TEST_PRINT_INDIVIDUAL_THERMAL.bat
- **Debug Images** (1 file)
  - onclick_debug.png

### 📚 Documentation
- Added `AUTO_UPDATE_SETUP_GUIDE.md` - Complete setup guide for auto-update system
- Added `CHANGELOG.md` - Project changelog
- Updated `.gitignore` with better patterns to prevent debug files

### 🔐 Security
- Protected files (`.env`, `uploads/`, `backups/`, etc.) are safe during updates
- Automatic backup before any update operation
- Rollback capability in case of update failure

### 📊 Statistics
- **Files Changed:** 25 files
- **Lines Removed:** 5,645 lines (cleanup)
- **Lines Added:** 1,447 lines (new features)
- **Net Change:** -4,198 lines (cleaner codebase!)

---

## [1.0.0] - 2025-10-25

### 🎉 Initial Release

#### Core Features
- **Billing Management System**
  - Customer management with auto-generated IDs
  - Invoice generation and tracking
  - Payment processing and history
  - Multiple payment gateways (Midtrans, Tripay, Xendit)
  
- **Network Management**
  - MikroTik RouterOS integration
  - PPPoE user management
  - Static IP management
  - Bandwidth monitoring
  
- **FTTH Infrastructure**
  - OLT (Optical Line Terminal) management
  - ODC (Optical Distribution Cabinet) tracking
  - ODP (Optical Distribution Point) mapping
  - ONT (Optical Network Terminal) management
  
- **Prepaid System**
  - Prepaid package management
  - Voucher generation
  - Auto-renewal system
  - Speed profile management
  
- **Kasir/POS System**
  - Cash register interface
  - Payment collection
  - Receipt printing (thermal & A4)
  - Transaction history
  
- **Monitoring & SLA**
  - Real-time network monitoring
  - SLA (Service Level Agreement) tracking
  - Uptime monitoring
  - Performance metrics
  - Maintenance scheduling
  
- **Communication**
  - WhatsApp Bot integration
  - Telegram Bot notifications
  - Email notifications
  - Customer portal
  
- **System Features**
  - Multi-user management with roles
  - Database backup & restore
  - Print system (thermal & A4)
  - Excel export/import
  - Dashboard with analytics
  
#### Technical Stack
- **Backend:** Node.js + TypeScript + Express.js
- **Database:** MySQL/MariaDB
- **Frontend:** EJS Templates + TailwindCSS
- **Process Manager:** PM2
- **Network:** MikroTik RouterOS API
- **Payment:** Midtrans, Tripay, Xendit
- **Communication:** whatsapp-web.js, node-telegram-bot-api

---

## Future Releases

### Planned Features
- [ ] Auto-update scheduler (periodic checks)
- [ ] Email notifications for updates
- [ ] Telegram notifications for system events
- [ ] Multi-server deployment support
- [ ] Database migration automation
- [ ] Performance optimization
- [ ] Enhanced reporting
- [ ] Mobile app integration
- [ ] API documentation
- [ ] Webhook support for GitHub events

---

**Repository:** https://github.com/adiprayitno160-svg/billing_system  
**License:** Proprietary  
**Maintainer:** Adi Prayitno

