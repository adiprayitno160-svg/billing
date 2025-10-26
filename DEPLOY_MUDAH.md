# ⚡ DEPLOY KE SERVER - CARA TERMUDAH

## 🎯 3 LANGKAH AJA!

### **STEP 1: Login SSH ke Server**

```bash
ssh root@your-server-ip
# Masukkan password
```

---

### **STEP 2: Clone dari GitHub & Install**

```bash
# Masuk ke folder web
cd /www/wwwroot

# Clone repository (GANTI YOUR_USERNAME!)
git clone https://github.com/YOUR_USERNAME/billing.git
cd billing

# Install Node.js (kalau belum ada)
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt-get install nodejs -y

# Install dependencies
npm install

# Build aplikasi
npm run build
```

---

### **STEP 3: Setup & Jalankan**

```bash
# Buat file .env
nano .env
```

**Copy-paste ini ke .env:**
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=PASSWORD_MYSQL_ANDA
DB_NAME=billing_system
SESSION_SECRET=random-secret-min-32-characters-here
APP_NAME=Billing System
COMPANY_NAME=Your Company
```

**Save:** Ctrl+X → Y → Enter

```bash
# Buat database
mysql -u root -p
# Password MySQL
CREATE DATABASE billing_system;
EXIT;

# Install PM2 & jalankan
npm install -g pm2
pm2 start dist/server.js --name billing
pm2 save
pm2 startup
```

---

## ✅ DONE! Aplikasi Jalan di Port 3000

### **Akses dari Browser:**

```
http://your-server-ip:3000
```

Login: `admin` / `admin`

---

## 🌐 BONUS: Setup Domain (via aaPanel)

1. **Buka aaPanel** di browser
2. **Website** → **Add Site**
   - Domain: `billing.yourdomain.com`
   - PHP: **Static**
3. **Settings** → **Reverse Proxy**
   - Target: `http://127.0.0.1:3000`
   - Enable: ON
4. **SSL** → Let's Encrypt → Apply

**Akses:** https://billing.yourdomain.com

---

## 🔧 Commands Penting

```bash
# Lihat status
pm2 status

# Lihat logs
pm2 logs billing

# Restart
pm2 restart billing

# Update dari GitHub (kalau ada perubahan)
cd /www/wwwroot/billing
git pull
npm install
npm run build
pm2 restart billing
```

---

**SELESAI!** Aplikasi sudah LIVE! 🎉


