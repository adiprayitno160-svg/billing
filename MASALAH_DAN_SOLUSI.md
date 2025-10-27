# 🐛 Daftar Masalah & Solusi - Billing System

Hasil audit project dan fix yang sudah dilakukan.

---

## ❌ MASALAH CRITICAL YANG DITEMUKAN

### 1. **Database Name Mismatch** 🔴 CRITICAL

**Masalah:**
- File `billing.sql` create database: `billing`
- Script `install.sh` menggunakan: `billing_system`
- README menyebut: `billing_system`
- Error log: `Table 'billing_system.users' doesn't exist`

**Penyebab:**
Inconsistency database name antara SQL file dan dokumentasi/script.

**Solusi:**
✅ **FIXED** - Pakai database name: `billing` (sesuai SQL file)

**File yang sudah diperbaiki:**
- `install-fixed.sh` - Line 19
- `env.example` - Line 14
- `SETUP_NATIVE_COMPLETE.md`

**Yang harus Anda lakukan:**
```env
# Di file .env
DB_NAME=billing  # BUKAN billing_system
```

---

### 2. **Node.js Version Requirement Salah** 🔴 CRITICAL

**Masalah:**
- README says: "Node.js v16+"
- Package uses: `@types/node@24.9.1`, `express@5.1.0`, `typescript@5.9.3`
- Node.js v16 sudah EOL (End of Life)
- Akan error dengan dependencies terbaru

**Penyebab:**
Package.json menggunakan dependencies yang butuh Node.js v18+

**Solusi:**
✅ **FIXED** - Minimal Node.js v18, recommended v20 LTS

**File yang sudah diperbaiki:**
- `install-fixed.sh` - Line 19 (NODE_VERSION="20")
- `SETUP_NATIVE_COMPLETE.md`

**Yang harus Anda lakukan:**
```bash
# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

### 3. **Missing .env.example File** 🟡 HIGH

**Masalah:**
- Project tidak punya `.env.example`
- User bingung konfigurasi apa yang diperlukan
- Tidak ada template untuk copy

**Solusi:**
✅ **FIXED** - Created `env.example` dengan semua variable yang diperlukan

**File yang dibuat:**
- `env.example`

**Yang harus Anda lakukan:**
```bash
# Copy template
cp env.example .env

# Edit sesuai environment Anda
nano .env
```

---

### 4. **WhatsApp Library Butuh System Dependencies** 🟡 HIGH

**Masalah:**
- Error: `libnss3.so: cannot open shared object file`
- WhatsApp-web.js pakai Puppeteer/Chromium
- Butuh banyak library system yang tidak auto-install

**Penyebab:**
Puppeteer butuh Chrome/Chromium libraries

**Solusi:**
✅ **FIXED** - Ditambahkan di script install

**Ubuntu/Debian:**
```bash
sudo apt install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libgbm1 \
    libxss1 \
    libgtk-3-0 \
    libasound2
```

**CentOS:**
```bash
sudo yum install -y \
    nss \
    atk \
    libXrandr \
    gtk3 \
    alsa-lib
```

---

### 5. **Migration Files Tidak Clear** 🟡 MEDIUM

**Masalah:**
- Ada folder `migrations/` tapi tidak jelas kapan harus dijalankan
- Tidak ada instruksi di dokumentasi
- File `create_system_settings.sql` terpisah dari main SQL

**Solusi:**
✅ **FIXED** - Dijelaskan di SETUP_NATIVE_COMPLETE.md

**Yang harus Anda lakukan:**
Jika pakai `billing.sql` langsung, migration tidak perlu dijalankan.
Jika butuh, jalankan:
```bash
mysql -u billing_user -p billing < migrations/create_system_settings.sql
```

---

### 6. **Install Script Database Name Salah** 🔴 CRITICAL

**Masalah:**
File `install.sh` line 22:
```bash
DB_NAME="billing_system"  # SALAH!
```

**Solusi:**
✅ **FIXED** - Created `install-fixed.sh` dengan DB_NAME="billing"

**Yang harus Anda lakukan:**
```bash
# Gunakan script yang sudah diperbaiki
sudo bash install-fixed.sh
```

---

### 7. **Dokumentasi Inconsistent** 🟡 MEDIUM

**Masalah:**
- README says DB: `billing_system`
- SQL creates DB: `billing`
- INSTALL_NATIVE.md tidak detail error handling

**Solusi:**
✅ **FIXED** - Created `SETUP_NATIVE_COMPLETE.md` dengan:
- Troubleshooting section lengkap
- Step-by-step yang benar
- Error handling untuk setiap step
- Database name yang konsisten

---

## ✅ FILE-FILE BARU YANG SUDAH DIBUAT

### 1. `SETUP_NATIVE_COMPLETE.md`
Panduan instalasi native lengkap dengan:
- ✅ Database name yang benar
- ✅ Node.js v20
- ✅ WhatsApp dependencies
- ✅ Troubleshooting lengkap
- ✅ Security checklist
- ✅ Backup automation

### 2. `install-fixed.sh`
Script instalasi otomatis yang sudah diperbaiki:
- ✅ DB_NAME=billing (bukan billing_system)
- ✅ Node.js v20 (bukan v18)
- ✅ WhatsApp/Chromium dependencies
- ✅ Better error handling
- ✅ Auto-generate secure passwords
- ✅ PM2 setup otomatis

### 3. `env.example`
Template environment variables:
- ✅ Semua variable yang diperlukan
- ✅ Comments untuk setiap section
- ✅ Default values
- ✅ Security notes

### 4. `MASALAH_DAN_SOLUSI.md` (file ini)
Dokumentasi masalah dan solusi

---

## 🚀 CARA INSTALL YANG BENAR

### **Opsi 1: Auto Install (Recommended)**

```bash
# Download script yang sudah diperbaiki
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-fixed.sh

# Jalankan
sudo bash install-fixed.sh
```

### **Opsi 2: Manual Install**

Follow panduan lengkap di: `SETUP_NATIVE_COMPLETE.md`

**Ringkasan steps:**
```bash
# 1. Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install dependencies WhatsApp
sudo apt install -y libnss3 libatk-bridge2.0-0 libgbm1

# 3. Install MySQL
sudo apt install -y mysql-server

# 4. Setup database (PENTING: nama billing, bukan billing_system)
sudo mysql -e "CREATE DATABASE billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'billing_user'@'localhost' IDENTIFIED BY 'password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON billing.* TO 'billing_user'@'localhost';"

# 5. Clone & Install
git clone https://github.com/adiprayitno160-svg/billing.git
cd billing
npm install

# 6. Configure .env (PENTING: DB_NAME=billing)
cp env.example .env
nano .env  # Edit DB_NAME=billing

# 7. Import database
mysql -u billing_user -p billing < billing.sql

# 8. Build & Run
npm run build
pm2 start ecosystem.config.js --env production
```

---

## 🐛 TROUBLESHOOTING COMMON ERRORS

### Error: "Table doesn't exist"
**Penyebab:** Database name salah di .env

**Solusi:**
```bash
# Check .env
cat .env | grep DB_NAME
# Harus: DB_NAME=billing

# Re-import jika perlu
mysql -u billing_user -p billing < billing.sql
```

### Error: "Cannot find module"
**Penyebab:** Dependencies tidak lengkap

**Solusi:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Error: "libnss3.so: cannot open shared object"
**Penyebab:** Library WhatsApp belum terinstall

**Solusi:**
```bash
sudo apt install -y libnss3 libatk-bridge2.0-0 libgbm1
pm2 restart billing-system
```

### Error: "Port 3000 already in use"
**Solusi:**
```bash
# Option 1: Kill process
sudo lsof -i :3000
sudo kill -9 PID

# Option 2: Ganti port
nano .env  # PORT=3001
pm2 restart billing-system
```

---

## 📋 CHECKLIST SEBELUM INSTALL

Sebelum install, pastikan:

- [ ] Server Ubuntu 20.04+ / Debian 10+
- [ ] RAM minimal 2GB (recommended 4GB)
- [ ] Root/sudo access
- [ ] Port 3000 belum dipakai
- [ ] Koneksi internet stabil
- [ ] Sudah backup data jika re-install

---

## 📋 CHECKLIST SETELAH INSTALL

Setelah install, verify:

- [ ] PM2 status: `pm2 status` (harus "online")
- [ ] Akses web: `http://SERVER_IP:3000`
- [ ] Login berhasil (admin/admin123)
- [ ] Database connected (check dashboard)
- [ ] Ganti password default
- [ ] Configure MikroTik (jika ada)
- [ ] Setup backup otomatis

---

## 🔐 SECURITY CHECKLIST

- [ ] Ganti password admin default
- [ ] Ganti SESSION_SECRET di .env
- [ ] Setup firewall (UFW)
- [ ] Disable root SSH login
- [ ] Setup fail2ban
- [ ] Enable HTTPS/SSL
- [ ] Regular backup database
- [ ] Update system rutin

---

## 📞 NEXT STEPS

1. **Test instalasi:**
   ```bash
   curl http://localhost:3000
   ```

2. **Check logs jika error:**
   ```bash
   pm2 logs billing-system
   ```

3. **Configure via dashboard:**
   - MikroTik connection
   - Company information
   - Payment gateway (optional)
   - Telegram bot (optional)

4. **Setup backup:**
   ```bash
   # Follow backup section di SETUP_NATIVE_COMPLETE.md
   ```

---

## 📚 DOKUMENTASI

- **Panduan lengkap:** `SETUP_NATIVE_COMPLETE.md`
- **Script install:** `install-fixed.sh`
- **Config template:** `env.example`
- **Troubleshooting:** File ini (MASALAH_DAN_SOLUSI.md)

---

## ✅ SUMMARY

**Masalah utama yang sudah diperbaiki:**
1. ✅ Database name: `billing` (bukan `billing_system`)
2. ✅ Node.js requirement: v20 LTS (bukan v16)
3. ✅ WhatsApp dependencies ditambahkan
4. ✅ .env.example file dibuat
5. ✅ Install script diperbaiki
6. ✅ Dokumentasi lengkap dibuat

**File yang perlu Anda gunakan:**
- `install-fixed.sh` - Auto install
- `SETUP_NATIVE_COMPLETE.md` - Manual install
- `env.example` - Configuration template
- `MASALAH_DAN_SOLUSI.md` - Troubleshooting guide

**Database name yang benar:**
```
billing  (BUKAN billing_system)
```

**Node.js version yang benar:**
```
v20.x LTS  (BUKAN v16)
```

---

🎉 **Project sudah siap untuk di-install dengan benar!**

Gunakan `install-fixed.sh` untuk instalasi otomatis atau ikuti `SETUP_NATIVE_COMPLETE.md` untuk manual.


