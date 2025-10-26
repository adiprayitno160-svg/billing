# ⚡ Quick Reference Card

Cheat sheet perintah-perintah penting untuk Billing System.

---

## 🚀 Installation (One Command)

```bash
# Basic Install
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash

# Complete Setup (Nginx + SSL)
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/setup-complete.sh | bash

# Uninstall
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/uninstall.sh | bash
```

---

## 🔧 PM2 Management

```bash
# Check Status
pm2 status

# View Logs (Real-time)
pm2 logs billing-system

# View Error Logs Only
pm2 logs billing-system --err

# Restart Application
pm2 restart billing-system

# Stop Application
pm2 stop billing-system

# Start Application
pm2 start billing-system

# Monitor Resources
pm2 monit

# Delete from PM2
pm2 delete billing-system

# Save PM2 Configuration
pm2 save

# List All Processes
pm2 list
```

---

## 💾 Database Operations

```bash
# Login to MySQL
mysql -u billing_user -p billing_system

# Backup Database
cd /var/www/billing && ./backup-db.sh

# Manual Backup
mysqldump -u billing_user -p billing_system > backup_$(date +%Y%m%d).sql

# Backup with Compression
mysqldump -u billing_user -p billing_system | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore Database
mysql -u billing_user -p billing_system < backup_20250126.sql

# Restore from Compressed
gunzip < backup_20250126.sql.gz | mysql -u billing_user -p billing_system

# Show Databases
mysql -u root -p -e "SHOW DATABASES;"

# Show Tables
mysql -u billing_user -p billing_system -e "SHOW TABLES;"
```

---

## 🔄 Update Application

```bash
# Auto Update
cd /var/www/billing && ./update.sh

# Manual Update
cd /var/www/billing
git pull origin main
npm install --production
npm run build
pm2 restart billing-system
```

---

## 🌐 Nginx Commands

```bash
# Test Configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# Stop Nginx
sudo systemctl stop nginx

# Start Nginx
sudo systemctl start nginx

# Check Status
sudo systemctl status nginx

# View Error Logs
sudo tail -f /var/log/nginx/billing_error.log

# View Access Logs
sudo tail -f /var/log/nginx/billing_access.log

# Edit Nginx Config
sudo nano /etc/nginx/sites-available/billing
```

---

## 🔒 SSL Certificate

```bash
# Get Certificate
sudo certbot --nginx -d your-domain.com

# Renew Certificate
sudo certbot renew

# Renew Dry Run (Test)
sudo certbot renew --dry-run

# List Certificates
sudo certbot certificates

# Delete Certificate
sudo certbot delete --cert-name your-domain.com

# Auto-renewal Status
sudo systemctl status certbot.timer
```

---

## 🛡️ Firewall

```bash
# Enable UFW
sudo ufw enable

# Check Status
sudo ufw status

# Allow Port
sudo ufw allow 3000/tcp

# Remove Rule
sudo ufw delete allow 3000/tcp

# Allow Nginx
sudo ufw allow 'Nginx Full'

# Disable UFW
sudo ufw disable

# Reset UFW
sudo ufw reset
```

---

## 📊 System Monitoring

```bash
# System Resources
htop

# Disk Usage
df -h

# Folder Size
du -sh /var/www/billing

# Memory Usage
free -h

# CPU Info
lscpu

# Process List
ps aux | grep node

# Network Connections
netstat -tulpn

# Check Port Usage
sudo netstat -tulpn | grep 3000

# System Uptime
uptime

# System Logs
journalctl -xe
```

---

## 🗄️ Service Management

```bash
# Check Service Status
sudo systemctl status mysql
sudo systemctl status nginx
sudo systemctl status pm2-username

# Start Service
sudo systemctl start mysql

# Stop Service
sudo systemctl stop mysql

# Restart Service
sudo systemctl restart mysql

# Enable on Boot
sudo systemctl enable mysql

# Disable on Boot
sudo systemctl disable mysql
```

---

## 📁 File Operations

```bash
# Navigate to App Directory
cd /var/www/billing

# View .env File
cat .env

# Edit .env File
nano .env

# Check Permissions
ls -la

# Change Owner
sudo chown -R $USER:$USER /var/www/billing

# Change Permissions
chmod 755 /var/www/billing
chmod 600 .env

# View Disk Space
df -h

# Clean npm Cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules

# Reinstall Dependencies
npm install --production
```

---

## 🔍 Debugging

```bash
# Check Node Version
node -v

# Check npm Version
npm -v

# Check PM2 Version
pm2 -v

# Test Database Connection
mysql -u billing_user -p billing_system -e "SELECT 'OK';"

# Check Open Ports
sudo netstat -tulpn | grep LISTEN

# Check Application Port
curl http://localhost:3000

# Check External Access
curl http://YOUR_SERVER_IP:3000

# View Environment Variables
printenv | grep DB_

# Test Nginx Configuration
sudo nginx -t

# Check Git Status
cd /var/www/billing && git status

# Check Git Remote
cd /var/www/billing && git remote -v
```

---

## 🔐 Security

```bash
# Change Database Password
mysql -u root -p
ALTER USER 'billing_user'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;

# Generate Random Password
openssl rand -base64 32

# Update .env Password
nano /var/www/billing/.env

# Secure .env File
chmod 600 /var/www/billing/.env

# Check Failed Login Attempts
sudo grep "Failed password" /var/log/auth.log

# Install fail2ban
sudo apt install fail2ban
```

---

## 📝 Logs Management

```bash
# View Application Logs
pm2 logs billing-system

# View Last 50 Lines
pm2 logs billing-system --lines 50

# Clear PM2 Logs
pm2 flush

# View Nginx Error Logs
sudo tail -100 /var/log/nginx/billing_error.log

# View Nginx Access Logs
sudo tail -100 /var/log/nginx/billing_access.log

# View MySQL Error Logs
sudo tail -100 /var/log/mysql/error.log

# View System Logs
sudo journalctl -u nginx -n 50

# Clear Old Logs
sudo journalctl --vacuum-time=7d
```

---

## ⚙️ Configuration Locations

```
Application:     /var/www/billing/
Configuration:   /var/www/billing/.env
Nginx Config:    /etc/nginx/sites-available/billing
SSL Certs:       /etc/letsencrypt/live/your-domain.com/
Backups:         /var/www/billing/backups/
PM2 Logs:        ~/.pm2/logs/
Nginx Logs:      /var/log/nginx/
MySQL Data:      /var/lib/mysql/
```

---

## 🎯 Default Access

```
Application URL:     http://YOUR_IP:3000
Admin Username:      admin
Admin Password:      admin123
Kasir Username:      kasir  
Kasir Password:      kasir123

Database Name:       billing_system
Database User:       billing_user
Database Password:   (check /tmp/billing_db_creds.txt)
```

⚠️ **Change all default passwords immediately!**

---

## 🆘 Emergency Commands

```bash
# Application Not Responding
pm2 restart billing-system

# Database Connection Issues
sudo systemctl restart mysql
pm2 restart billing-system

# Nginx Not Working
sudo nginx -t
sudo systemctl restart nginx

# Out of Memory
sudo systemctl restart mysql
pm2 restart billing-system

# Disk Full
df -h
sudo apt clean
sudo apt autoremove

# Complete Restart
sudo systemctl restart mysql
sudo systemctl restart nginx
pm2 restart billing-system

# Nuclear Option (Rebuild Everything)
cd /var/www/billing
git pull
npm install --production
npm run build
pm2 restart billing-system
```

---

## 📞 Quick Help

```bash
# Check Installation Guide
cat /var/www/billing/INSTALL_NATIVE.md

# Check README
cat /var/www/billing/README.md

# View Package Info
cat /var/www/billing/package.json

# Check Node.js Documentation
node --help

# Check PM2 Documentation
pm2 --help

# Check Git Documentation
git --help
```

---

## 🔗 Important URLs

- **Application**: http://YOUR_SERVER_IP:3000
- **Netdata** (if installed): http://YOUR_SERVER_IP:19999
- **GitHub Repo**: https://github.com/adiprayitno160-svg/billing
- **Issues**: https://github.com/adiprayitno160-svg/billing/issues

---

**Print this page and keep it handy!** 📋

**Last Updated**: January 2025

