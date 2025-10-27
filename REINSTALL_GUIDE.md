# 🔄 Panduan Reinstall & Deploy Fresh

Panduan lengkap untuk install fresh Billing System di Debian 12 yang baru diinstall.

---

## 🎯 **TESTED & WORKING!**

Script ini sudah **tested dan working** dengan semua fix:
- ✅ Database name: `billing` (bukan `billing_system`)
- ✅ Node.js v20 LTS
- ✅ MariaDB authentication handling
- ✅ WhatsApp/Chromium dependencies
- ✅ SQL collation fixed
- ✅ Auto error handling

---

## 📋 **PREREQUISITES:**

### **1. Fresh Install Debian 12**
- Debian 12 (Bookworm) - fresh install
- RAM minimal 2GB (recommended 4GB)
- Root access atau user dengan sudo privileges
- Koneksi internet stabil

### **2. Update System**

Setelah install Debian 12 fresh, update dulu:

```bash
# Login sebagai root
su -

# Update system
apt update && apt upgrade -y

# Install basic tools
apt install -y curl wget sudo
```

---

## 🚀 **METODE INSTALASI:**

### **METODE 1: ONE-LINER (Paling Mudah)** ⭐

```bash
# Download & run installer
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-debian-tested.sh | bash
```

**atau dengan wget:**

```bash
wget -qO- https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-debian-tested.sh | bash
```

---

### **METODE 2: Download Dulu, Lalu Run**

```bash
# Download script
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-debian-tested.sh

# Make executable
chmod +x install-debian-tested.sh

# Run installer
./install-debian-tested.sh
```

---

### **METODE 3: Clone Repository, Lalu Install**

```bash
# Install git jika belum ada
apt install -y git

# Clone repository
git clone https://github.com/adiprayitno160-svg/billing.git

# Masuk ke folder
cd billing

# Run installer
bash install-debian-tested.sh
```

---

## ⏱️ **PROSES INSTALASI:**

Script akan otomatis:

1. ✅ **Check System** (Debian 12)
2. ✅ **Install Dependencies** (build-essential, dll)
3. ✅ **Install Node.js v20** LTS
4. ✅ **Install WhatsApp Dependencies** (Chromium libs)
5. ✅ **Install PM2** (Process Manager)
6. ✅ **Install MariaDB** (Fresh install)
7. ✅ **Setup Database** (database: `billing`)
8. ✅ **Clone Repository** dari GitHub
9. ✅ **Install NPM Dependencies** (5-10 menit)
10. ✅ **Configure .env** (auto-generate session secret)
11. ✅ **Import Database** (87 tables)
12. ✅ **Build Application** (TypeScript → JavaScript)
13. ✅ **Start with PM2** (Auto-start on boot)
14. ✅ **Configure Firewall** (UFW)

**Estimasi Waktu Total:** 10-15 menit

---

## 📊 **SAAT INSTALASI:**

Script akan menampilkan progress seperti ini:

```
╔══════════════════════════════════════════╗
║  🚀 Billing System Installer v2.0       ║
║     Tested for Debian 12                 ║
╚══════════════════════════════════════════╝

✓ Detected: Debian GNU/Linux 12 (bookworm)

🚀 Start installation? (y/N): y

▶ Installing system dependencies...
✓ Dependencies installed

▶ Installing Node.js 20.x LTS...
✓ Node.js v20.x.x installed

▶ Installing PM2 process manager...
✓ PM2 installed

▶ Installing MariaDB...
✓ MariaDB installed

▶ Setting up database...
✓ Database setup complete
✓ Credentials saved to /root/.billing-db-credentials

▶ Cloning repository from GitHub...
✓ Repository cloned

▶ Installing application dependencies...
(ini lama, 5-10 menit)
✓ Dependencies installed

▶ Configuring environment...
✓ Environment configured

▶ Importing database...
✓ Database imported (87 tables)

▶ Building application...
✓ Application built

▶ Starting application with PM2...
✓ Application started

▶ Configuring firewall...
✓ Firewall configured

╔══════════════════════════════════════════╗
║     🎉 Installation Complete!           ║
╚══════════════════════════════════════════╝

🌐 Access your application:
   http://YOUR_SERVER_IP:3000

🔐 Default Login:
   Admin:
   Username: admin
   Password: admin123

   Kasir:
   Username: kasir
   Password: kasir123

⚠  IMPORTANT: Change default passwords after first login!
```

---

## ✅ **SETELAH INSTALASI SELESAI:**

### **1. Test Akses dari Browser**

```
http://YOUR_SERVER_IP:3000
```

### **2. Login**

```
Username: admin
Password: admin123
```

### **3. Ganti Password Default**

- Login ke dashboard
- Settings → Users → Change Password
- Ganti password admin dan kasir

### **4. Setup Company Info**

- Settings → Company Information
- Isi nama perusahaan, alamat, dll

### **5. Configure MikroTik (Optional)**

- Settings → MikroTik Configuration
- Tambah router MikroTik Anda

---

## 📊 **MANAGEMENT COMMANDS:**

### **PM2 Commands:**

```bash
# Check status
pm2 status

# View logs (real-time)
pm2 logs billing-system

# View last 50 lines
pm2 logs billing-system --lines 50

# Restart application
pm2 restart billing-system

# Stop application
pm2 stop billing-system

# Monitor resources
pm2 monit
```

### **Database Commands:**

```bash
# Access database
mysql -u billing_user -pBilling123! billing

# Backup database
mysqldump -u billing_user -pBilling123! billing > backup_$(date +%Y%m%d).sql

# Check credentials
cat /root/.billing-db-credentials
```

### **Application Commands:**

```bash
# Go to app directory
cd /opt/billing

# Pull updates from GitHub
git pull origin main

# Rebuild
npm run build

# Restart
pm2 restart billing-system
```

---

## 🐛 **TROUBLESHOOTING:**

### **Jika Installer Gagal:**

**1. Check logs:**
```bash
# Jika PM2 sudah install
pm2 logs billing-system

# Check MariaDB
systemctl status mariadb

# Check Node.js
node -v
npm -v
```

**2. Retry installation:**
```bash
# Bersihkan dulu
pm2 delete billing-system 2>/dev/null
rm -rf /opt/billing
mysql -u root -e "DROP DATABASE IF EXISTS billing;"

# Run installer lagi
bash install-debian-tested.sh
```

**3. Manual verification:**
```bash
# Check database
mysql -u billing_user -pBilling123! billing -e "SHOW TABLES;" | wc -l
# Harus: 87

# Check .env
cat /opt/billing/.env | grep DB_NAME
# Harus: DB_NAME=billing

# Check PM2
pm2 status
# Status harus: online
```

---

## 🔒 **SECURITY POST-INSTALL:**

### **1. Change Default Passwords**
- Admin & Kasir passwords
- Database root password (optional)

### **2. Setup Firewall Rules**
```bash
# Restrict SSH (change port if needed)
ufw allow 22/tcp
ufw limit 22/tcp

# Allow only HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Restrict app port (only local if behind Nginx)
# ufw delete allow 3000/tcp
```

### **3. Setup SSL/HTTPS (Recommended)**

Install Nginx + Let's Encrypt:

```bash
# Install Nginx
apt install -y nginx

# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d billing.yourdomain.com

# Configure Nginx reverse proxy
# (See INSTALL_DEBIAN12.md for full config)
```

### **4. Setup Backup Automation**

```bash
# Create backup script
nano /usr/local/bin/backup-billing.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/billing"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u billing_user -pBilling123! billing | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup files
tar -czf $BACKUP_DIR/files_$DATE.tar.gz -C /opt billing --exclude='node_modules'

# Keep last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /usr/local/bin/backup-billing.sh

# Add to cron (daily at 2 AM)
crontab -e
```

Add:
```
0 2 * * * /usr/local/bin/backup-billing.sh >> /var/log/billing-backup.log 2>&1
```

---

## 📦 **UPDATE APPLICATION:**

Untuk update ke versi terbaru:

```bash
cd /opt/billing

# Stop application
pm2 stop billing-system

# Backup database
mysqldump -u billing_user -pBilling123! billing > backup_before_update_$(date +%Y%m%d).sql

# Pull updates
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart billing-system

# Check logs
pm2 logs billing-system --lines 30
```

---

## 🎉 **INSTALLATION COMPLETE!**

Aplikasi billing system sekarang running di:

```
http://YOUR_SERVER_IP:3000
```

**Default credentials:**
- Admin: admin / admin123
- Kasir: kasir / kasir123

**⚠️ JANGAN LUPA GANTI PASSWORD DEFAULT!**

---

## 📞 **NEED HELP?**

- **Documentation:** Check INSTALL_DEBIAN12.md
- **Troubleshooting:** Check MASALAH_DAN_SOLUSI.md  
- **GitHub Issues:** https://github.com/adiprayitno160-svg/billing/issues

---

**Script ini sudah tested dan working! Selamat menggunakan!** 🚀


