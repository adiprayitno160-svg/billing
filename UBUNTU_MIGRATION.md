# Panduan Migrasi Billing System ke Ubuntu Server

Panduan ini menjelaskan langkah-langkah untuk memindahkan aplikasi Billing System dari environment Windows (Laragon) ke server Ubuntu (VPS).

## 1. Persiapan Server Ubuntu

Lakukan instalasi dependencies dasar di server Ubuntu:

```bash
# Update repo
sudo apt update && sudo apt upgrade -y

# Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL Server
sudo apt install mysql-server -y

# Install Puppeteer Dependencies (untuk Print PDF)
sudo apt install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

# Install PM2 (Process Manager)
sudo npm install -g pm2
```

## 2. Transfer Kode & Database

### A. Database
Dumping database dari Windows:
1. Gunakan fitur backup di aplikasi atau run `npm run backup:db`.
2. Salin file `.sql` ke server Ubuntu.
3. Import ke MySQL Ubuntu:
   ```bash
   mysql -u root -p
   CREATE DATABASE billing;
   exit;
   mysql -u root -p billing < backup_file.sql
   ```

### B. Kode Aplikasi
Gunakan Git untuk transfer kode:
```bash
cd /var/www
git clone https://github.com/USERNAME/REPO_NAME.git billing
cd billing
npm install
```

## 3. Konfigurasi Environment (`.env`)

Buat file `.env` di server (salin dari `.env.example`):
```bash
cp .env.example .env
nano .env
```
Sesuaikan:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `PORT` (biasanya 3011)

## 4. Build dan Jalankan Aplikasi

Gunakan skrip deploy yang sudah disediakan:

```bash
# Berikan izin eksekusi
chmod +x deploy-ubuntu.sh
chmod +x fix-permissions.sh

# Build & Start
./deploy-ubuntu.sh
```

## 5. Troubleshooting Umum

### Puppeteer (Chromium) Error
Jika PDF tidak muncul, pastikan `PUPPETEER_EXECUTABLE_PATH` di `ecosystem.config.js` sudah benar. Secara default disetel ke `/snap/chromium/current/chrome` atau `/usr/bin/chromium-browser`.

### Izin Folder (Permissions)
Jika file upload atau logs gagal disimpan:
```bash
./fix-permissions.sh
```

### Database Dump (Backups)
Aplikasi sekarang sudah otomatis mendeteksi path `mysqldump` di Linux (`/usr/bin/mysqldump`). Tidak perlu pengaturan manual di database settings jika menggunakan path standar.

## 6. Integrasi WhatsApp
Hapus folder `whatsapp_auth_v2` jika Anda ingin melakukan Link Device ulang dengan nomor baru di server. Jika ingin memindah sesi yang ada, salin folder `whatsapp_auth_v2` dari Windows ke Linux (pastikan permission folder benar).

---
*Dibuat otomatis oleh AntiGravity - Modern Billing System Migration Suite*
