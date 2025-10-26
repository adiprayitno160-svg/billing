# 🚀 Panduan Install Billing System di aaPanel

## 📋 Prasyarat
- VPS/Server dengan aaPanel sudah terinstall
- Akses root/sudo ke server
- Repository GitHub billing system

---

## 🎯 Metode 1: Instalasi Otomatis (MUDAH!)

### Step 1: Login ke Server via SSH
```bash
ssh root@IP_SERVER_ANDA
```

### Step 2: Download & Jalankan Script Installer
```bash
# Download script dari GitHub
wget https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/aapanel-deploy.sh

# Beri permission execute
chmod +x aapanel-deploy.sh

# Edit URL GitHub repo Anda
nano aapanel-deploy.sh
# Ganti baris: GITHUB_REPO="https://github.com/YOUR-USERNAME/billing.git"

# Jalankan installer
bash aapanel-deploy.sh
```

### Step 3: Ikuti Instruksi di Layar
Script akan otomatis:
- ✅ Cek prerequisites
- ✅ Install dependencies (Node.js, PM2, dll)
- ✅ Clone repository dari GitHub
- ✅ Setup database MySQL
- ✅ Konfigurasi environment
- ✅ Install NPM packages
- ✅ Build aplikasi
- ✅ Start dengan PM2
- ✅ Setup Nginx (opsional)

### Step 4: Akses Aplikasi
```
http://IP-SERVER:3000
```

**Login default:**
- Username: `admin`
- Password: `admin123`

⚠️ **PENTING: Ganti password setelah login pertama!**

---

## 🎯 Metode 2: Instalasi Manual

### 1. Install Node.js via aaPanel

**Via aaPanel Web Interface:**
1. Login ke aaPanel (http://IP-SERVER:7800)
2. Pergi ke **App Store**
3. Cari **"PM2 Manager"**
4. Klik **Install** (ini akan install Node.js otomatis)

**Atau via SSH:**
```bash
# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install PM2 globally
npm install -g pm2
```

### 2. Clone Repository dari GitHub

```bash
# Masuk ke direktori web root
cd /www/wwwroot

# Clone repository
git clone https://github.com/YOUR-USERNAME/billing.git
cd billing
```

**Jika repository private (perlu SSH key):**
```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -C "deploy" -f ~/.ssh/id_rsa -N ""

# Tampilkan public key
cat ~/.ssh/id_rsa.pub

# Copy key dan tambahkan ke GitHub:
# https://github.com/settings/keys > New SSH key
```

### 3. Setup Database via aaPanel

**Via aaPanel Web Interface:**
1. Login ke aaPanel
2. Pergi ke **Database** > **MySQL**
3. Klik **Add Database**
4. Isi form:
   - Database Name: `billing_system`
   - Username: `billing_user`
   - Password: (generate atau buat sendiri)
5. Klik **Submit**

**Atau via SSH:**
```bash
# Dapatkan MySQL root password
cat /www/server/panel/default.pl | grep password

# Login ke MySQL
mysql -u root -p

# Buat database
CREATE DATABASE billing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'password_anda';
GRANT ALL PRIVILEGES ON billing_system.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Konfigurasi Environment

```bash
cd /www/wwwroot/billing

# Buat file .env
nano .env
```

Isi dengan:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=password_anda
DB_NAME=billing_system

# Server Configuration
PORT=3000
NODE_ENV=production

# Session Secret (generate random string)
SESSION_SECRET=your-random-secret-key-here

# App Configuration
HIDE_BILLING_CUSTOMERS_MENU=false
```

### 5. Install Dependencies & Build

```bash
cd /www/wwwroot/billing

# Install packages
npm install --production

# Build aplikasi
npm run build
```

### 6. Start dengan PM2

```bash
# Start aplikasi
pm2 start ecosystem.config.js --env production

# Save konfigurasi PM2
pm2 save

# Setup PM2 auto-start saat reboot
pm2 startup systemd
```

### 7. Setup Nginx Reverse Proxy (Opsional)

**Via aaPanel Web Interface:**
1. Login ke aaPanel
2. Pergi ke **Website** > **Add site**
3. Domain: `billing.yourdomain.com`
4. Setelah dibuat, klik **Settings** > **Reverse Proxy**
5. Target URL: `http://127.0.0.1:3000`
6. Enable **Cache** (optional)
7. Klik **Submit**

**Atau manual via SSH:**
```bash
# Buat konfigurasi Nginx
nano /www/server/panel/vhost/nginx/billing.yourdomain.com.conf
```

Isi dengan:
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Reload Nginx:
```bash
/etc/init.d/nginx reload
```

### 8. Setup SSL (Opsional)

**Via aaPanel:**
1. Website > Settings > SSL
2. Pilih **Let's Encrypt**
3. Klik **Apply**

---

## 🔧 Perintah PM2 yang Berguna

```bash
# Lihat status aplikasi
pm2 status

# Lihat logs real-time
pm2 logs billing-system

# Restart aplikasi
pm2 restart billing-system

# Stop aplikasi
pm2 stop billing-system

# Start aplikasi
pm2 start billing-system

# Hapus dari PM2
pm2 delete billing-system
```

---

## 🔥 Update Aplikasi dari GitHub

Untuk update aplikasi ke versi terbaru:

```bash
cd /www/wwwroot/billing

# Pull update dari GitHub
git pull origin main

# Install dependencies baru (jika ada)
npm install --production

# Build ulang
npm run build

# Restart aplikasi
pm2 restart billing-system
```

---

## 🔒 Keamanan

### 1. Firewall
Buka port yang diperlukan:
```bash
# Port aaPanel
firewall-cmd --permanent --add-port=7800/tcp

# Port aplikasi (jika akses langsung)
firewall-cmd --permanent --add-port=3000/tcp

# Port HTTP/HTTPS
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp

# Reload firewall
firewall-cmd --reload
```

### 2. Ganti Password Default
Setelah login pertama:
1. Login dengan `admin / admin123`
2. Pergi ke **Settings** > **Users**
3. **Ganti password admin**
4. Buat user tambahan jika perlu

### 3. Backup Database
Setup auto-backup via aaPanel:
1. Database > Backup
2. Setup jadwal backup (daily/weekly)
3. Simpan di direktori atau remote storage

---

## 🐛 Troubleshooting

### Port 3000 sudah digunakan
```bash
# Cek port yang digunakan
netstat -tulpn | grep 3000

# Kill process yang menggunakan port
kill -9 PID_NUMBER

# Atau ganti port di .env
nano .env
# Ubah: PORT=3001
```

### Aplikasi tidak bisa akses database
```bash
# Cek koneksi database
mysql -u billing_user -p billing_system

# Cek konfigurasi .env
cat .env

# Restart aplikasi
pm2 restart billing-system
```

### Error saat npm install
```bash
# Clear npm cache
npm cache clean --force

# Install ulang
rm -rf node_modules package-lock.json
npm install --production
```

### PM2 tidak start otomatis setelah reboot
```bash
# Setup ulang PM2 startup
pm2 unstartup systemd
pm2 startup systemd

# Save konfigurasi
pm2 save
```

---

## 📞 Support

Jika ada masalah:
1. Cek logs: `pm2 logs billing-system`
2. Cek status: `pm2 status`
3. Cek konfigurasi: `cat /www/wwwroot/billing/.env`
4. Restart: `pm2 restart billing-system`

---

## ✅ Checklist Setelah Install

- [ ] Aplikasi berjalan: `pm2 status`
- [ ] Bisa diakses via browser
- [ ] Login berhasil dengan user default
- [ ] Password admin sudah diganti
- [ ] Database terkoneksi
- [ ] Nginx reverse proxy berfungsi (jika disetup)
- [ ] SSL berfungsi (jika disetup)
- [ ] PM2 auto-start sudah dikonfigurasi
- [ ] Backup database sudah dijadwalkan
- [ ] Firewall sudah dikonfigurasi

---

**Selamat! Billing System Anda sudah online! 🎉**

Akses aplikasi di:
- Direct: `http://IP-SERVER:3000`
- Via domain: `http://billing.yourdomain.com`
- Via SSL: `https://billing.yourdomain.com`


