# 📜 Installation Scripts Guide

Panduan lengkap untuk menggunakan script instalasi otomatis Billing System.

---

## 🎯 Available Scripts

### 1. `install.sh` - Quick Install
**One-click basic installation**

Script ini akan menginstall Billing System dengan konfigurasi dasar.

#### What it installs:
- ✅ Node.js 18.x LTS
- ✅ PM2 Process Manager
- ✅ MariaDB Database Server
- ✅ Billing System Application
- ✅ Basic Firewall Configuration

#### Usage:

```bash
# One-line installation
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash
```

#### Manual download and run:

```bash
# Download script
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh

# Make executable
chmod +x install.sh

# Run
./install.sh
```

#### Requirements:
- Ubuntu 20.04+ or Debian 10+
- Sudo privileges
- Minimum 2GB RAM
- 20GB free disk space

#### Time: ~10-15 minutes

---

### 2. `setup-complete.sh` - Complete Production Setup
**Full production-ready installation with Nginx & SSL**

Script ini menginstall semua dari `install.sh` plus additional production features.

#### Additional features:
- ✅ Nginx Reverse Proxy
- ✅ SSL Certificate (Let's Encrypt)
- ✅ Auto SSL Renewal
- ✅ Enhanced Security Headers
- ✅ Daily Database Backup
- ✅ Monitoring Tools (optional)

#### Usage:

```bash
# One-line complete setup
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/setup-complete.sh | bash
```

#### Manual download and run:

```bash
# Download script
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/setup-complete.sh

# Make executable
chmod +x setup-complete.sh

# Run
./setup-complete.sh
```

#### Requirements:
- All requirements from `install.sh`
- Domain name (optional, but required for SSL)
- DNS properly configured
- Ports 80 and 443 open

#### Time: ~15-20 minutes

---

### 3. `uninstall.sh` - Complete Removal
**Safe uninstallation with backup**

Script ini akan menghapus Billing System dari server dengan aman.

#### What it does:
- ✅ Creates final database backup
- ✅ Backs up configuration files
- ✅ Stops and removes application
- ✅ Removes Nginx configuration
- ✅ Removes SSL certificates (optional)
- ✅ Removes database (optional)
- ✅ Removes dependencies (optional)

#### Usage:

```bash
# Download and run uninstaller
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/uninstall.sh | bash
```

#### Manual download and run:

```bash
# Download script
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/uninstall.sh

# Make executable
chmod +x uninstall.sh

# Run
./uninstall.sh
```

#### Backup location:
```
$HOME/billing_uninstall_backup/
```

---

## 🚀 Quick Start Examples

### Example 1: Fresh Server - Basic Setup

```bash
# SSH to your server
ssh user@your-server-ip

# Run quick install
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash

# Wait for completion (~10 minutes)

# Access application
# http://your-server-ip:3000
```

### Example 2: Fresh Server - Production Setup with Domain

```bash
# SSH to your server
ssh user@your-server-ip

# Make sure your domain points to this server
# e.g., billing.example.com -> your-server-ip

# Run complete setup
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/setup-complete.sh | bash

# Enter your domain when prompted
# Enter your email for SSL certificate

# Wait for completion (~15 minutes)

# Access application
# https://billing.example.com
```

### Example 3: Update Existing Installation

```bash
# SSH to your server
ssh user@your-server-ip

# Navigate to installation directory
cd /var/www/billing

# Run update script
./update.sh
```

### Example 4: Uninstall Everything

```bash
# SSH to your server
ssh user@your-server-ip

# Download and run uninstaller
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/uninstall.sh | bash

# Follow prompts to remove components
```

---

## 📋 What Gets Installed

### Quick Install (`install.sh`)

```
/var/www/billing/                 # Application directory
├── dist/                         # Built application
├── node_modules/                 # Dependencies
├── public/                       # Static files
├── views/                        # EJS templates
├── .env                          # Configuration
├── backup-db.sh                  # Backup script
└── update.sh                     # Update script

/tmp/billing_db_creds.txt         # Database credentials (temporary)
```

### Complete Setup (additional)

```
/etc/nginx/sites-available/billing    # Nginx config
/etc/nginx/sites-enabled/billing      # Nginx symlink
/etc/letsencrypt/                     # SSL certificates
/var/log/nginx/billing_*.log          # Nginx logs
```

---

## ⚙️ Post-Installation

### 1. Access Application

**After Quick Install:**
```
http://YOUR_SERVER_IP:3000
```

**After Complete Setup:**
```
https://your-domain.com
```

### 2. Default Login

```
Username: admin
Password: admin123
```

⚠️ **Change this immediately after first login!**

### 3. Database Credentials

Credentials are saved temporarily in:
```bash
cat /tmp/billing_db_creds.txt
```

**Important:**
1. Copy these credentials to safe place
2. Update `.env` if needed
3. Delete temp file: `rm /tmp/billing_db_creds.txt`

### 4. Management Commands

```bash
# Check application status
pm2 status

# View application logs
pm2 logs billing-system

# Restart application
pm2 restart billing-system

# Backup database manually
cd /var/www/billing
./backup-db.sh

# Update application
cd /var/www/billing
./update.sh
```

---

## 🔧 Customization

### Changing Application Port

Edit `.env` file:
```bash
nano /var/www/billing/.env
```

Change:
```env
PORT=3000
```

Restart:
```bash
pm2 restart billing-system
```

### Changing Database Credentials

1. Update `.env`:
```bash
nano /var/www/billing/.env
```

2. Update MySQL user:
```sql
mysql -u root -p
ALTER USER 'billing_user'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```

3. Restart application:
```bash
pm2 restart billing-system
```

### Adding Domain After Installation

1. Point domain to server IP
2. Create Nginx config manually
3. Get SSL certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

---

## 🐛 Troubleshooting

### Installation Failed

```bash
# Check installation logs
cat /tmp/billing-install.log

# Try manual installation
# See: INSTALL_NATIVE.md
```

### Database Connection Error

```bash
# Test database connection
mysql -u billing_user -p billing_system

# Check credentials
cat /var/www/billing/.env

# Restart MySQL
sudo systemctl restart mariadb
```

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs billing-system --err

# Check application logs
pm2 logs billing-system

# Rebuild application
cd /var/www/billing
npm run build
pm2 restart billing-system
```

### Nginx Error

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/billing_error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Error

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew

# Restart Nginx
sudo systemctl restart nginx
```

### Port Already in Use

```bash
# Check what's using port 3000
sudo netstat -tulpn | grep 3000

# Change port in .env
nano /var/www/billing/.env

# Restart
pm2 restart billing-system
```

---

## 🔒 Security Recommendations

After installation:

1. ✅ Change default admin password
2. ✅ Change default kasir password
3. ✅ Save database credentials securely
4. ✅ Delete temp credentials file
5. ✅ Enable firewall
6. ✅ Setup regular backups
7. ✅ Keep system updated
8. ✅ Use SSL/HTTPS in production
9. ✅ Setup fail2ban (optional)
10. ✅ Enable 2FA for admin (if available)

---

## 📊 Monitoring

### Check System Resources

```bash
# CPU and Memory usage
htop

# Disk usage
df -h

# Check PM2 status
pm2 monit

# Check Nginx status
sudo systemctl status nginx

# Check MySQL status
sudo systemctl status mariadb
```

### Setup Additional Monitoring

```bash
# Install netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access dashboard
http://your-server-ip:19999
```

---

## 💾 Backup & Restore

### Manual Backup

```bash
# Backup database
cd /var/www/billing
./backup-db.sh

# Backups stored in:
ls -lh /var/www/billing/backups/
```

### Automatic Backup

Already configured with cron (daily at 2 AM):
```bash
# View cron jobs
crontab -l

# Modify backup schedule
crontab -e
```

### Restore from Backup

```bash
# List backups
ls -lh /var/www/billing/backups/

# Restore
gunzip < /var/www/billing/backups/db_20250126_020000.sql.gz | mysql -u billing_user -p billing_system
```

---

## 🔄 Updates

### Automatic Update

```bash
cd /var/www/billing
./update.sh
```

### Manual Update

```bash
cd /var/www/billing

# Backup first
./backup-db.sh

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Build
npm run build

# Restart
pm2 restart billing-system
```

---

## 📞 Support

If you encounter issues with installation scripts:

1. **Check logs**: `/tmp/billing-install.log`
2. **Check documentation**: `INSTALL_NATIVE.md`
3. **GitHub Issues**: [Report Issue](https://github.com/adiprayitno160-svg/billing/issues)
4. **Manual Installation**: Follow step-by-step guide in `INSTALL_NATIVE.md`

---

## 🎯 Best Practices

1. **Fresh Server**: Always use fresh Ubuntu/Debian installation
2. **Root Access**: Run with sudo/root privileges
3. **Backup First**: Always backup before updates
4. **Test First**: Test on staging server before production
5. **Monitor Logs**: Regularly check application and system logs
6. **Keep Updated**: Regularly update application and system
7. **Security**: Follow security recommendations
8. **Documentation**: Keep documentation updated

---

**Happy Installing! 🚀**

