# 💼 Billing System - ISP Management System

Sistem manajemen billing untuk Internet Service Provider (ISP) dengan fitur lengkap untuk mengelola pelanggan, tagihan, pembayaran, dan integrasi MikroTik.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## ⚡ Quick Start - One-Click Installation

Deploy full Billing System dalam **10 menit**! 🚀

### 🎯 Basic Setup (Testing/Development)
```bash
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash
```
**Installs**: Node.js + PM2 + MySQL + Application → Akses di `http://YOUR_IP:3000`

### 🏢 Production Setup (Nginx + SSL)
```bash
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/setup-complete.sh | bash
```
**Installs**: Everything above + Nginx + SSL + Auto-backup + Monitoring

📖 **Panduan lengkap**: [Installation Scripts Guide](./docs/INSTALLATION_SCRIPTS.md)

---

## 🌟 Fitur Utama

### 📊 Manajemen Pelanggan
- ✅ Registrasi pelanggan baru
- ✅ Profil pelanggan lengkap
- ✅ Manajemen paket langganan
- ✅ Status aktif/non-aktif
- ✅ Portal pelanggan self-service

### 💰 Billing & Pembayaran
- ✅ Generate invoice otomatis
- ✅ Multiple payment gateway (Midtrans, Xendit, Tripay)
- ✅ Kasir/Point of Sale (POS)
- ✅ Riwayat pembayaran
- ✅ Laporan keuangan
- ✅ Sistem prepaid & postpaid

### 🔧 Integrasi MikroTik
- ✅ Auto-create PPPoE user
- ✅ Manajemen bandwidth
- ✅ Hotspot integration
- ✅ Static IP management
- ✅ Address list management
- ✅ Auto isolir pelanggan menunggak

### 📡 Monitoring
- ✅ Real-time network monitoring
- ✅ Bandwidth usage tracking
- ✅ SLA monitoring
- ✅ Incident management
- ✅ Maintenance scheduling
- ✅ Ping monitoring
- ✅ Customer status dashboard

### 📱 Notifikasi
- ✅ Telegram bot integration
- ✅ WhatsApp notifications
- ✅ Email notifications
- ✅ SMS gateway ready

### 🏗️ FTTH Management
- ✅ OLT management
- ✅ ODC management
- ✅ ODP management
- ✅ Infrastructure tracking

### 📦 Prepaid System
- ✅ Voucher-based billing
- ✅ Customer portal
- ✅ Auto-activation
- ✅ Expiry management
- ✅ Payment gateway integration

---

## 💻 System Requirements

### Server Requirements
- **OS**: Ubuntu 20.04+ / Debian 10+ / CentOS 7+
- **RAM**: Minimum 2GB (Recommended 4GB+)
- **CPU**: 2 Cores (Recommended 4 Cores+)
- **Storage**: Minimum 20GB
- **Network**: Public IP address

### Software Requirements
- **Node.js**: v18.x atau v20.x LTS (REQUIRED - v16 sudah EOL)
- **NPM**: v9.x atau lebih tinggi
- **Database**: MySQL 8.0+ atau MariaDB 10.5+
- **Process Manager**: PM2 (akan di-install otomatis)
- **Web Server**: Nginx (optional, untuk reverse proxy)
- **Panel**: aaPanel / cPanel / Plesk (optional)

### Network Requirements
- Port 3000 (aplikasi)
- Port 3306 (MySQL)
- Port 80/443 (HTTP/HTTPS jika pakai Nginx)
- Koneksi internet stabil

---

## 🚀 Quick Installation

### 🎯 One-Click Installation (Recommended)

**Install dalam 1 perintah!** Script ini akan otomatis:
- ✅ Install Node.js, PM2, MySQL/MariaDB
- ✅ Clone repository & install dependencies
- ✅ Setup database & user
- ✅ Build aplikasi
- ✅ Start dengan PM2
- ✅ Configure firewall

#### Option 1: Quick Install (Basic Setup)

Untuk instalasi cepat tanpa Nginx/SSL:

```bash
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash
```

Setelah selesai, akses: `http://YOUR_SERVER_IP:3000`

#### Option 2: Complete Setup (Production Ready)

Untuk setup lengkap dengan Nginx reverse proxy + SSL:

```bash
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/setup-complete.sh | bash
```

Setup ini akan menambahkan:
- ✅ Nginx sebagai reverse proxy
- ✅ SSL certificate (Let's Encrypt)
- ✅ Auto backup harian
- ✅ Monitoring tools (optional)

#### Requirements:
- **OS**: Ubuntu 20.04+ atau Debian 10+ (fresh install recommended)
- **Access**: Root atau sudo privileges
- **RAM**: Minimum 2GB
- **Port**: 80, 443 (untuk Nginx), 3000 (untuk direct access)

---

### Manual Installation

Jika ingin instalasi manual, ikuti langkah berikut:

```bash
# 1. Clone repository
git clone https://github.com/adiprayitno160-svg/billing.git
cd billing

# 2. Install dependencies
npm install --production

# 3. Create .env file
cp .env.example .env
nano .env  # Edit dengan konfigurasi Anda

# 4. Build application
npm run build

# 5. Start with PM2
pm2 start dist/server.js --name billing-system
pm2 save
pm2 startup
```

📖 **Panduan lengkap**: Lihat [INSTALL_NATIVE.md](./INSTALL_NATIVE.md) untuk step-by-step manual installation.

---

## ⚙️ Configuration

### 1. Database Setup

```sql
-- Create database (IMPORTANT: Use 'billing' as database name)
CREATE DATABASE billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON billing.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Environment Variables (.env)

```env
# Database (IMPORTANT: Database name is 'billing', not 'billing_system')
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=your_password
DB_NAME=billing

# Server
PORT=3000
NODE_ENV=production

# Session
SESSION_SECRET=your_random_secret_key

# MikroTik (Optional)
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=your_mikrotik_password

# Payment Gateway (Optional)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
XENDIT_API_KEY=
TRIPAY_API_KEY=

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# WhatsApp (Optional)
WA_SESSION_PATH=./whatsapp-session

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

---

## 📦 Dependencies

### Production Dependencies
```json
{
  "express": "^5.1.0",
  "mysql2": "^3.15.2",
  "typescript": "^5.9.3",
  "ejs": "^3.1.10",
  "express-session": "^1.18.2",
  "bcrypt": "^6.0.0",
  "dotenv": "^17.2.3",
  "node-telegram-bot-api": "^0.66.0",
  "whatsapp-web.js": "^1.34.1",
  "axios": "^1.12.2",
  "node-cron": "^3.0.3",
  "mikronode": "^2.3.11"
}
```

---

## 🎯 Usage

### Default Login Credentials
```
Admin Account:
Username: admin
Password: admin123

Kasir Account:
Username: kasir
Password: kasir123
```

⚠️ **IMPORTANT**: Ganti password default setelah login pertama!

### Accessing the Application

**Local Access:**
```
http://localhost:3000
```

**Public Access:**
```
http://your-server-ip:3000
```

**With Domain (Nginx):**
```
https://billing.yourdomain.com
```

---

## 📖 Documentation

### Setup Guides
- [Quick Start Guide](./docs/QUICK_START.md)
- [Installation Guide](./docs/INSTALLATION.md)
- [Configuration Guide](./docs/CONFIGURATION.md)
- [MikroTik Integration](./docs/MIKROTIK.md)

### API Documentation
- [REST API Endpoints](./docs/API.md)
- [Webhook Configuration](./docs/WEBHOOKS.md)

### User Guides
- [Admin Dashboard](./docs/ADMIN_GUIDE.md)
- [Kasir/POS System](./docs/KASIR_GUIDE.md)
- [Customer Portal](./docs/CUSTOMER_PORTAL.md)

---

## 🔧 Management Commands

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs billing-system

# Restart application
pm2 restart billing-system

# Stop application
pm2 stop billing-system

# Monitor resources
pm2 monit
```

### Database Backup
```bash
# Backup database
mysqldump -u billing_user -p billing_system > backup_$(date +%Y%m%d).sql

# Restore database
mysql -u billing_user -p billing_system < backup_20250126.sql
```

### Update Application
```bash
cd /path/to/billing
git pull origin main
npm install
npm run build
pm2 restart billing-system
```

---

## 🛡️ Security

### Recommendations
1. ✅ Ganti semua password default
2. ✅ Gunakan HTTPS dengan SSL certificate
3. ✅ Setup firewall (UFW/firewalld)
4. ✅ Regular backup database
5. ✅ Update sistem secara berkala
6. ✅ Gunakan strong session secret
7. ✅ Limit failed login attempts
8. ✅ Enable fail2ban

### Firewall Setup
```bash
# Ubuntu/Debian
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Application
ufw enable

# CentOS/RHEL
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload
```

---

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Test MySQL connection
mysql -u billing_user -p billing_system

# Check MySQL status
systemctl status mysql
```

### Port Already in Use
```bash
# Check what's using port 3000
netstat -tulpn | grep 3000

# Kill process
kill -9 PID
```

### Application Won't Start
```bash
# Check logs
pm2 logs billing-system

# Check .env file
cat .env

# Rebuild application
npm run build
```

---

## 📊 Technology Stack

- **Backend**: Node.js + Express.js + TypeScript
- **Database**: MySQL / MariaDB
- **Template Engine**: EJS
- **CSS Framework**: TailwindCSS
- **Process Manager**: PM2
- **MikroTik Integration**: RouterOS API
- **Payment Gateway**: Midtrans, Xendit, Tripay
- **Notifications**: Telegram Bot API, WhatsApp Web.js

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/adiprayitno160-svg/billing/issues)
- **Email**: support@yourdomain.com
- **Telegram**: @yourtelegram

---

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/)
- [MikroTik RouterOS](https://mikrotik.com/)
- [PM2](https://pm2.keymetrics.io/)
- [TailwindCSS](https://tailwindcss.com/)

---

## 📸 Screenshots

### Dashboard
![Dashboard](./screenshots/dashboard.png)

### Customer Management
![Customers](./screenshots/customers.png)

### Invoice & Billing
![Invoice](./screenshots/invoice.png)

### MikroTik Integration
![MikroTik](./screenshots/mikrotik.png)

---

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Multi-tenancy support
- [ ] Advanced reporting & analytics
- [ ] API v2 with GraphQL
- [ ] Docker deployment
- [ ] Kubernetes support
- [ ] AI-powered customer insights

---

**Made with ❤️ by Adi Prayitno**

**⭐ Star this repo if you find it useful!**
