# Release Notes - Version 2.4.0
**Release Date:** 2025-12-30
**Git Tag:** v2.4.0

## 🐛 Bug Fixes & TypeScript Error Corrections

### TypeScript Error Fixes
- ✅ **Fixed AddressList ServiceError** - Corrected return type in `getAddressListItemById` from `AddressList` to `AddressListItem`
- ✅ **Fixed Alert Routing Service** - Corrected `InternalAlert` type usage in `sendDowntimeAlert` method
- ✅ **Fixed Late Payment Tracking** - Corrected parameter types in `resetCounter` and WhatsApp message sending
- ✅ **Fixed Incident AI Service** - Proper type handling for critical alerts routing
- ✅ **Added GenieACS setParameterValues Method** - Added missing method for WiFi management and device parameter configuration

### Service Improvements
- 🔧 **GenieACS Service Enhancement**: Added generic `setParameterValues` method for flexible device parameter management
- 🔧 **Better Type Safety**: Improved type definitions across multiple services for better code reliability
- 🔧 **Cleaner Code**: Removed type inconsistencies that could cause runtime errors

## 📋 Fitur Aplikasi (Updated - v2.4.0)

### 1. **Customer Management** 
- ✅ CRUD pelanggan (Create, Read, Update, Delete)
- ✅ Customer code auto-generation  
- ✅ Status management (Active/Inactive)
- ✅ Automatic subscription tracking
- ✅ Advanced search & filtering
- ✅ Customer migration support (Hotspot ↔ PPPoE)
- ✅ Late Payment Tracking dengan auto-suspend trigger
- ✅ Customer detail view dengan payment history

### 2. **Invoice & Payment Management**
- ✅ Auto invoice generator bulanan
- ✅ Dynamic due date calculation
- ✅ Multiple payment Methods
 (Cash, Transfer, E-wallet)
- ✅ Payment proof upload & verification
- ✅ **🤖 Gemini AI Auto-Verification** untuk bukti transfer (NEW in 2.3.14)
- ✅ Manual verification queue untuk bukti transfer yang memerlukan review
- ✅ Late payment penalty calculation
- ✅ Invoice export (PDF, Excel)

### 3. **Integration - GenieACS (TR-069)**
- ✅ ONT/CPE device discovery & management
- ✅ Real-time device status monitoring (Online/Offline)
- ✅ Remote WiFi SSID & password change
- ✅ Remote device reboot
- ✅ Device parameter management (NEW in 2.4.0)
- ✅ Signal quality monitoring (Rx/Tx Power)
- ✅ Device information (Serial, Manufacturer, Model)

### 4. **Integration - MikroTik**
- ✅ Hotspot user management (Create, Suspend, Resume)
- ✅ PPPoE secret management
- ✅ Queue tree bandwidth management
- ✅ Dynamic bandwidth profiles
- ✅ Active sessions monitoring
- ✅ Auto-suspend/resume on payment status
- ✅ Batch operations support

### 5. **WhatsApp Bot Service** 🤖
- ✅ Customer self-service menu (`/menu`)
- ✅ Invoice checking (`/tagihan`)
- ✅ Payment confirmation via bukti transfer
- ✅ **AI-Powered payment verification** (Gemini 2.0 Flash)
- ✅ Service information (`/info`)
- ✅ WiFi password request
- ✅ Automated notifications
- ✅ Smart validation & error handling

### 6. **Payment Gateway Integration**
- ✅ Midtrans (CC, VA, E-wallet, QRIS)
- ✅ Tripay (Multi-channel)
- ✅ Xendit (Invoice & VA)
- ✅ Auto payment callback handling
- ✅ Payment status synchronization

### 7. **Notification System**
- ✅ Dual-channel alert routing:
  - Telegram → Internal staff (Admin, Teknisi, Kasir)
  - WhatsApp → Customers
- ✅ Late payment warnings (3x & 4x threshold)
- ✅ Invoice reminders
- ✅ Payment confirmation
- ✅ Service downtime alerts
- ✅ SLA breach notifications

### 8. **SLA & Network Monitoring**
- ✅ Real-time uptime tracking per customer
- ✅ Downtime incident logging
- ✅ SLA percentage calculation
- ✅ **🤖 AI-Powered Incident Analysis** (NEW):
  - Mass outage detection
  - Root cause analysis
  - Auto-recommendations
  - Anomaly detection
- ✅ SLA breach auto-discount
- ✅ Service restoration notifications

### 9. **Reporting & Analytics**
- ✅ Revenue dashboard
- ✅ Payment reconciliation
- ✅ Customer growth statistics
- ✅ Invoice aging report
- ✅ Late payment analytics
- ✅ SLA performance reports
- ✅ Export to Excel/PDF

### 10. **User & Access Management**
- ✅ Multi-role support (Admin, Kasir, Teknisi)
- ✅ Role-based access control (RBAC)
- ✅ Telegram user registration & area assignment
- ✅ User activity logging
- ✅ Session management

### 11. **Settings & Configuration**
- ✅ System settings (Payment, Invoice, SLA)
- ✅ AI settings (Gemini API configuration)
- ✅ WhatsApp bot settings
- ✅ Payment gateway settings
- ✅ Notification preferences
- ✅ Late payment thresholds
- ✅ Auto-suspend rules

## 🔧 Technical Information

### Improvements
- Better error handling in service layers
- Improved type safety across the entire codebase
- Enhanced API compatibility for GenieACS integration  
- More maintainable code structure

### Dependencies
- Node.js v18+
- TypeScript v5.9.3
- MySQL/MariaDB
- PM2 (Production)

## 📦 Installation & Update

### Update dari versi sebelumnya:
```bash
# Pull latest code
cd /path/to/billing
git pull origin main

# Install dependencies (jika ada perubahan)
npm install

# Build TypeScript
npm run build

# Restart dengan PM2
pm2 restart billing-app
pm2 save
```

### Fresh Installation:
Ikuti petunjuk di [README.md](./README.md)

## 🧪 Testing
Setelah update, pastikan untuk test:
1. ✅ GenieACS WiFi management
2. ✅ Customer late payment tracking
3. ✅ WhatsApp payment verification
4. ✅ Alert routing (Telegram & WhatsApp)
5. ✅ Invoice generation

## 🐛 Known Issues
- Test routes untuk MikroTik menggunakan object parameters yang belum compatible dengan TypeScript strict mode check
- Beberapa test routes di `src/routes/index.ts` perlu refactoring (tidak mempengaruhi fitur production)

## 🚀 Future Enhancements
- Additional automation features
- More detailed analytics reports
- Enhanced AI capabilities
- Performance optimizations

## 📞 Support
Jika ada masalah atau pertanyaan:
1. Check logs: `pm2 logs billing-app`
2. Review error messages
3. Consult documentation

---

**Changelog:**
- All TypeScript compilation errors in production code have been fixed
- Added missing GenieACS method for parameter management
- Fixed type inconsistencies in service layers
- Improved code quality and maintainability

**Contributors:** Development Team
**License:** ISC
