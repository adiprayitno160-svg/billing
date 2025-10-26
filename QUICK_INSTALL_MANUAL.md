# ⚡ Quick Install Manual - aaPanel Native

## 🚀 Copy-Paste Commands (10 Menit!)

### 1️⃣ Install Node.js & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install -g pm2
```

---

### 2️⃣ Clone Repository
```bash
cd /www/wwwroot
git clone https://github.com/YOUR-USERNAME/billing.git
cd billing
```

**Ganti `YOUR-USERNAME` dengan username GitHub Anda!**

---

### 3️⃣ Buat Database
```bash
mysql -u root -p << EOF
CREATE DATABASE billing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON billing_system.* TO 'billing_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

**⚠️ Ganti `password123` dengan password kuat!**

---

### 4️⃣ Buat File .env
```bash
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=password123
DB_NAME=billing_system

PORT=3000
NODE_ENV=production
SESSION_SECRET=change-this-to-random-string

HIDE_BILLING_CUSTOMERS_MENU=false
EOF
```

**⚠️ Edit password di atas sesuai yang dibuat!**

```bash
nano .env  # Edit password
```

---

### 5️⃣ Install & Build
```bash
npm install
npm run build
```

---

### 6️⃣ Start Aplikasi
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd
```

**⚠️ Copy-paste command yang muncul setelah `pm2 startup`, lalu jalankan!**

---

### 7️⃣ Verifikasi
```bash
pm2 status
pm2 logs billing-system
```

---

## ✅ Selesai!

**Akses aplikasi:**
```
http://IP-SERVER:3000
```

**Login:**
- Username: `admin`
- Password: `admin123`

---

## 🔄 Update Aplikasi

```bash
cd /www/wwwroot/billing
git pull
npm run build
pm2 restart billing-system
```

---

## 🗑️ Uninstall

```bash
pm2 delete billing-system
rm -rf /www/wwwroot/billing
mysql -u root -p -e "DROP DATABASE billing_system; DROP USER 'billing_user'@'localhost';"
```

---

## 📝 Commands Berguna

```bash
# Status
pm2 status

# Logs
pm2 logs billing-system

# Restart
pm2 restart billing-system

# Stop
pm2 stop billing-system
```

---

## 📚 Dokumentasi Lengkap

Lihat: [INSTALL_AAPANEL_MANUAL.md](INSTALL_AAPANEL_MANUAL.md)

---

**10 menit, done! 🎉**


