# 🏢 Billing System
**Version:** 2.4.1  
**Release Date:** 2025-12-30

Sistem Billing untuk ISP/Provider Internet dengan integrasi GenieACS, MikroTik, WhatsApp Bot, AI-Powered Verification, dan berbagai Payment Gateway.

## ✨ Fitur Utama

### 1. **Customer Management**
- ✅ CRUD pelanggan dengan status tracking
- ✅ Customer migration (Hotspot ↔ PPPoE)
- ✅ Late Payment Tracking dengan auto-suspend
- ✅ Customer detail view dengan payment history

### 2. **Invoice & Payment Management**
- ✅ Auto invoice generator bulanan
- ✅ Multiple payment methods (Cash, Transfer, E-wallet)
- ✅ **🤖 AI-Powered Payment Verification** (Gemini 2.0)
- ✅ Manual verification queue
- ✅ Payment proof upload & export

### 3. **GenieACS Integration (TR-069)**
- ✅ ONT/CPE device management
- ✅ Real-time status monitoring
- ✅ Remote WiFi management
- ✅ Device reboot & parameter configuration

### 4. **MikroTik Integration**
- ✅ Hotspot & PPPoE management
- ✅ Queue tree bandwidth control
- ✅ Auto-suspend/resume on payment status
- ✅ Active sessions monitoring

### 5. **WhatsApp Bot** 🤖
- ✅ Customer self-service (`/menu`, `/tagihan`)
- ✅ AI payment verification
- ✅ Automated notifications
- ✅ WiFi password requests

### 6. **Payment Gateway**
- ✅ Midtrans, Tripay, Xendit
- ✅ Auto callback handling
- ✅ Payment status sync

### 7. **SLA & Monitoring**
- ✅ Real-time uptime tracking
- ✅ **🤖 AI Incident Analysis** (Root cause, Auto-recommendations)
- ✅ SLA breach auto-discount
- ✅ Anomaly detection

### 8. **Alert System**
- ✅ Dual-channel routing (Telegram →  Staff, WhatsApp → Customers)
- ✅ Late payment warnings
- ✅ Service downtime alerts

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MySQL/MariaDB
- **View Engine**: EJS
- **Styling**: TailwindCSS
- **Process Manager**: PM2

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

## 🌐 Deployment ke Ubuntu Server

### Prerequisites di Server

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install MySQL
sudo apt install mysql-server -y
```

### Deploy dari GitHub

```bash
# Clone ke server
cd /var/www
git clone https://github.com/your-username/billing.git
cd billing

# Install dependencies
npm install --production

# Setup environment
cp .env.production.example .env
nano .env  # Edit konfigurasi

# Build jika perlu (atau gunakan dist/ dari repo)
npm run build

# Start dengan PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Configure Firewall

```bash
sudo ufw allow 3001/tcp
sudo ufw enable
```

### Akses Aplikasi

```
http://YOUR_SERVER_IP:3001
```

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 3306 |
| `DB_USER` | Database user | root |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | billing |
| `SESSION_SECRET` | Session secret key | - |
| `GENIEACS_URL` | GenieACS API URL | - |
| `MIKROTIK_HOST` | MikroTik router IP | - |

Lihat `.env.example` untuk daftar lengkap konfigurasi.

## 📝 PM2 Commands

```bash
pm2 list                    # Lihat status
pm2 logs billing-app        # Lihat logs
pm2 restart billing-app     # Restart app
pm2 stop billing-app        # Stop app
pm2 monit                   # Monitor app
```

## 📂 Project Structure

```
billing/
├── src/                    # Source code TypeScript
│   ├── controllers/        # Route controllers
│   ├── services/           # Business logic
│   ├── routes/             # Express routes
│   ├── middlewares/        # Express middlewares
│   ├── db/                 # Database connection
│   └── utils/              # Utility functions
├── dist/                   # Compiled JavaScript
├── views/                  # EJS templates
├── public/                 # Static files
├── uploads/                # User uploads
├── ecosystem.config.js    # PM2 configuration
└── package.json
```

## 📄 License

MIT License - See [LICENSE](LICENSE) file.
