# 🚀 Simple Installation Guide (Ubuntu)

Copy-paste perintah di bawah ini baris per baris.

## 1. System & Node.js Setup
```bash
sudo apt update
sudo apt install -y curl git mariadb-server build-essential

# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Global Tools
sudo npm install -g pm2 typescript ts-node
```

## 2. Database Setup
Ganti `password123` dengan password yang aman!
```bash
sudo mysql -u root
```
Di dalam console MySQL, jalankan:
```sql
CREATE DATABASE billing_db;
CREATE USER 'billing'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON billing_db.* TO 'billing'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. Install Aplikasi
```bash
# Buat folder khusus (jika belum ada)
sudo mkdir -p /var/www
cd /var/www

# Download Source Code
sudo git clone https://github.com/adiprayitno160-svg/billing.git
# Ubah permission (opsional jika root)
sudo chown -R $USER:$USER billing
cd billing

# Install Dependencies
npm install
```

## 4. Konfigurasi
```bash
cp .env.example .env
nano .env
```
Update konfigurasi database dan PORT di `.env`:
```ini
PORT=3001    <-- PENTING: Ganti ke 3001 (Port 3000 dipakai GenieACS)
DB_HOST=localhost
DB_USER=billing
DB_PASS=password123
DB_NAME=billing_db
```

## 5. Build & Run
```bash
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 6. Selesai
Akses aplikasi di: `http://IP_SERVER_ANDA:3001`
