# 🚀 Panduan Instalasi Native - Lengkap & Teruji

Panduan ini sudah diperbaiki berdasarkan error-error yang sering terjadi.

---

## ⚠️ SEBELUM MULAI - PENTING!

### Pastikan Sudah Punya:
- ✅ Server Ubuntu 20.04+ / Debian 10+ / CentOS 7+
- ✅ RAM minimal 2GB (recommended 4GB)
- ✅ Root access atau sudo privileges
- ✅ Koneksi internet stabil

### Catatan Penting:
1. **Database name** di SQL adalah `billing` bukan `billing_system`
2. **Node.js minimal v18** (v16 akan error)
3. **WhatsApp butuh system libraries** tambahan

---

## 📝 STEP 1: Update System & Install Prerequisites

### Ubuntu/Debian:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install basic tools
sudo apt install -y curl wget git build-essential

# Install library untuk WhatsApp (Puppeteer/Chromium)
sudo apt install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils
```

### CentOS/RHEL:
```bash
# Update system
sudo yum update -y

# Install basic tools
sudo yum install -y curl wget git gcc-c++ make

# Install EPEL repository
sudo yum install -y epel-release

# Install library untuk WhatsApp
sudo yum install -y \
    alsa-lib \
    atk \
    cups-libs \
    gtk3 \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    nss \
    pango
```

---

## 📦 STEP 2: Install Node.js v20 (LTS)

### Ubuntu/Debian:
```bash
# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # Harus v20.x.x
npm -v    # Harus v10.x.x
```

### CentOS/RHEL:
```bash
# Install Node.js v20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Verify
node -v
npm -v
```

### Jika NodeSource tidak work, gunakan NVM:
```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js v20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v
npm -v
```

---

## 🗄️ STEP 3: Install & Setup MySQL/MariaDB

### Ubuntu/Debian - Install MySQL 8.0:
```bash
# Install MySQL
sudo apt install -y mysql-server

# Start MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure installation
sudo mysql_secure_installation
```

### CentOS/RHEL - Install MariaDB:
```bash
# Install MariaDB
sudo yum install -y mariadb-server

# Start MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure installation
sudo mysql_secure_installation
```

### Setup Database & User:
```bash
# Login ke MySQL sebagai root
sudo mysql -u root -p

# Jalankan command berikut di MySQL prompt:
```

```sql
-- Buat database (NAMA: billing, bukan billing_system!)
CREATE DATABASE IF NOT EXISTS billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Buat user
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';

-- Berikan privileges
GRANT ALL PRIVILEGES ON billing.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;

-- Test koneksi
SELECT User, Host FROM mysql.user WHERE User = 'billing_user';

-- Exit
EXIT;
```

**Test koneksi:**
```bash
mysql -u billing_user -p billing
# Masukkan password, jika bisa masuk berarti sukses
# Ketik EXIT untuk keluar
```

---

## 📥 STEP 4: Clone & Setup Aplikasi

```bash
# Pindah ke folder instalasi
cd /opt

# Clone repository
sudo git clone https://github.com/adiprayitno160-svg/billing.git

# Set permissions
sudo chown -R $USER:$USER /opt/billing
cd /opt/billing

# Install dependencies (ini akan lama, tunggu sampai selesai)
npm install

# Jika ada error native dependencies, coba:
npm install --build-from-source
```

---

## ⚙️ STEP 5: Konfigurasi Environment

```bash
# Copy template env
cp env.example .env

# Edit .env
nano .env
```

**Edit sesuai konfigurasi Anda:**
```env
# DATABASE - PENTING! Database name adalah 'billing'
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=YourSecurePassword123!
DB_NAME=billing

# SERVER
PORT=3000
NODE_ENV=production

# SESSION - Generate random string
SESSION_SECRET=ganti_dengan_random_string_minimal_32_karakter

# MIKROTIK (Opsional - bisa diisi via dashboard)
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=
MIKROTIK_PORT=8728

# PAYMENT GATEWAY (Opsional)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

# TELEGRAM (Opsional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# WHATSAPP (Opsional)
WA_SESSION_PATH=./whatsapp-session
```

**Generate SESSION_SECRET:**
```bash
openssl rand -base64 32
# Copy output ke SESSION_SECRET
```

**Save file:** `Ctrl + O`, `Enter`, `Ctrl + X`

---

## 💾 STEP 6: Import Database

```bash
# Pastikan di folder /opt/billing
cd /opt/billing

# Import database
mysql -u billing_user -p billing < billing.sql

# Masukkan password database ketika diminta

# Verify tables created
mysql -u billing_user -p billing -e "SHOW TABLES;"
```

**Harus muncul banyak tabel termasuk:**
- users
- customers
- scheduler_settings
- prepaid_package_subscriptions
- dll

---

## 🏗️ STEP 7: Build Aplikasi

```bash
# Build TypeScript ke JavaScript
npm run build

# Verify build folder created
ls -la dist/

# Harus ada file: dist/server.js
```

---

## 🚀 STEP 8: Install & Setup PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start aplikasi dengan PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup auto-start saat boot
pm2 startup
# Copy & jalankan command yang muncul (biasanya dimulai dengan sudo env...)

# Check status
pm2 status

# Check logs
pm2 logs billing-system
```

**Status harus "online"** bukan "errored"!

---

## 🔥 STEP 9: Configure Firewall

### Ubuntu/Debian (UFW):
```bash
# Enable firewall
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 3000/tcp   # Application
sudo ufw enable

# Check status
sudo ufw status
```

### CentOS/RHEL (Firewalld):
```bash
# Enable firewall
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

---

## ✅ STEP 10: Test Instalasi

### 1. Test akses lokal:
```bash
curl http://localhost:3000
```

### 2. Test dari browser:
```
http://YOUR_SERVER_IP:3000
```

### 3. Login dengan credentials default:
```
Username: admin
Password: admin123
```

⚠️ **IMPORTANT:** Ganti password default setelah login!

---

## 🐛 TROUBLESHOOTING

### Error 1: "Table doesn't exist"
**Penyebab:** Database name salah atau database belum diimport

**Solusi:**
```bash
# Check database name di .env
cat .env | grep DB_NAME
# Harus: DB_NAME=billing

# Re-import database
mysql -u billing_user -p billing < billing.sql
```

### Error 2: "Cannot find module"
**Penyebab:** Dependencies tidak terinstall lengkap

**Solusi:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart billing-system
```

### Error 3: "libnss3.so: cannot open shared object"
**Penyebab:** Library untuk WhatsApp belum terinstall

**Solusi Ubuntu/Debian:**
```bash
sudo apt install -y libnss3 libatk-bridge2.0-0 libgbm1
pm2 restart billing-system
```

**Solusi CentOS:**
```bash
sudo yum install -y nss atk libXrandr
pm2 restart billing-system
```

### Error 4: "Port 3000 already in use"
**Penyebab:** Ada proses lain pakai port 3000

**Solusi:**
```bash
# Cek proses
sudo netstat -tulpn | grep 3000
# atau
sudo lsof -i :3000

# Kill proses
sudo kill -9 PID_NUMBER

# Atau ganti port di .env
nano .env
# Ubah: PORT=3001
pm2 restart billing-system
```

### Error 5: "ECONNREFUSED connecting to MySQL"
**Penyebab:** MySQL tidak jalan atau koneksi ditolak

**Solusi:**
```bash
# Check MySQL status
sudo systemctl status mysql
# atau untuk MariaDB
sudo systemctl status mariadb

# Start MySQL
sudo systemctl start mysql

# Test koneksi
mysql -u billing_user -p billing

# Check .env configuration
cat .env | grep DB_
```

### Error 6: "Cannot GET /" atau blank page
**Penyebab:** Build belum jalan atau dist folder kosong

**Solusi:**
```bash
# Check dist folder
ls -la dist/

# Rebuild
npm run build

# Restart
pm2 restart billing-system
pm2 logs billing-system
```

---

## 📊 PM2 Management Commands

```bash
# Status aplikasi
pm2 status

# View logs (real-time)
pm2 logs billing-system

# View logs (last 100 lines)
pm2 logs billing-system --lines 100

# Stop aplikasi
pm2 stop billing-system

# Restart aplikasi
pm2 restart billing-system

# Delete dari PM2
pm2 delete billing-system

# Monitor resources
pm2 monit

# List saved processes
pm2 list
```

---

## 🔄 Update Aplikasi

```bash
cd /opt/billing

# Stop aplikasi
pm2 stop billing-system

# Backup database
mysqldump -u billing_user -p billing > backup_$(date +%Y%m%d_%H%M%S).sql

# Pull update
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart billing-system

# Check logs
pm2 logs billing-system
```

---

## 💾 Backup Database (Automated)

Buat script backup otomatis:

```bash
# Buat script
sudo nano /usr/local/bin/backup-billing.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/billing"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="billing_user"
DB_PASS="YourSecurePassword123!"
DB_NAME="billing"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/billing_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "billing_*.sql.gz" -mtime +30 -delete

echo "Backup completed: billing_$DATE.sql.gz"
```

```bash
# Set executable
sudo chmod +x /usr/local/bin/backup-billing.sh

# Test run
sudo /usr/local/bin/backup-billing.sh

# Setup cron (daily at 2 AM)
sudo crontab -e
```

Tambahkan line:
```
0 2 * * * /usr/local/bin/backup-billing.sh >> /var/log/billing-backup.log 2>&1
```

---

## 🔒 Security Checklist

- [ ] Ganti password default admin
- [ ] Ganti SESSION_SECRET dengan random string
- [ ] Setup firewall (UFW/firewalld)
- [ ] Update system secara berkala
- [ ] Backup database rutin
- [ ] Gunakan HTTPS dengan SSL (Let's Encrypt)
- [ ] Setup fail2ban untuk proteksi brute-force
- [ ] Limit SSH access
- [ ] Disable root login via SSH

---

## ✅ Installation Complete!

Aplikasi billing system sekarang sudah running di:
```
http://YOUR_SERVER_IP:3000
```

**Default credentials:**
```
Admin:
Username: admin
Password: admin123

Kasir:
Username: kasir
Password: kasir123
```

⚠️ **Jangan lupa ganti password!**

---

## 📞 Need Help?

Jika masih ada masalah, check:
1. PM2 logs: `pm2 logs billing-system`
2. MySQL logs: `sudo tail -f /var/log/mysql/error.log`
3. System logs: `sudo journalctl -xe`

Dokumentasi lengkap: https://github.com/adiprayitno160-svg/billing


