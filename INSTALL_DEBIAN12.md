# 🚀 Instalasi Billing System di Debian 12

Panduan lengkap instalasi di Debian 12 (Bookworm)

---

## 📋 PREREQUISITES

### Yang Harus Anda Punya:
- ✅ Server Debian 12 (fresh install recommended)
- ✅ RAM minimal 2GB (recommended 4GB)
- ✅ Root access atau sudo privileges
- ✅ Koneksi internet stabil
- ✅ Port 3000 belum dipakai

---

## 🎯 OPSI 1: INSTALASI OTOMATIS (RECOMMENDED)

### Quick Install - One Command

```bash
# Login sebagai root atau user dengan sudo
sudo su -

# Download & run installer
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-fixed.sh | bash
```

**Atau download dulu baru run:**

```bash
# Download script
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-fixed.sh

# Make executable
chmod +x install-fixed.sh

# Run installer
sudo bash install-fixed.sh
```

Script akan otomatis:
- ✅ Install Node.js v20 LTS
- ✅ Install MySQL Server
- ✅ Install WhatsApp/Chromium dependencies
- ✅ Create database: `billing`
- ✅ Clone repository
- ✅ Install npm dependencies
- ✅ Configure environment (.env)
- ✅ Import database
- ✅ Build application
- ✅ Start with PM2
- ✅ Configure firewall

**Estimasi waktu:** 10-15 menit

---

## 🛠️ OPSI 2: INSTALASI MANUAL

Jika ingin kontrol penuh atau troubleshoot:

### STEP 1: Update System

```bash
# Login sebagai root
sudo su -

# Update package list
apt update && apt upgrade -y

# Install basic tools
apt install -y curl wget git build-essential ca-certificates gnupg lsb-release
```

### STEP 2: Install Node.js v20 LTS

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node -v   # Should show: v20.x.x
npm -v    # Should show: v10.x.x
```

### STEP 3: Install WhatsApp Dependencies

```bash
# Install Chromium/Puppeteer dependencies
apt install -y \
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
    libxss1 \
    xdg-utils
```

### STEP 4: Install MySQL Server

```bash
# Install MySQL
apt install -y default-mysql-server

# Start MySQL service
systemctl start mysql
systemctl enable mysql

# Secure installation (optional but recommended)
mysql_secure_installation
```

### STEP 5: Setup Database

```bash
# Login to MySQL
mysql -u root -p
```

Jalankan SQL berikut:

```sql
-- Create database (IMPORTANT: nama 'billing', bukan 'billing_system')
CREATE DATABASE billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';

-- Grant privileges
GRANT ALL PRIVILEGES ON billing.* TO 'billing_user'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;

-- Verify
SHOW DATABASES;
SELECT User, Host FROM mysql.user WHERE User='billing_user';

-- Exit
EXIT;
```

**Test koneksi:**
```bash
mysql -u billing_user -p billing -e "SELECT 'Connection OK' AS status;"
```

### STEP 6: Clone Repository

```bash
# Create directory
mkdir -p /opt
cd /opt

# Clone repository
git clone https://github.com/adiprayitno160-svg/billing.git

# Enter directory
cd billing

# Check files
ls -la
```

### STEP 7: Install Dependencies

```bash
# Install npm dependencies (ini akan lama, 5-10 menit)
npm install

# Jika ada error, coba:
npm install --legacy-peer-deps
```

### STEP 8: Configure Environment

```bash
# Copy template
cp env.example .env

# Edit configuration
nano .env
```

**Edit sesuai konfigurasi Anda:**

```env
# DATABASE - PENTING!
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=YourSecurePassword123!
DB_NAME=billing

# SERVER
PORT=3000
NODE_ENV=production

# SESSION - Generate dengan: openssl rand -base64 32
SESSION_SECRET=your_random_32_character_secret_here

# MIKROTIK (Optional - bisa diisi via dashboard)
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=
```

**Generate SESSION_SECRET:**
```bash
openssl rand -base64 32
# Copy output ke .env
```

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

### STEP 9: Import Database

```bash
# Import SQL file
mysql -u billing_user -p billing < billing.sql

# Enter password ketika diminta

# Verify tables created
mysql -u billing_user -p billing -e "SHOW TABLES;"
```

**Harus muncul banyak tabel:**
- users
- customers
- scheduler_settings
- prepaid_package_subscriptions
- invoices
- dll (total 40+ tables)

### STEP 10: Build Application

```bash
# Build TypeScript to JavaScript
npm run build

# Verify dist folder
ls -la dist/
# Harus ada: dist/server.js
```

### STEP 11: Install & Setup PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 list
pm2 save

# Setup auto-start
pm2 startup systemd
# Copy & run command yang muncul

# Check status
pm2 status
# Status harus: online (bukan errored)

# Check logs
pm2 logs billing-system --lines 50
```

### STEP 12: Configure Firewall

```bash
# Install UFW if not installed
apt install -y ufw

# Allow ports
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 3000/tcp    # Application

# Enable firewall
ufw enable

# Check status
ufw status
```

### STEP 13: Test Installation

```bash
# Test from server
curl http://localhost:3000

# Should return HTML content (not error)
```

**Test dari browser:**
```
http://YOUR_SERVER_IP:3000
```

**Login dengan:**
```
Username: admin
Password: admin123
```

⚠️ **PENTING:** Ganti password default setelah login!

---

## 🐛 TROUBLESHOOTING

### Error 1: "Table doesn't exist"

**Penyebab:** Database name salah atau tidak diimport

**Solusi:**
```bash
# Check .env
cat .env | grep DB_NAME
# Harus: DB_NAME=billing

# Re-import database
cd /opt/billing
mysql -u billing_user -p billing < billing.sql
```

### Error 2: "Cannot find module"

**Penyebab:** Dependencies tidak lengkap

**Solusi:**
```bash
cd /opt/billing
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart billing-system
```

### Error 3: "libnss3.so: cannot open shared object"

**Penyebab:** WhatsApp dependencies belum terinstall

**Solusi:**
```bash
apt install -y libnss3 libatk-bridge2.0-0 libgbm1 libxss1
pm2 restart billing-system
```

### Error 4: "Port 3000 already in use"

**Solusi:**
```bash
# Check what's using port
netstat -tulpn | grep 3000
# atau
lsof -i :3000

# Kill process
kill -9 PID_NUMBER

# Or change port in .env
nano .env
# PORT=3001
pm2 restart billing-system
```

### Error 5: "ECONNREFUSED MySQL"

**Solusi:**
```bash
# Check MySQL status
systemctl status mysql

# Start MySQL
systemctl start mysql

# Test connection
mysql -u billing_user -p billing

# Check .env credentials
cat .env | grep DB_
```

### Error 6: PM2 status "errored"

**Solusi:**
```bash
# Check logs
pm2 logs billing-system --lines 100

# Common issues:
# 1. .env file missing or wrong config
# 2. Database not accessible
# 3. Build failed (no dist folder)

# Fix dan restart
pm2 restart billing-system
```

---

## 📊 VERIFIKASI INSTALASI

### Checklist Post-Installation:

```bash
# 1. Check Node.js
node -v
# Output: v20.x.x ✓

# 2. Check MySQL
systemctl status mysql
# Output: active (running) ✓

# 3. Check Database
mysql -u billing_user -p billing -e "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'billing';"
# Output: 40+ tables ✓

# 4. Check PM2
pm2 status
# Output: billing-system | online ✓

# 5. Check Application
curl -I http://localhost:3000
# Output: HTTP/1.1 200 OK ✓

# 6. Check Firewall
ufw status
# Output: Status: active ✓
```

---

## 🔒 SECURITY POST-INSTALL

### 1. Ganti Password Default

Login ke `http://SERVER_IP:3000`:
- Username: admin / Password: admin123
- Settings → Users → Change Password

### 2. Update .env

```bash
nano /opt/billing/.env
# Ganti SESSION_SECRET dengan value baru
```

### 3. Setup SSL (Optional tapi Recommended)

Install Nginx + Let's Encrypt:
```bash
apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx reverse proxy
nano /etc/nginx/sites-available/billing
```

```nginx
server {
    listen 80;
    server_name billing.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/billing /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d billing.yourdomain.com
```

### 4. Setup Automatic Backup

```bash
# Create backup script
nano /usr/local/bin/backup-billing.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/billing"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="billing_user"
DB_PASS="YourSecurePassword123!"
DB_NAME="billing"

mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup files
tar -czf $BACKUP_DIR/files_$DATE.tar.gz -C /opt billing --exclude='node_modules' --exclude='.git'

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /usr/local/bin/backup-billing.sh

# Test run
/usr/local/bin/backup-billing.sh

# Schedule daily backup at 2 AM
crontab -e
```

Add line:
```
0 2 * * * /usr/local/bin/backup-billing.sh >> /var/log/billing-backup.log 2>&1
```

---

## 📊 MANAGEMENT COMMANDS

### PM2 Commands:
```bash
pm2 status                    # Check status
pm2 logs billing-system       # View logs (real-time)
pm2 logs billing-system --lines 100  # Last 100 lines
pm2 restart billing-system    # Restart app
pm2 stop billing-system       # Stop app
pm2 delete billing-system     # Remove from PM2
pm2 monit                     # Monitor resources
```

### Database Commands:
```bash
# Backup
mysqldump -u billing_user -p billing > backup.sql

# Restore
mysql -u billing_user -p billing < backup.sql

# Access database
mysql -u billing_user -p billing
```

### Application Commands:
```bash
# Update application
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-system

# View logs
pm2 logs billing-system
tail -f /var/log/nginx/access.log  # If using Nginx
```

---

## ✅ INSTALLATION COMPLETE!

Aplikasi sekarang running di:
```
http://YOUR_SERVER_IP:3000
```

**Default Credentials:**
```
Admin:
Username: admin
Password: admin123

Kasir:
Username: kasir
Password: kasir123
```

⚠️ **Ganti password default segera!**

---

## 📞 BANTUAN

Jika ada masalah:

1. **Check logs:**
   ```bash
   pm2 logs billing-system
   ```

2. **Check documentation:**
   - SETUP_NATIVE_COMPLETE.md
   - MASALAH_DAN_SOLUSI.md

3. **GitHub Issues:**
   https://github.com/adiprayitno160-svg/billing/issues

---

**Instalasi Debian 12 Complete! 🎉**

