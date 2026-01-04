# 🐧 Panduan Instalasi di Ubuntu Server 20.04 / 22.04 LTS

Panduan ini akan membantu Anda men-deploy sistem Billing ini ke server Ubuntu production menggunakan Nginx sebagai reverse proxy dan PM2 sebagai process manager.

## 📋 Prasyarat
- Server Ubuntu 20.04 atau 22.04 (Fresh Install direkomendasikan).
- Akses Root / Sudo.
- Domain yang sudah diarahkan ke IP Server (untuk SSL).

## 🚀 Langkah 1: Update & Install Dependencies Dasar

Update server dan install tool dasar:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential nginx
```

## 📦 Langkah 2: Install Node.js (v18/v20)

Kami merekomendasikan Node.js v18 LTS atau v20 LTS.

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi instalasi
node -v
npm -v
```

## 🗄️ Langkah 3: Install & Setup Database (MariaDB/MySQL)

```bash
sudo apt install -y mariadb-server

# Jalankan security script
sudo mysql_secure_installation
# Jawab 'Y' untuk semua pertanyaan, set root password yang kuat.
```

Buat database dan user untuk aplikasi:

```bash
sudo mysql -u root -p
```

Di dalam console MySQL jalankan query berikut (ganti `password_db_anda` dengan password yang aman):

```sql
CREATE DATABASE billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'password_db_anda';
GRANT ALL PRIVILEGES ON billing_db.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 📥 Langkah 4: Clone & Setup Aplikasi

Clone repository ke folder `/var/www` (atau folder home user Anda):

```bash
cd /var/www
sudo git clone https://github.com/username-anda/billing.git billing-app
# Ganti URL repo dengan URL GitHub Anda yang sebenarnya

cd billing-app

# Ubah permission owner ke user saat ini (misal: ubuntu)
sudo chown -R $USER:$USER /var/www/billing-app
```

Install dependencies:

```bash
npm install
npm install -g pm2 typescript ts-node
```

## ⚙️ Langkah 5: Konfigurasi Environment

Copy file contoh konfigurasi dan edit:

```bash
cp .env.example .env
nano .env
```

Sesuaikan konfigurasi penting di `.env`:
```ini
NODE_ENV=production
PORT=3001  <-- PENTING: Ganti ke 3001 (GenieACS pakai 3000)
DB_HOST=localhost
DB_USER=billing_user
DB_PASS=password_db_anda
DB_NAME=billing_db
APP_URL=https://billing.domainanda.com
```

## 🏗️ Langkah 6: Build & Database Migration

Build aplikasi TypeScript ke JavaScript:

```bash
npm run build
```

Jalankan migrasi database (pastikan `.env` sudah benar):

```bash
# Jika Anda punya script migrasi khusus
npm run migrate 
# ATAU import manual file SQL jika ada di folder migrations
mysql -u billing_user -p billing_db < database_schema.sql 
```

## 🤖 Langkah 7: Setup PM2 (Process Manager)

Jalankan aplikasi dengan PM2 agar tetap hidup di background:

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
# Copy paste command yang dihasilkan oleh 'pm2 startup' untuk enable autostart saat boot
```

## 🌐 Langkah 8: Setup Nginx Reverse Proxy

Buat file konfigurasi Nginx baru:

```bash
sudo nano /etc/nginx/sites-available/billing
```

Isi dengan konfigurasi berikut (ganti `billing.domainanda.com` dengan domain Anda):

```nginx
server {
    server_name billing.domainanda.com;

    location / {
        proxy_pass http://localhost:3001; # Port 3001
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Optional: Tambahkan max upload size jika perlu
    client_max_body_size 10M;
}
```

Aktifkan konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/billing /etc/nginx/sites-enabled/
sudo nginx -t # Test konfigurasi, pastikan OK
sudo systemctl restart nginx
```

## 🔒 Langkah 9: Setup SSL (HTTPS) dengan Certbot

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Request sertifikat SSL gratis:

```bash
sudo certbot --nginx -d billing.domainanda.com
```
Ikuti instruksi di layar. Pilih opsi untuk **Redirect** HTTP ke HTTPS.

## ✅ Selesai!

Akses billing Anda di `https://billing.domainanda.com`.

### 🔄 Cara Update Aplikasi

Untuk mengupdate aplikasi di kemudian hari:

```bash
cd /var/www/billing-app
git pull origin main
npm install
npm run build
pm2 reload billing-app
```
