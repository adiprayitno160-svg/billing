# 🗑️ Panduan Uninstall Billing System dari Server

## 📋 Kapan Perlu Uninstall?

- 🔄 Fresh install / clean deployment
- 🐛 Troubleshooting issues
- 🧹 Clean up server
- 💾 Pindah ke server lain
- ⚙️ Reconfigure dari awal

---

## ⚡ Metode 1: Auto Uninstall Script (RECOMMENDED)

### Download & Jalankan Script

```bash
# Login ke server
ssh root@IP_SERVER

# Download script uninstall
wget https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/uninstall-from-server.sh

# Beri permission
chmod +x uninstall-from-server.sh

# Jalankan
bash uninstall-from-server.sh
```

### Script Akan:
- ✅ Backup data (optional)
- ✅ Stop PM2 process
- ✅ Hapus application directory
- ✅ Drop database
- ✅ Remove Nginx config
- ✅ Clean up (optional: Node.js & PM2)

### Customisasi (Optional)

```bash
# Custom directory/database
export APP_DIR="/www/wwwroot/my-billing"
export DB_NAME="my_billing_db"
export PM2_APP_NAME="my-billing"

bash uninstall-from-server.sh
```

---

## 🔧 Metode 2: Manual Uninstall (Step-by-Step)

### Step 1: Backup Data (PENTING!)

```bash
# Buat directory backup
BACKUP_DIR="$HOME/billing_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
mysqldump -u root -p billing_system > "$BACKUP_DIR/database.sql"

# Backup application files
tar -czf "$BACKUP_DIR/app_files.tar.gz" -C /www/wwwroot billing

# Backup credentials
cp /www/wwwroot/billing/.env "$BACKUP_DIR/.env.backup"
cp /www/wwwroot/billing/CREDENTIALS.txt "$BACKUP_DIR/CREDENTIALS.txt.backup"

echo "✅ Backup tersimpan di: $BACKUP_DIR"
```

---

### Step 2: Stop PM2 Process

```bash
# Lihat PM2 list
pm2 list

# Stop aplikasi
pm2 stop billing-system

# Delete dari PM2
pm2 delete billing-system

# Save PM2 config
pm2 save

# Verifikasi
pm2 list
```

---

### Step 3: Hapus Application Directory

```bash
# Pindah keluar dari directory aplikasi
cd ~

# Hapus directory aplikasi
rm -rf /www/wwwroot/billing

# Verifikasi
ls -la /www/wwwroot/ | grep billing
```

---

### Step 4: Drop Database

```bash
# Login ke MySQL
mysql -u root -p

# Drop database
DROP DATABASE IF EXISTS billing_system;

# Drop user (optional)
DROP USER IF EXISTS 'billing_user'@'localhost';

# Flush privileges
FLUSH PRIVILEGES;

# Exit
EXIT;
```

**Atau via command line:**

```bash
# Drop database
mysql -u root -p -e "DROP DATABASE IF EXISTS billing_system;"

# Drop user
mysql -u root -p -e "DROP USER IF EXISTS 'billing_user'@'localhost';"
```

---

### Step 5: Remove Nginx Config

**Jika menggunakan aaPanel:**

```bash
# Cari config Nginx
ls -la /www/server/panel/vhost/nginx/ | grep billing

# Hapus config
rm -f /www/server/panel/vhost/nginx/billing.yourdomain.com.conf

# Reload Nginx
/etc/init.d/nginx reload
```

**Jika menggunakan Nginx standard:**

```bash
# Cari config
ls -la /etc/nginx/sites-available/ | grep billing

# Hapus symlink dari sites-enabled
rm -f /etc/nginx/sites-enabled/billing.yourdomain.com

# Hapus dari sites-available
rm -f /etc/nginx/sites-available/billing.yourdomain.com

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

### Step 6: Clean Up (Optional)

**Hapus PM2:**

```bash
# Uninstall PM2 globally
npm uninstall -g pm2

# Remove PM2 startup
systemctl disable pm2-root.service
rm -f /etc/systemd/system/pm2-root.service
systemctl daemon-reload

# Clean PM2 files
rm -rf ~/.pm2
```

**Hapus Node.js (jika tidak dipakai aplikasi lain):**

```bash
# Debian/Ubuntu
apt-get remove -y nodejs
apt-get autoremove -y

# CentOS/RHEL
yum remove -y nodejs

# Clean up npm
rm -rf /usr/local/lib/node_modules
rm -rf ~/.npm
```

**Clean up logs:**

```bash
# Hapus logs
rm -rf /var/log/pm2
rm -rf /root/.pm2/logs
```

---

## ✅ Verifikasi Uninstall

```bash
# Check directory
ls -la /www/wwwroot/billing
# Output: No such file or directory ✅

# Check PM2
pm2 list
# Output: Tidak ada billing-system ✅

# Check database
mysql -u root -p -e "SHOW DATABASES;" | grep billing
# Output: Tidak ada billing_system ✅

# Check Nginx
nginx -t
# Output: Success ✅

# Check port
netstat -tulpn | grep 3000
# Output: Nothing ✅
```

---

## 🔄 Fresh Install Setelah Uninstall

Setelah uninstall selesai, Anda bisa install ulang dengan:

```bash
# Method 1: Auto install
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/aapanel-deploy.sh | bash

# Method 2: Manual
cd /www/wwwroot
git clone https://github.com/YOUR-USERNAME/billing.git
cd billing
# ... follow install steps
```

---

## 💾 Restore dari Backup

Jika perlu restore data setelah uninstall:

```bash
# Restore database
mysql -u root -p billing_system < $BACKUP_DIR/database.sql

# Restore application files
cd /www/wwwroot
tar -xzf $BACKUP_DIR/app_files.tar.gz

# Restore credentials
cp $BACKUP_DIR/.env.backup /www/wwwroot/billing/.env

# Restart aplikasi
cd /www/wwwroot/billing
pm2 start ecosystem.config.js
```

---

## ⚠️ Troubleshooting

### Error: Directory not empty

```bash
# Force remove
rm -rf /www/wwwroot/billing

# Jika masih gagal, check permission
ls -la /www/wwwroot/
chown -R root:root /www/wwwroot/billing
rm -rf /www/wwwroot/billing
```

---

### Error: Cannot drop database

```bash
# Check active connections
mysql -u root -p -e "SHOW PROCESSLIST;" | grep billing

# Kill connections
mysql -u root -p -e "SELECT CONCAT('KILL ', id, ';') FROM INFORMATION_SCHEMA.PROCESSLIST WHERE db = 'billing_system';"

# Try drop again
mysql -u root -p -e "DROP DATABASE billing_system;"
```

---

### Error: PM2 process won't stop

```bash
# Force delete
pm2 delete billing-system --force

# Kill PM2 daemon
pm2 kill

# Start fresh
pm2 resurrect
```

---

### Error: Port still in use

```bash
# Check process using port 3000
netstat -tulpn | grep 3000

# Kill process
kill -9 PID_NUMBER

# Or using lsof
lsof -ti:3000 | xargs kill -9
```

---

## 📊 Checklist Uninstall

### Before Uninstall:
- [ ] Backup database
- [ ] Backup application files  
- [ ] Backup .env dan credentials
- [ ] Save backup ke tempat aman
- [ ] Inform team/users (jika production)

### During Uninstall:
- [ ] Stop PM2 process
- [ ] Delete PM2 entry
- [ ] Remove application directory
- [ ] Drop database
- [ ] Remove database user
- [ ] Remove Nginx config
- [ ] Reload Nginx

### After Uninstall:
- [ ] Verify directory removed
- [ ] Verify PM2 process removed
- [ ] Verify database removed
- [ ] Verify Nginx config removed
- [ ] Verify port available
- [ ] Test Nginx configuration
- [ ] Reboot server (optional)

---

## 🎯 Quick Commands

### Complete Uninstall (One-liners)

**Quick uninstall (NO backup):**
```bash
pm2 delete billing-system 2>/dev/null; \
rm -rf /www/wwwroot/billing; \
mysql -u root -p -e "DROP DATABASE IF EXISTS billing_system; DROP USER IF EXISTS 'billing_user'@'localhost';"
```

**Uninstall + Backup:**
```bash
BACKUP_DIR="$HOME/billing_backup_$(date +%Y%m%d_%H%M%S)"; \
mkdir -p "$BACKUP_DIR"; \
mysqldump -u root -p billing_system > "$BACKUP_DIR/database.sql"; \
tar -czf "$BACKUP_DIR/app_files.tar.gz" -C /www/wwwroot billing; \
pm2 delete billing-system; \
rm -rf /www/wwwroot/billing; \
mysql -u root -p -e "DROP DATABASE IF EXISTS billing_system;"; \
echo "Backup: $BACKUP_DIR"
```

---

## 📞 Support

Jika ada masalah saat uninstall:

1. **Check logs**: `pm2 logs billing-system`
2. **Check processes**: `ps aux | grep node`
3. **Check ports**: `netstat -tulpn | grep 3000`
4. **Force clean**: Use uninstall script dengan option force
5. **Manual cleanup**: Follow step-by-step manual guide

---

## ✅ Summary

| Item | Auto Script | Manual |
|------|------------|--------|
| **Backup** | ✅ Optional | Manual |
| **Stop PM2** | ✅ Auto | Manual |
| **Remove Files** | ✅ Auto | Manual |
| **Drop Database** | ✅ Auto | Manual |
| **Nginx Config** | ✅ Auto detect | Manual |
| **Clean Up** | ✅ Optional | Manual |
| **Verification** | ✅ Auto | Manual |
| **Time** | ~2 menit | ~10 menit |

**Recommendation**: Gunakan auto script untuk kemudahan dan keamanan!

---

**Created**: October 26, 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅


