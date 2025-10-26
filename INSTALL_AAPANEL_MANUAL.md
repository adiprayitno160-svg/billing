# 📘 Panduan Instalasi Manual - aaPanel Native

## 🎯 Instalasi Step-by-Step (Manual)

Ikuti langkah-langkah ini satu per satu.

---

## 📋 Persiapan

### 1. Pastikan aaPanel Sudah Terinstall

Cek dengan:
```bash
/etc/init.d/bt status
```

Jika belum install, install dulu:
```bash
# Ubuntu/Debian
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh
bash install.sh aapanel

# CentOS
wget -O install.sh http://www.aapanel.com/script/install_6.0_en.sh
bash install.sh aapanel
```

---

## 🚀 Step 1: Install Node.js

### Via aaPanel (Recommended)
1. Login ke aaPanel: `http://IP-SERVER:7800`
2. Pergi ke **App Store**
3. Cari **"PM2 Manager"**
4. Klik **Install** (otomatis install Node.js juga)

### Atau via Terminal
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Verifikasi
node -v
npm -v
pm2 -v
```

---

## 📥 Step 2: Clone Repository dari GitHub

```bash
# Masuk ke directory web root
cd /www/wwwroot

# Clone repository
git clone https://github.com/YOUR-USERNAME/billing.git

# Masuk ke folder
cd billing
```

**Untuk Repository Private:**
```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -C "deploy" -f ~/.ssh/id_rsa -N ""

# Tampilkan public key
cat ~/.ssh/id_rsa.pub

# Copy key dan tambahkan ke GitHub:
# https://github.com/settings/keys > New SSH key

# Clone dengan SSH
git clone git@github.com:YOUR-USERNAME/billing.git
```

---

## 🗄️ Step 3: Setup Database MySQL

### Via aaPanel (Mudah)
1. Login aaPanel: `http://IP-SERVER:7800`
2. Menu **Database** → **Add Database**
3. Isi form:
   - Database Name: `billing_system`
   - Username: `billing_user`
   - Password: (buat password kuat, catat!)
4. Klik **Submit**

### Via Terminal
```bash
# Login MySQL
mysql -u root -p

# Buat database
CREATE DATABASE billing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Buat user
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'password_kuat_anda';

# Grant privileges
GRANT ALL PRIVILEGES ON billing_system.* TO 'billing_user'@'localhost';

# Flush
FLUSH PRIVILEGES;

# Exit
EXIT;
```

---

## ⚙️ Step 4: Konfigurasi Environment

```bash
# Masuk ke folder aplikasi
cd /www/wwwroot/billing

# Buat file .env
nano .env
```

**Isi dengan:**
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=password_anda_tadi
DB_NAME=billing_system

# Server Configuration
PORT=3000
NODE_ENV=production

# Session Secret (generate random string)
SESSION_SECRET=ganti-dengan-random-string-panjang

# App Configuration
HIDE_BILLING_CUSTOMERS_MENU=false

# Payment Gateway (Optional)
XENDIT_API_KEY=
MITRA_API_KEY=
TRIPAY_API_KEY=

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=

# GitHub (Optional - untuk auto update)
GITHUB_REPO_OWNER=YOUR-USERNAME
GITHUB_REPO_NAME=billing
```

**Save:** `Ctrl+O`, **Exit:** `Ctrl+X`

---

## 📦 Step 5: Install Dependencies

```bash
cd /www/wwwroot/billing

# Install packages
npm install --production

# Tunggu sampai selesai (beberapa menit)
```

---

## 🔨 Step 6: Build Aplikasi

```bash
cd /www/wwwroot/billing

# Build TypeScript to JavaScript
npm run build

# Tunggu sampai selesai
```

---

## 🚀 Step 7: Start dengan PM2

```bash
cd /www/wwwroot/billing

# Start aplikasi
pm2 start ecosystem.config.js --env production

# Save konfigurasi PM2
pm2 save

# Setup PM2 auto-start saat reboot
pm2 startup systemd

# Jalankan command yang muncul (copy-paste)
# Contoh: sudo env PATH=$PATH:/usr/bin...
```

---

## ✅ Step 8: Verifikasi

```bash
# Cek status PM2
pm2 status

# Harus muncul aplikasi dengan status "online"

# Cek logs
pm2 logs billing-system --lines 20

# Test akses
curl http://localhost:3000

# Atau buka browser
# http://IP-SERVER:3000
```

---

## 🌐 Step 9: Setup Nginx Reverse Proxy (Optional)

### Via aaPanel (Mudah)

1. **Buat Website:**
   - Menu **Website** → **Add Site**
   - Domain: `billing.yourdomain.com`
   - Root Directory: `/www/wwwroot/billing`
   - PHP: **Pure Static**
   - Submit

2. **Setup Reverse Proxy:**
   - Klik site yang baru dibuat
   - Tab **Reverse Proxy**
   - Add Reverse Proxy
   - Target URL: `http://127.0.0.1:3000`
   - Enable WebSocket: **Yes**
   - Submit

3. **Setup SSL (Optional):**
   - Tab **SSL**
   - Let's Encrypt
   - Apply
   - Force HTTPS: **Yes**

### Via Terminal (Manual)

```bash
# Buat config Nginx
nano /www/server/panel/vhost/nginx/billing.yourdomain.com.conf
```

**Isi dengan:**
```nginx
server {
    listen 80;
    server_name billing.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Reload Nginx:**
```bash
/etc/init.d/nginx reload
```

---

## 🔒 Step 10: Setup Firewall (Optional)

```bash
# Jika pakai firewalld (CentOS)
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload

# Jika pakai ufw (Ubuntu)
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload
```

---

## 🎉 Selesai! Aplikasi Online!

### Akses Aplikasi:

**Direct:**
```
http://IP-SERVER:3000
```

**Via Domain (jika sudah setup Nginx):**
```
http://billing.yourdomain.com
atau
https://billing.yourdomain.com (jika sudah SSL)
```

### Login:
- Username: `admin`
- Password: `admin123`

**⚠️ GANTI PASSWORD SETELAH LOGIN!**

---

## 📝 Commands Penting

### PM2 Management
```bash
# Lihat status
pm2 status

# Lihat logs real-time
pm2 logs billing-system

# Restart aplikasi
pm2 restart billing-system

# Stop aplikasi
pm2 stop billing-system

# Start aplikasi
pm2 start billing-system

# Delete dari PM2
pm2 delete billing-system
```

### Update Aplikasi
```bash
cd /www/wwwroot/billing

# Pull update dari GitHub
git pull origin main

# Install dependencies baru (jika ada)
npm install

# Build ulang
npm run build

# Restart
pm2 restart billing-system
```

### Check Logs
```bash
# PM2 logs
pm2 logs billing-system

# Application logs
tail -f /www/wwwroot/billing/logs/combined-0.log
tail -f /www/wwwroot/billing/logs/err-0.log

# Nginx logs
tail -f /www/server/panel/logs/nginx/access.log
tail -f /www/server/panel/logs/nginx/error.log
```

### Database Management
```bash
# Backup database
mysqldump -u billing_user -p billing_system > backup_$(date +%Y%m%d).sql

# Restore database
mysql -u billing_user -p billing_system < backup_file.sql

# Access database
mysql -u billing_user -p billing_system
```

---

## 🐛 Troubleshooting

### Port 3000 sudah digunakan
```bash
# Cek process
netstat -tulpn | grep 3000

# Kill process
kill -9 PID

# Atau ganti port di .env
nano .env
# Ubah: PORT=3001
pm2 restart billing-system
```

### Error connect database
```bash
# Test koneksi
mysql -u billing_user -p billing_system

# Cek credentials di .env
cat .env

# Check MySQL running
systemctl status mysql
```

### PM2 tidak start otomatis setelah reboot
```bash
# Setup ulang
pm2 startup systemd
# Copy-paste command yang muncul

pm2 save
```

### Error npm install
```bash
# Clear cache
npm cache clean --force

# Install ulang
rm -rf node_modules package-lock.json
npm install
```

### Error build
```bash
# Cek Node.js version (harus 16+)
node -v

# Cek TypeScript
npx tsc --version

# Clean build
rm -rf dist
npm run build
```

---

## 📊 Checklist Instalasi

- [ ] aaPanel terinstall
- [ ] Node.js & PM2 terinstall
- [ ] Repository di-clone ke `/www/wwwroot/billing`
- [ ] Database MySQL dibuat
- [ ] User database dibuat
- [ ] File `.env` dikonfigurasi
- [ ] `npm install` berhasil
- [ ] `npm run build` berhasil
- [ ] PM2 start berhasil (status: online)
- [ ] Aplikasi bisa diakses di browser
- [ ] Login berhasil
- [ ] Password admin sudah diganti
- [ ] PM2 startup dikonfigurasi
- [ ] Nginx reverse proxy setup (optional)
- [ ] SSL certificate install (optional)
- [ ] Firewall dikonfigurasi

---

## 🎯 Quick Commands Summary

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install -g pm2

# Clone & Setup
cd /www/wwwroot
git clone https://github.com/YOUR-USERNAME/billing.git
cd billing
nano .env  # Isi konfigurasi

# Install & Build
npm install
npm run build

# Start
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd

# Done!
# Access: http://IP-SERVER:3000
```

---

## 📞 Support

Jika ada masalah:
1. Cek logs: `pm2 logs billing-system`
2. Cek status: `pm2 status`
3. Cek .env: `cat .env`
4. Test database: `mysql -u billing_user -p billing_system`
5. Restart: `pm2 restart billing-system`

---

**Instalasi Manual Selesai! 🎉**

**Login:** `http://IP-SERVER:3000`  
**User:** `admin` / `admin123`


