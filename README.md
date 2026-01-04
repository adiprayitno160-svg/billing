# 🏢 Billing System
**Version:** 2.4.10  
**Release Date:** 2026-01-04

Sistem Billing untuk ISP/Provider Internet dengan integrasi GenieACS, MikroTik, WhatsApp Bot, AI-Powered Verification, dan berbagai Payment Gateway.

## ✨ Fitur Utama (v2.4.10)

### 1. **Customer Management & Deferment**
- ✅ CRUD pelanggan dengan status tracking
- ✅ **Payment Deferment System** (Permintaan penundaan bayar)
- ✅ Auto-block pelanggan yang melewati batas penundaan
- ✅ Late Payment Tracking dengan auto-suspend

### 2. **Monitoring & Service Status**
- ✅ **Server Health Monitoring** (Temperature & Voltage MikroTik)
- ✅ **Premium Monitoring UI** (Dashboard, PPPoE, Static IP, Trouble)
- ✅ Real-time status monitoring & active sessions

### 3. **Invoice & Payment Management**
- ✅ Auto invoice generator bulanan
- ✅ Multiple payment methods (Cash, Transfer, E-wallet)
- ✅ **🤖 AI-Powered Payment Verification** (Gemini 2.0)
- ✅ Manual verification queue
- ✅ Payment proof upload & export

### 4. **GenieACS Integration (TR-069)**
- ✅ ONT/CPE device management
- ✅ **🆕 WiFi Credential Visibility** (SSID & Password in Dashboard)
- ✅ **🆕 Auto-sync WiFi Credentials** to Customer Database
- ✅ Device reboot & parameter configuration
- ✅ Real-time signal & status monitoring

### 5. **MikroTik Integration**
- ✅ Hotspot & PPPoE management
- ✅ Queue tree bandwidth control
- ✅ Auto-suspend/resume on payment status
- ✅ Active sessions monitoring

### 6. **WhatsApp Bot** 🤖
- ✅ Customer self-service (`/menu`, `/tagihan`)
- ✅ **🆕 WiFi Management**:
    - Lihat password WiFi tersimpan (`/mywifi`) ✅
    - Ganti SSID & Password via WA (`/wifi`) ✅
- ✅ AI payment verification
- ✅ Automated notifications

### 7. **SLA & Monitoring**
- ✅ Real-time uptime tracking
- ✅ **🤖 AI Incident Analysis** (Root cause, Auto-recommendations)
- ✅ SLA breach auto-discount
- ✅ Anomaly detection

### 8. **Alert System**
- ✅ Dual-channel routing (Telegram → Staff, WhatsApp → Customers)
- ✅ Late payment warnings
- ✅ Service downtime alerts

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MySQL/MariaDB
- **View Engine**: EJS
- **Styling**: TailwindCSS
- **Process Manager**: PM2

## 🌐 Deployment

### Ubuntu Server (Production)
Untuk panduan instalasi lengkap di Ubuntu Server menggunakan Nginx, PM2, dan SSL, silakan baca:
👉 **[Panduan Instalasi Ubuntu Server (Lengkap)](INSTALL_UBUNTU.md)**

### Update via SSH (Simple)
Jika Anda sudah memiliki sistem yang terinstall, gunakan script update otomatis:

```bash
chmod +x update_ssh.sh
./update_ssh.sh
```

Script ini akan otomatis menarik kode terbaru, menginstall dependensi, menjalankan migrasi database, dan merestart PM2.

## 📋 Prerequisites
- Node.js v18+
- MySQL/MariaDB
- PM2 (untuk production)

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-username/billing.git
cd billing
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Build Application
```bash
npm run build
```

### 5. Start Application
**Development:**
```bash
npm run dev
```

**Production dengan PM2:**
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## ⚙️ Environment Variables
Lihat `.env.example` untuk daftar lengkap konfigurasi.

## 📝 PM2 Commands
```bash
pm2 list                    # Lihat status
pm2 logs billing-app        # Lihat logs
pm2 restart billing-app     # Restart app
pm2 stop billing-app        # Stop app
pm2 monit                   # Monitor app
```

## 📄 License
MIT License - See [LICENSE](LICENSE) file.
