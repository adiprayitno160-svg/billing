# ⚡ Quick Start - Native Installation

Panduan cepat instalasi Billing System di native server (tanpa aaPanel).

---

## 🚀 One-Line Installation

### Prerequisites

✅ **Fresh Ubuntu/Debian server**  
✅ **User dengan sudo privileges** (BUKAN root!)  
✅ **Internet connection**

### Installation Command

```bash
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash
```

**That's it!** Script akan otomatis install semua yang dibutuhkan. ⚡

---

## 📋 Step-by-Step Manual

Jika metode one-line tidak bisa, ikuti langkah berikut:

### Step 1: Prepare Server

**Login sebagai user biasa (BUKAN root):**

```bash
# Jika login sebagai root, buat user baru:
adduser adi
usermod -aG sudo adi

# Exit dari root dan login sebagai user:
exit
su - adi
```

### Step 2: Install Basic Tools

```bash
sudo apt update
sudo apt install -y curl wget git
```

### Step 3: Download Installer

```bash
# Download script
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh

# Beri permission
chmod +x install.sh
```

### Step 4: Run Installer

```bash
./install.sh
```

Script akan bertanya konfirmasi:

```
This script will install:
  • Node.js 18.x LTS
  • PM2 Process Manager
  • MariaDB Database
  • Billing System Application

Continue with installation? (y/N):
```

Ketik **`y`** dan tekan Enter.

### Step 5: Wait for Installation

Proses instalasi akan berjalan otomatis (~10-15 menit):

```
✓ Installing system dependencies...
✓ Installing Node.js 18.x LTS...
✓ Installing PM2 process manager...
✓ Installing MySQL/MariaDB...
✓ Setting up database...
✓ Cloning repository...
✓ Installing application dependencies...
✓ Setting up environment configuration...
✓ Building application...
✓ Starting application with PM2...
✓ Configuring firewall...
```

### Step 6: Installation Complete! 🎉

Setelah selesai, Anda akan melihat:

```
============================================
  ✅ Installation Complete!
============================================

🌐 Access your Billing System:
   http://YOUR_SERVER_IP:3000
   http://localhost:3000

🔐 Default Login Credentials:
   Username: admin
   Password: admin123

⚠️  IMPORTANT SECURITY STEPS:
   1. Change default admin password immediately!
   2. Database credentials saved in: /tmp/billing_db_creds.txt
   3. Save your credentials securely and delete temp file
```

---

## 🌐 Access Application

### From Browser

```
http://YOUR_SERVER_IP:3000
```

**Example:**
```
http://192.168.1.100:3000
```

### Login

```
Username: admin
Password: admin123
```

⚠️ **IMMEDIATELY change default password after first login!**

---

## 🔧 Post-Installation

### 1. Save Database Credentials

```bash
# View credentials
cat /tmp/billing_db_creds.txt

# Copy somewhere safe, then delete
rm /tmp/billing_db_creds.txt
```

### 2. Configure Application (Optional)

```bash
cd /var/www/billing
nano .env
```

Add optional configurations:
- MikroTik settings
- Payment gateway keys
- Telegram/WhatsApp notifications
- etc.

**Restart after changes:**
```bash
pm2 restart billing-system
```

### 3. Setup SSL (Recommended for Production)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Install Nginx
sudo apt install -y nginx

# Configure Nginx (see INSTALL_NATIVE.md for details)

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

---

## 📊 Useful Commands

### Check Application Status

```bash
pm2 status
```

### View Logs

```bash
# Real-time logs
pm2 logs billing-system

# Last 100 lines
pm2 logs billing-system --lines 100

# Error logs only
pm2 logs billing-system --err
```

### Restart Application

```bash
pm2 restart billing-system
```

### Stop Application

```bash
pm2 stop billing-system
```

### Start Application

```bash
pm2 start billing-system
```

### Monitor Resources

```bash
pm2 monit
```

---

## 🔄 Update Application

Script sudah membuat update script otomatis:

```bash
cd /var/www/billing
./update.sh
```

Script akan:
1. Backup database
2. Pull latest code from GitHub
3. Install dependencies
4. Build application
5. Restart PM2

---

## 💾 Backup Database

Script sudah membuat backup script otomatis:

```bash
cd /var/www/billing
./backup-db.sh
```

Backup akan disimpan di: `/var/www/billing/backups/`

### Setup Auto Backup (Optional)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /var/www/billing/backup-db.sh
```

---

## 🐛 Troubleshooting

### Application Not Starting

```bash
# Check logs
pm2 logs billing-system --err --lines 50

# Common issues:
# 1. Database not running
sudo systemctl status mariadb
sudo systemctl start mariadb

# 2. Port already in use
sudo netstat -tulpn | grep 3000

# 3. Permission issues
sudo chown -R $USER:$USER /var/www/billing
```

### Cannot Access from Browser

```bash
# Check firewall
sudo ufw status

# Allow port 3000
sudo ufw allow 3000/tcp

# Check application running
pm2 status
curl http://localhost:3000
```

### Database Connection Error

```bash
# Check .env file
cd /var/www/billing
cat .env | grep DB_

# Test database connection
mysql -u billing_user -p billing_system
# Enter password from /tmp/billing_db_creds.txt

# Restart application
pm2 restart billing-system
```

---

## 🗑️ Uninstall

If you want to completely remove the application:

```bash
# Stop and remove from PM2
pm2 stop billing-system
pm2 delete billing-system
pm2 save

# Remove application files
sudo rm -rf /var/www/billing

# Remove database (optional)
sudo mysql -e "DROP DATABASE billing_system;"
sudo mysql -e "DROP USER 'billing_user'@'localhost';"

# Remove Node.js and PM2 (optional)
sudo npm uninstall -g pm2
sudo apt remove nodejs npm
```

---

## ❓ Common Questions

### Q: Can I change the installation directory?

**A:** Yes, edit the `install.sh` script:
```bash
# Change this line:
APP_DIR="/var/www/billing"
# To your preferred directory:
APP_DIR="/home/adi/apps/billing"
```

### Q: Can I use a different database name/user?

**A:** Yes, edit these lines in `install.sh`:
```bash
DB_NAME="billing_system"
DB_USER="billing_user"
```

### Q: Can I change the port?

**A:** Yes, edit the `.env` file:
```bash
cd /var/www/billing
nano .env
# Change: PORT=3000
# To: PORT=8080

pm2 restart billing-system
```

### Q: Script failed, how to retry?

**A:** Clean up and retry:
```bash
# Remove partial installation
sudo rm -rf /var/www/billing
pm2 delete billing-system 2>/dev/null || true

# Run script again
./install.sh
```

---

## 🆘 Need Help?

### Documentation

- 📘 [Full Installation Guide](./INSTALL_NATIVE.md)
- 📋 [System Requirements](./SYSTEM_REQUIREMENTS.md)
- 🔧 [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)

### Support

- 🐛 [Report Issues](https://github.com/adiprayitno160-svg/billing/issues)
- 💬 [Discussions](https://github.com/adiprayitno160-svg/billing/discussions)
- 📧 Email: support@example.com

---

## ✅ Next Steps After Installation

1. **Change Default Password** ⚠️
   - Login as admin
   - Go to Settings → Users
   - Change admin password

2. **Configure MikroTik** (if using)
   - Settings → MikroTik
   - Enter router credentials
   - Test connection

3. **Setup Payment Gateway** (optional)
   - Settings → Payment
   - Configure Midtrans/Xendit/Tripay
   - Test payment

4. **Add Your First Customer**
   - Customers → Add New
   - Fill customer data
   - Assign package

5. **Create Invoice**
   - Billing → Create Invoice
   - Select customer
   - Generate

---

## 🎉 You're Ready!

Your Billing System is now running and ready to use!

**Access:** http://YOUR_SERVER_IP:3000  
**Login:** admin / admin123

**Don't forget to:**
- ✅ Change default password
- ✅ Save database credentials
- ✅ Setup SSL for production
- ✅ Configure backups

---

**Happy Billing! 🚀**

[← Back to Documentation](./README_INSTALLATION.md)

