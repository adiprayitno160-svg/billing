# 🚀 PANDUAN DEPLOYMENT KE SERVER AAPANEL (DOCKER)

**Date:** October 25, 2025  
**Target:** Debian Server dengan aaPanel (Docker Container)

---

## 📋 CHECKLIST PERSIAPAN

### ✅ Di Server (sudah dikonfirmasi):
- [x] aaPanel terinstall (running di Docker)
- [x] Nginx terinstall
- [x] MySQL/MariaDB terinstall
- [x] PHP & phpMyAdmin terinstall
- [x] Node.js v16.20.2 terinstall (via aaPanel Node.js Version Manager)

### ⏳ Yang akan dikerjakan:
- [ ] Push code ke GitHub
- [ ] Clone repository ke server
- [ ] Setup environment variables
- [ ] Buat database
- [ ] Install dependencies
- [ ] Build aplikasi
- [ ] Setup PM2
- [ ] Configure Nginx reverse proxy
- [ ] Test aplikasi

---

## 🔄 STEP 1: PUSH KE GITHUB (Di Local/Windows)

### A. Push Semua Perubahan

Jalankan di **Laragon Terminal** atau **PowerShell**:

```bash
cd C:\laragon\www\billing

# Check status
git status

# Add all changes
git add .

# Commit dengan message
git commit -m "feat: Complete billing system - payment tabs, kasir print, telegram fix, security"

# Push to GitHub
git push origin main
```

**Atau klik file:**
```
git-commit-push.bat
```

### B. Verify di GitHub

- Buka: https://github.com/YOUR_USERNAME/billing
- Pastikan semua file sudah terupload
- Cek commit terakhir

---

## 🖥️ STEP 2: SETUP DI SERVER AAPANEL

### A. Login SSH ke Server

```bash
# Via PuTTY atau SSH Client
ssh root@your-server-ip

# Atau
ssh adi@your-server-ip
sudo su -
```

### B. Masuk ke Docker Container aaPanel

```bash
# Lihat container yang running
docker ps

# Output contoh:
# CONTAINER ID   IMAGE              NAMES
# abc123def456   aapanel/aapanel    aapanel

# Masuk ke container (ganti 'aapanel' sesuai nama container)
docker exec -it aapanel /bin/bash

# Sekarang Anda di dalam container
# Prompt akan berubah: root@abc123def456:/#
```

---

## 📦 STEP 3: CLONE REPOSITORY

```bash
# Di dalam Docker container aaPanel

# Install Git (jika belum ada)
apt-get update
apt-get install git -y

# Buat/masuk ke directory wwwroot
cd /www/wwwroot

# Clone repository dari GitHub
git clone https://github.com/YOUR_USERNAME/billing.git

# Masuk ke folder billing
cd billing

# Verifikasi files
ls -la
```

**Ganti `YOUR_USERNAME` dengan username GitHub Anda!**

---

## ⚙️ STEP 4: SETUP ENVIRONMENT VARIABLES

### A. Buat File .env

```bash
cd /www/wwwroot/billing

# Buat file .env baru
nano .env
```

### B. Copy-Paste Konfigurasi Ini:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=GANTI_DENGAN_PASSWORD_MYSQL_ANDA
DB_NAME=billing_system

# Session Secret (generate random string)
SESSION_SECRET=billing-secret-key-production-2025-min-32-chars

# Telegram Bot (optional - bisa diisi nanti via Settings)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# App Configuration
APP_NAME=Billing System
COMPANY_NAME=Your Company Name

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# WhatsApp (auto-configured)
WA_SESSION_PATH=./whatsapp-session

# Payment Gateway (optional)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

# MikroTik (optional)
MIKROTIK_HOST=
MIKROTIK_USER=
MIKROTIK_PASSWORD=
```

### C. Save File

- Tekan **Ctrl+X**
- Tekan **Y**
- Tekan **Enter**

### D. Get MySQL Password

**Cara 1 - Via aaPanel Web UI:**
1. Buka aaPanel di browser
2. **Database** → klik database → **Root Password** → Copy
3. Paste ke `.env` di field `DB_PASSWORD`

**Cara 2 - Via Command:**
```bash
# Cari password di config aaPanel
grep -r "mysql.*password" /www/server/panel/ 2>/dev/null | head -5
```

---

## 🗄️ STEP 5: SETUP DATABASE

### A. Buat Database via aaPanel Web UI (Lebih Mudah)

1. Buka **aaPanel** di browser
2. **Database** → **Add Database**
3. Isi:
   - **Database Name:** `billing_system`
   - **Username:** `billing_user` (atau pakai `root`)
   - **Password:** Generate atau custom
4. Klik **Submit**

### B. Atau via MySQL Command (di SSH):

```bash
# Login MySQL
mysql -u root -p
# Masukkan password MySQL

# Di MySQL prompt, jalankan:
CREATE DATABASE billing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON billing_system.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### C. Import Database Schema

```bash
cd /www/wwwroot/billing

# Import schema (jika ada file SQL)
mysql -u root -p billing_system < database/schema.sql

# Atau via migrations:
# npm run setup-migrasi
```

---

## 🏗️ STEP 6: BUILD APLIKASI

### A. Check Node.js Version

```bash
# Di dalam Docker container
node --version
npm --version
```

**Expected output:**
```
v16.20.2
8.19.4
```

### B. Install Dependencies

```bash
cd /www/wwwroot/billing

# Install semua package
npm install

# Tunggu proses selesai (bisa 5-10 menit)
```

### C. Build TypeScript

```bash
# Compile TypeScript ke JavaScript
npm run build

# Verifikasi build berhasil
ls -la dist/

# Harus ada file: server.js
```

---

## 🚀 STEP 7: SETUP PM2 & START APLIKASI

### A. Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Verifikasi
pm2 --version
```

### B. Start Aplikasi

```bash
cd /www/wwwroot/billing

# Start dengan PM2
pm2 start dist/server.js --name billing

# Check status
pm2 status

# Expected output:
# ┌─────┬────────────┬─────────┬──────┐
# │ id  │ name       │ status  │ cpu  │
# ├─────┼────────────┼─────────┼──────┤
# │ 0   │ billing    │ online  │ 0%   │
# └─────┴────────────┴─────────┴──────┘
```

### C. View Logs

```bash
# Real-time logs
pm2 logs billing

# Last 50 lines
pm2 logs billing --lines 50

# Error logs only
pm2 logs billing --err
```

### D. Save PM2 Configuration

```bash
# Save current PM2 processes
pm2 save

# Setup auto-start on server reboot
pm2 startup

# Follow instructions that appear
# Usually: copy-paste the command shown
```

---

## 🌐 STEP 8: SETUP NGINX REVERSE PROXY

### A. Via aaPanel Web UI (Recommended)

1. **Login aaPanel**
2. **Website** → **Add Site**
3. Isi form:
   ```
   Domain: billing.yourdomain.com
   (atau gunakan IP server jika belum ada domain)
   
   PHP Version: Static (pilih "Static", bukan PHP)
   FTP: No (tidak perlu)
   Database: No (sudah dibuat sebelumnya)
   ```
4. Klik **Submit**

### B. Configure Reverse Proxy

1. Pada website yang baru dibuat, klik **Settings**
2. Pilih tab **Reverse Proxy**
3. Klik **Add Reverse Proxy**
4. Isi:
   ```
   Proxy Name: billing
   Target URL: http://127.0.0.1:3000
   Enable: ON
   ```
5. Klik **Submit**

### C. (Optional) Setup SSL Certificate

**Jika menggunakan domain:**

1. Di **Settings** website → tab **SSL**
2. Pilih **Let's Encrypt**
3. Isi email Anda
4. Klik **Apply**
5. Tunggu proses selesai

**SSL akan otomatis terinstall dan auto-renew!**

---

## ✅ STEP 9: TEST APLIKASI

### A. Test dari Server

```bash
# Di dalam Docker container atau SSH server
curl http://localhost:3000

# Expected: HTML response (login page)
```

### B. Test dari Browser

Buka browser dan akses:

```
http://your-server-ip

atau

https://billing.yourdomain.com
```

### C. Login

**Default Credentials:**
- **Admin:** `admin` / `admin`
- **Kasir:** `kasir` / `kasir`

⚠️ **PENTING:** Ganti password default setelah login pertama!

---

## 🔧 TROUBLESHOOTING

### Problem 1: "node: command not found"

```bash
# Install Node.js di container
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt-get install nodejs -y
```

### Problem 2: Port 3000 sudah digunakan

```bash
# Cek apa yang menggunakan port 3000
netstat -tlnp | grep 3000

# Kill process
kill -9 <PID>

# Atau ubah PORT di .env ke 3001
```

### Problem 3: Database connection error

```bash
# Test koneksi MySQL
mysql -u root -p

# Cek user dan privileges
SELECT user, host FROM mysql.user;
SHOW GRANTS FOR 'billing_user'@'localhost';
```

### Problem 4: PM2 tidak jalan setelah reboot

```bash
# Setup PM2 startup
pm2 startup systemd

# Copy-paste command yang muncul

# Save PM2 list
pm2 save
```

### Problem 5: Nginx 502 Bad Gateway

```bash
# Cek PM2 status
pm2 status

# Jika mati, restart
pm2 restart billing

# Cek logs
pm2 logs billing --err
```

---

## 📊 MONITORING & MAINTENANCE

### Monitoring PM2

```bash
# Real-time monitoring
pm2 monit

# Status semua aplikasi
pm2 status

# CPU & Memory usage
pm2 list
```

### View Logs

```bash
# All logs
pm2 logs billing

# Only errors
pm2 logs billing --err

# Last 100 lines
pm2 logs billing --lines 100
```

### Restart Aplikasi

```bash
# Restart
pm2 restart billing

# Reload (zero-downtime)
pm2 reload billing

# Stop
pm2 stop billing

# Start
pm2 start billing
```

### Update Aplikasi (setelah push baru ke GitHub)

```bash
cd /www/wwwroot/billing

# Pull perubahan terbaru
git pull origin main

# Install dependencies baru (jika ada)
npm install

# Rebuild
npm run build

# Restart PM2
pm2 restart billing

# Cek status
pm2 logs billing
```

---

## 🔒 SECURITY CHECKLIST

- [ ] Ganti password MySQL default
- [ ] Ganti password admin & kasir default di aplikasi
- [ ] Setup firewall (UFW)
- [ ] Install Fail2Ban
- [ ] Enable SSL certificate
- [ ] Update SESSION_SECRET di .env
- [ ] Disable root SSH login (gunakan user biasa)
- [ ] Setup automatic backups

### Setup Firewall

```bash
# Enable UFW
ufw enable

# Allow SSH
ufw allow 22

# Allow HTTP & HTTPS
ufw allow 80
ufw allow 443

# Check status
ufw status
```

---

## 📁 FILE STRUCTURE DI SERVER

```
/www/wwwroot/billing/
├── dist/                  # Compiled JavaScript
│   └── server.js         # Main server file
├── src/                   # TypeScript source
├── views/                 # EJS templates
├── public/                # Static files
├── database/              # Database files
├── node_modules/          # Dependencies
├── .env                   # Environment variables
├── package.json           # Project config
└── tsconfig.json          # TypeScript config
```

---

## 🎯 NEXT STEPS SETELAH DEPLOYMENT

1. **Test Semua Fitur:**
   - Login admin & kasir
   - Buat customer baru
   - Generate invoice
   - Process payment
   - Print invoice
   - Test Telegram bot (Settings → Telegram)
   - Test WhatsApp (Settings → WhatsApp)

2. **Configure Settings:**
   - Company profile
   - Payment gateway (Midtrans/Tripay)
   - Email SMTP
   - Telegram bot
   - MikroTik integration

3. **User Training:**
   - Train admin & kasir user
   - Create user manual
   - Setup support channel

4. **Backup Strategy:**
   - Setup automated MySQL backup
   - Backup .env file
   - Backup whatsapp-session folder

---

## 📞 QUICK COMMANDS REFERENCE

```bash
# Check status
pm2 status

# Restart app
pm2 restart billing

# View logs
pm2 logs billing

# Update from GitHub
cd /www/wwwroot/billing && git pull && npm install && npm run build && pm2 restart billing

# Check port
netstat -tlnp | grep 3000

# Test HTTP
curl http://localhost:3000

# Enter Docker container
docker exec -it aapanel /bin/bash

# MySQL login
mysql -u root -p

# Check disk space
df -h

# Check memory
free -h
```

---

## ✅ DEPLOYMENT COMPLETE!

Jika semua langkah di atas berhasil, aplikasi billing system Anda sudah **LIVE di production**! 🎉

**Akses:** http://your-server-ip atau https://your-domain.com

**Support:** Jika ada masalah, cek bagian Troubleshooting atau hubungi developer.

---

*Last Updated: October 25, 2025*  
*Version: 1.0.0*  
*Environment: aaPanel Docker + Node.js v16.20.2*


