# 🚀 Installation Guide - Native Server

Panduan instalasi Billing System di server native (Ubuntu/Debian/CentOS) tanpa panel.

---

## 📋 System Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04+ / Debian 10+ / CentOS 7+
- **RAM**: 2GB
- **CPU**: 2 Cores
- **Storage**: 20GB
- **Network**: Public IP

### Recommended Requirements
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 4GB+
- **CPU**: 4 Cores+
- **Storage**: 40GB+ SSD
- **Network**: Public IP + Domain

---

## 🔧 STEP 1: Prepare Server

### Update System

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential
```

**CentOS/RHEL:**
```bash
sudo yum update -y
sudo yum install -y curl wget git gcc-c++ make
```

### Install Node.js 20.x LTS

**Ubuntu/Debian:**
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v   # Should show v10.x.x
```

**CentOS/RHEL:**
```bash
# Add NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -

# Install Node.js
sudo yum install -y nodejs

# Verify installation
node -v
npm -v
```

### Install PM2 Process Manager

```bash
sudo npm install -g pm2

# Verify installation
pm2 -v
```

---

## 🗄️ STEP 2: Install MySQL/MariaDB

### Option A: MySQL 8.0

**Ubuntu/Debian:**
```bash
# Install MySQL Server
sudo apt install -y mysql-server

# Secure installation
sudo mysql_secure_installation

# Start MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Login to MySQL
sudo mysql -u root -p
```

**CentOS/RHEL:**
```bash
# Install MySQL Repository
sudo yum install -y https://dev.mysql.com/get/mysql80-community-release-el7-3.noarch.rpm

# Install MySQL
sudo yum install -y mysql-server

# Start MySQL
sudo systemctl start mysqld
sudo systemctl enable mysqld

# Get temporary password
sudo grep 'temporary password' /var/log/mysqld.log

# Secure installation
sudo mysql_secure_installation
```

### Option B: MariaDB 10.5+

**Ubuntu/Debian:**
```bash
sudo apt install -y mariadb-server mariadb-client

# Secure installation
sudo mysql_secure_installation

# Start MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

**CentOS/RHEL:**
```bash
sudo yum install -y mariadb-server mariadb

# Start MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure installation
sudo mysql_secure_installation
```

---

## 📦 STEP 3: Create Database & User

```bash
# Login to MySQL/MariaDB
sudo mysql -u root -p
```

Jalankan SQL berikut:

```sql
-- Create database (IMPORTANT: Use 'billing' as database name)
CREATE DATABASE billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'your_secure_password';

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

Test connection:
```bash
mysql -u billing_user -p billing -e "SELECT 'Connection OK' AS status;"
```

---

## 🚀 STEP 4: Clone & Install Application

### Clone Repository

```bash
# Navigate to web directory
cd /var/www

# Clone from GitHub
sudo git clone https://github.com/adiprayitno160-svg/billing.git
cd billing

# Set permissions
sudo chown -R $USER:$USER /var/www/billing
```

### Install Dependencies

```bash
# Install production dependencies
npm install --production

# This will take 5-10 minutes
```

---

## ⚙️ STEP 5: Configure Environment

### Create .env File

```bash
cp .env.example .env
nano .env
```

Edit dengan konfigurasi Anda:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=your_secure_password
DB_NAME=billing

# Server
PORT=3000
NODE_ENV=production

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your_random_secret_key_here

# App Settings
HIDE_BILLING_CUSTOMERS_MENU=false
```

Save file: `CTRL+X`, `Y`, `Enter`

### Generate Session Secret

```bash
# Generate random secret
openssl rand -base64 32

# Copy output dan paste ke SESSION_SECRET di .env
```

---

## 🔨 STEP 6: Build Application

```bash
cd /var/www/billing

# Build TypeScript to JavaScript
npm run build

# Verify dist folder created
ls -la dist/

# You should see:
# - dist/server.js
# - dist/controllers/
# - dist/services/
# etc.
```

---

## 🚦 STEP 7: Start Application with PM2

### Start Application

```bash
cd /var/www/billing

# Start with PM2
pm2 start dist/server.js --name billing-system

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd

# Copy-paste the command shown, usually:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u your_user --hp /home/your_user

# Verify running
pm2 status
pm2 logs billing-system
```

### PM2 Management Commands

```bash
# View status
pm2 status

# View logs (real-time)
pm2 logs billing-system

# Restart application
pm2 restart billing-system

# Stop application
pm2 stop billing-system

# Delete from PM2
pm2 delete billing-system

# Monitor resources
pm2 monit
```

---

## 🌐 STEP 8: Setup Nginx Reverse Proxy (Optional)

### Install Nginx

**Ubuntu/Debian:**
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**CentOS/RHEL:**
```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/billing
```

Paste konfigurasi ini:

```nginx
server {
    listen 80;
    server_name billing.yourdomain.com;  # Change this

    # Logging
    access_log /var/log/nginx/billing_access.log;
    error_log /var/log/nginx/billing_error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # Static files
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        proxy_pass http://localhost:3000;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:

**Ubuntu/Debian:**
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/billing /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

**CentOS/RHEL:**
```bash
# Copy config
sudo cp /etc/nginx/sites-available/billing /etc/nginx/conf.d/billing.conf

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 STEP 9: Setup SSL Certificate (Optional)

### Install Certbot

**Ubuntu/Debian:**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

**CentOS/RHEL:**
```bash
sudo yum install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificate

```bash
# Get certificate for your domain
sudo certbot --nginx -d billing.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (recommended)

# Test auto-renewal
sudo certbot renew --dry-run
```

Certificate will auto-renew. Verify:
```bash
# Check certificate status
sudo certbot certificates
```

---

## 🛡️ STEP 10: Configure Firewall

### Ubuntu/Debian (UFW)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (if not using Nginx)
sudo ufw allow 3000/tcp

# Check status
sudo ufw status
```

### CentOS/RHEL (firewalld)

```bash
# Start firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# Allow SSH
sudo firewall-cmd --permanent --add-service=ssh

# Allow HTTP/HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Allow application port (if not using Nginx)
sudo firewall-cmd --permanent --add-port=3000/tcp

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

---

## ✅ STEP 11: Verify Installation

### Check Application Status

```bash
# PM2 status
pm2 status

# Should show:
# ┌─────┬──────────────────┬─────────┬─────────┬──────────┐
# │ id  │ name             │ status  │ restart │ uptime   │
# ├─────┼──────────────────┼─────────┼─────────┼──────────┤
# │ 0   │ billing-system   │ online  │ 0       │ 5m       │
# └─────┴──────────────────┴─────────┴─────────┴──────────┘
```

### Check Logs

```bash
# View logs
pm2 logs billing-system --lines 50

# Should show:
# Server running on port 3000
# Database connected successfully
```

### Test HTTP Connection

```bash
# Test locally
curl http://localhost:3000

# Should return HTML content
```

### Access from Browser

**Without Nginx:**
```
http://your-server-ip:3000
```

**With Nginx (no SSL):**
```
http://billing.yourdomain.com
```

**With Nginx + SSL:**
```
https://billing.yourdomain.com
```

---

## 🎯 STEP 12: First Login

### Default Credentials

**Admin Account:**
```
Username: admin
Password: admin123
```

**Kasir Account:**
```
Username: kasir
Password: kasir123
```

### ⚠️ IMPORTANT Security Steps

1. **Change default passwords immediately!**
2. Navigate to Settings → Users
3. Change all default passwords
4. Create new admin account
5. Delete or disable default accounts

---

## 🔄 Update Application

### Manual Update

```bash
cd /var/www/billing

# Stop application
pm2 stop billing-system

# Backup database
mysqldump -u billing_user -p billing > backup_$(date +%Y%m%d).sql

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Build
npm run build

# Start application
pm2 start billing-system

# Check logs
pm2 logs billing-system
```

### Auto-Update Script

Create file: `/var/www/billing/update.sh`

```bash
#!/bin/bash

echo "🔄 Updating Billing System..."

cd /var/www/billing

# Backup database
echo "📦 Creating database backup..."
mysqldump -u billing_user -p'your_password' billing > backups/db_$(date +%Y%m%d_%H%M%S).sql

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build
echo "🔨 Building application..."
npm run build

# Restart
echo "🚀 Restarting application..."
pm2 restart billing-system

echo "✅ Update complete!"
pm2 status
```

Make executable:
```bash
chmod +x /var/www/billing/update.sh
```

Run update:
```bash
./update.sh
```

---

## 💾 Backup Strategy

### Database Backup

Create file: `/var/www/billing/backup-db.sh`

```bash
#!/bin/bash

BACKUP_DIR="/var/www/billing/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="billing_user"
DB_PASS="your_password"
DB_NAME="billing"

mkdir -p $BACKUP_DIR

echo "Creating database backup..."
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 30 backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup complete: db_$DATE.sql.gz"
```

Make executable:
```bash
chmod +x /var/www/billing/backup-db.sh
```

### Setup Cron Job

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /var/www/billing/backup-db.sh >> /var/log/billing-backup.log 2>&1
```

### Restore Backup

```bash
# Restore from backup
gunzip < backups/db_20250126_020000.sql.gz | mysql -u billing_user -p billing
```

---

## 🐛 Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs billing-system --err

# Common issues:
# 1. Database connection - check .env
# 2. Port in use - check: netstat -tulpn | grep 3000
# 3. Missing dependencies - run: npm install
```

### Database Connection Error

```bash
# Test MySQL connection
mysql -u billing_user -p billing

# Check MySQL status
sudo systemctl status mysql

# Restart MySQL
sudo systemctl restart mysql
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/billing

# Fix permissions
chmod -R 755 /var/www/billing
chmod 600 /var/www/billing/.env
```

### Port Already in Use

```bash
# Find what's using port 3000
sudo netstat -tulpn | grep 3000

# Kill process
sudo kill -9 PID

# Or change port in .env
nano .env
# Change PORT=3000 to PORT=3001
```

---

## 📊 Monitoring

### Setup Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop netdata

# Start Netdata
sudo systemctl start netdata
sudo systemctl enable netdata

# Access Netdata dashboard
http://your-server-ip:19999
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web dashboard
pm2 plus
```

---

## 🎉 Installation Complete!

Your Billing System is now running at:
- **Local**: http://localhost:3000
- **Server**: http://your-server-ip:3000
- **Domain**: https://billing.yourdomain.com

### Next Steps:
1. ✅ Login with default credentials
2. ✅ Change all passwords
3. ✅ Configure MikroTik integration
4. ✅ Setup payment gateways
5. ✅ Configure notifications (Telegram/WhatsApp)
6. ✅ Add customers and start billing!

---

**Need Help?**
- Documentation: https://github.com/adiprayitno160-svg/billing
- Issues: https://github.com/adiprayitno160-svg/billing/issues

**Happy Billing! 🚀**

