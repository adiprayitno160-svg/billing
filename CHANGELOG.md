# Changelog

All notable changes to Billing System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2025-01-26

### 🚀 Added - One-Click Installation System

#### Installation Scripts
- **NEW**: `install.sh` - One-click basic installation script
  - Auto-install Node.js 18.x LTS
  - Auto-install PM2 process manager
  - Auto-install MariaDB database
  - Auto-setup database with random secure password
  - Auto-clone repository and install dependencies
  - Auto-build and start application
  - Auto-configure firewall (UFW)
  - Generate secure session secret
  - Create backup script (`backup-db.sh`)
  - Create update script (`update.sh`)
  
- **NEW**: `setup-complete.sh` - Complete production setup script
  - All features from `install.sh`
  - Install and configure Nginx reverse proxy
  - Setup SSL certificate with Let's Encrypt
  - Auto-renewal SSL certificate
  - Enhanced security headers
  - Setup daily database backup (cron job)
  - Optional monitoring tools installation (htop, netdata)
  - Support for custom domain configuration
  
- **NEW**: `uninstall.sh` - Safe uninstallation script
  - Create final database backup
  - Backup configuration files
  - Stop and remove PM2 processes
  - Remove Nginx configuration
  - Optional SSL certificate removal
  - Optional database removal
  - Optional dependencies removal
  - Safe and guided removal process

#### Documentation
- **NEW**: `docs/INSTALLATION_SCRIPTS.md` - Complete guide for installation scripts
  - Detailed usage instructions
  - Examples for different scenarios
  - Troubleshooting guide
  - Post-installation checklist
  - Security recommendations
  - Backup and restore procedures
  
- **NEW**: `docs/QUICK_REFERENCE.md` - Quick reference card
  - PM2 management commands
  - Database operations
  - Nginx commands
  - SSL certificate management
  - Firewall configuration
  - System monitoring
  - Debugging commands
  - Emergency procedures
  
- **UPDATED**: `README.md`
  - Prominent one-click installation section at top
  - Clear differentiation between basic and production setup
  - Links to comprehensive documentation
  - Updated requirements and quick start guide
  
- **UPDATED**: `INSTALL_NATIVE.md`
  - Enhanced with more detailed explanations
  - Added troubleshooting section
  - Added monitoring setup
  - Added backup strategies
  - Added security recommendations

#### Features
- Auto-generated secure database passwords
- Auto-generated session secrets
- Automatic backup script creation
- Automatic update script creation
- Daily backup via cron job
- PM2 startup script for auto-start on reboot
- Nginx security headers
- SSL auto-renewal via certbot
- Firewall auto-configuration
- Interactive domain configuration
- Safe uninstallation with backup

### 🔧 Changed
- Installation process now takes ~10-15 minutes (vs 30-60 minutes manual)
- Database credentials auto-generated and saved securely
- Improved security with random passwords and secrets
- Better error handling in installation process
- More user-friendly installation experience

### 📚 Documentation Improvements
- Added step-by-step examples
- Added common scenarios and solutions
- Added troubleshooting guides
- Added security best practices
- Added backup and recovery procedures
- Added quick reference for daily operations

### 🔒 Security Enhancements
- Random secure password generation
- Temporary credential storage (user-removable)
- Secure file permissions for .env
- Enhanced Nginx security headers
- Automatic SSL certificate setup
- Firewall auto-configuration
- Session secret auto-generation

---

## [1.9.0] - 2025-01-15

### Added
- Prepaid billing system
- Customer portal
- Voucher management
- Auto-activation system
- Payment gateway integration (Midtrans, Xendit, Tripay)

### Changed
- Improved database connection pooling
- Enhanced error handling
- Better session management

### Fixed
- Database connection timeout issues
- Session persistence problems
- MikroTik API connection stability

---

## [1.8.0] - 2024-12-20

### Added
- FTTH Infrastructure Management
  - OLT management
  - ODC management
  - ODP management
- SLA Monitoring
- Incident management
- Maintenance scheduling

### Changed
- Improved dashboard UI
- Better customer listing performance
- Enhanced invoice generation

---

## [1.7.0] - 2024-11-15

### Added
- WhatsApp notification integration
- Telegram bot for notifications
- Email notification system
- Real-time monitoring dashboard

### Changed
- Updated to Node.js 18 LTS
- Migrated to TypeScript 5.x
- Improved build process

### Fixed
- Payment gateway webhook issues
- Invoice generation bugs
- Customer status synchronization

---

## [1.6.0] - 2024-10-10

### Added
- Static IP management
- Address list management
- Parent queue management
- Bulk operations for customers

### Changed
- Improved MikroTik integration
- Better error messages
- Enhanced logging

---

## [1.5.0] - 2024-09-05

### Added
- Kasir (POS) system
- Payment history
- Financial reports
- Excel export functionality

### Changed
- Improved billing dashboard
- Better invoice templates
- Enhanced PDF generation

### Fixed
- Invoice calculation errors
- Payment recording issues
- Date/time timezone problems

---

## [1.4.0] - 2024-08-01

### Added
- Customer portal self-service
- Invoice viewing for customers
- Payment status checking
- Profile management

### Changed
- Improved security
- Better authentication
- Enhanced session handling

---

## [1.3.0] - 2024-07-01

### Added
- MikroTik auto-isolation for overdue customers
- Bandwidth monitoring
- Network monitoring
- Ping monitoring

### Changed
- Improved MikroTik API integration
- Better error handling for RouterOS commands
- Enhanced PPPoE management

### Fixed
- MikroTik connection timeouts
- PPPoE user creation issues
- Bandwidth limiting problems

---

## [1.2.0] - 2024-06-01

### Added
- Automatic invoice generation
- Payment gateway integration
- Invoice printing (thermal & A4)
- PDF export for invoices

### Changed
- Improved billing calculation
- Better invoice templates
- Enhanced payment recording

---

## [1.1.0] - 2024-05-01

### Added
- Customer management (CRUD)
- Package management
- PPPoE user management
- Basic MikroTik integration

### Changed
- Improved UI/UX with TailwindCSS
- Better dashboard layout
- Enhanced customer listing

---

## [1.0.0] - 2024-04-01

### Added
- Initial release
- Basic billing system
- User authentication (admin/kasir)
- Dashboard
- Database schema
- Basic configuration

### Features
- Customer registration
- Manual invoice creation
- Payment recording
- Basic reporting
- User management

---

## Version History

| Version | Date       | Highlights                           |
|---------|------------|--------------------------------------|
| 2.0.0   | 2025-01-26 | One-Click Installation Scripts       |
| 1.9.0   | 2025-01-15 | Prepaid System & Customer Portal     |
| 1.8.0   | 2024-12-20 | FTTH Management & SLA Monitoring     |
| 1.7.0   | 2024-11-15 | WhatsApp & Telegram Integration      |
| 1.6.0   | 2024-10-10 | Static IP & Bulk Operations          |
| 1.5.0   | 2024-09-05 | Kasir System & Financial Reports     |
| 1.4.0   | 2024-08-01 | Customer Portal                      |
| 1.3.0   | 2024-07-01 | Network Monitoring                   |
| 1.2.0   | 2024-06-01 | Payment Gateway Integration          |
| 1.1.0   | 2024-05-01 | MikroTik Integration                 |
| 1.0.0   | 2024-04-01 | Initial Release                      |

---

## Upgrade Instructions

### From 1.x to 2.0.0

The 2.0.0 release focuses on installation improvements. No breaking changes to the application itself.

**If you installed manually before:**
1. Backup your database: `./backup-db.sh` or manual mysqldump
2. Pull latest code: `git pull origin main`
3. Install dependencies: `npm install --production`
4. Rebuild: `npm run build`
5. Restart: `pm2 restart billing-system`

**New installations:**
- Use one-click install script: `curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash`

**No database migrations required** - This is purely an installation/deployment improvement.

---

## Planned for Next Release (2.1.0)

- [ ] Docker support
- [ ] Docker Compose for easy deployment
- [ ] Kubernetes manifests
- [ ] API v2 with better authentication
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] 2FA authentication
- [ ] API rate limiting
- [ ] Webhook management UI

---

## Support

For questions about specific versions or upgrade issues:
- GitHub Issues: https://github.com/adiprayitno160-svg/billing/issues
- Documentation: Check README.md and docs/ folder

---

**Note**: This changelog started with version 2.0.0. Previous version history is reconstructed based on git history and may not be complete.

