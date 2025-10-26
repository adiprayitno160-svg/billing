# 🎯 WORKFLOW DEPLOYMENT: Local → GitHub → Server

## 📋 KONSEP ALUR KERJA

```
┌────────────────────────────────────────────────────────────────┐
│                     WORKFLOW DEPLOYMENT                        │
└────────────────────────────────────────────────────────────────┘

   LOCAL WINDOWS           GITHUB REPO              SERVER AAPANEL
   ─────────────          ────────────              ──────────────
  
┌─────────────┐         ┌──────────────┐         ┌───────────────┐
│             │  PUSH   │              │  PULL   │               │
│   Coding    │ ─────→  │   Storage    │ ←────   │   Production  │
│   + Script  │         │   + Backup   │         │   + PM2       │
│             │         │              │         │               │
└─────────────┘         └──────────────┘         └───────────────┘

    💻 Laptop           ☁️ Cloud Repo            🖥️ VPS Server
```

---

## 📍 STEP-BY-STEP LENGKAP

### 🎬 FASE 1: PERSIAPAN DI LOCAL (Windows)

**Lokasi:** `C:\laragon\www\billing`

#### 1.1. Pastikan Script Automation Ada

```bash
# Cek file-file script yang sudah dibuat:
ls -l *.sh

# Harusnya ada:
# ✅ aapanel-manager.sh      (Main script)
# ✅ quick-install.sh        (One-liner)
# ✅ aapanel-deploy.sh       (Deploy script)
# ✅ auto-update.sh          (Auto-update)
# ✅ health-check.sh         (Health check)
# ✅ install.sh              (General installer)
```

#### 1.2. Pastikan README Ada

```bash
# Cek dokumentasi:
ls -l *.md

# Harusnya ada:
# ✅ README_AUTOMATION.md         (Overview scripts)
# ✅ PANDUAN_LENGKAP_AAPANEL.md  (Tutorial lengkap)
# ✅ WORKFLOW_DEPLOYMENT.md       (File ini)
```

#### 1.3. Test Local (Opsional)

```bash
# Test TypeScript compile
npm run build

# Test server local
npm run dev

# Akses: http://localhost:3000
```

#### 1.4. Push ke GitHub

```bash
# Cek status
git status

# Add semua file
git add .

# Commit dengan message jelas
git commit -m "Add aaPanel automation scripts - full deployment system"

# Push ke GitHub
git push origin main
```

**Output yang benar:**
```
Enumerating objects: 15, done.
Counting objects: 100% (15/15), done.
Delta compression using up to 8 threads
Compressing objects: 100% (10/10), done.
Writing objects: 100% (11/11), 45.23 KiB | 2.26 MiB/s, done.
Total 11 (delta 6), reused 0 (delta 0), pack-reused 0
To https://github.com/adiprayitno160-svg/billing_system.git
   a1b2c3d..e4f5g6h  main -> main
```

---

### ☁️ FASE 2: VERIFIKASI DI GITHUB

#### 2.1. Buka GitHub Repository

```
https://github.com/adiprayitno160-svg/billing_system
```

#### 2.2. Pastikan File-File Ada

Cek di GitHub web:
```
billing_system/
├── aapanel-manager.sh           ✅ Ada
├── quick-install.sh             ✅ Ada
├── auto-update.sh               ✅ Ada
├── health-check.sh              ✅ Ada
├── README_AUTOMATION.md         ✅ Ada
├── PANDUAN_LENGKAP_AAPANEL.md  ✅ Ada
└── WORKFLOW_DEPLOYMENT.md       ✅ Ada
```

#### 2.3. Test Raw URL

Test apakah bisa diakses direct:
```
https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/aapanel-manager.sh
```

Buka di browser, harusnya muncul isi script!

---

### 🖥️ FASE 3: DEPLOY DI SERVER

**Persyaratan Server:**
- ✅ aaPanel sudah terinstall
- ✅ Akses root via SSH
- ✅ Internet connection
- ✅ MySQL/MariaDB running

#### 3.1. Login SSH ke Server

**Cara 1: Via PuTTY (Windows)**
```
Host: IP_SERVER_ANDA
Port: 22
Username: root
Password: ***
```

**Cara 2: Via PowerShell/CMD**
```bash
ssh root@IP_SERVER_ANDA
# Enter password
```

**Cara 3: Via Laragon Terminal**
```bash
ssh root@IP_SERVER_ANDA
```

#### 3.2. Pilih Metode Instalasi

Ada 3 metode, pilih salah satu:

---

### 🚀 METODE A: One-Liner (TERCEPAT!)

**Copy-paste command ini di server:**

```bash
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/quick-install.sh | bash
```

**Atau jika `curl` tidak ada:**

```bash
wget -O - https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/quick-install.sh | bash
```

**Apa yang terjadi:**
1. Download quick-install.sh
2. Otomatis download aapanel-manager.sh
3. Tampilkan menu interaktif
4. Tinggal pilih "1" untuk Full Installation

---

### 🔧 METODE B: Download Manual (LEBIH KONTROL)

```bash
# 1. Download main script
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/aapanel-manager.sh

# 2. Beri permission
chmod +x aapanel-manager.sh

# 3. Jalankan
bash aapanel-manager.sh
```

---

### 📦 METODE C: Clone Repository (UNTUK DEVELOPMENT)

```bash
# 1. Clone repository
cd /www/wwwroot
git clone https://github.com/adiprayitno160-svg/billing_system.git billing

# 2. Masuk ke folder
cd billing

# 3. Jalankan installer
bash aapanel-manager.sh
```

---

## 📺 INTERACTIVE MENU

Setelah script dijalankan, akan muncul menu:

```
╔══════════════════════════════════════════════════════════╗
║           🚀 aaPanel Billing System Manager            ║
║                    Version 2.0.0                        ║
╚══════════════════════════════════════════════════════════╝

MAIN MENU
======================================

  INSTALASI & UPDATE
  1. 🚀 Full Installation          ← PILIH INI!
  2. 🔄 Update Application

  MONITORING
  3. 📊 Show Status
  4. 📜 View Logs

  MANAGEMENT
  5. ⚙️  Manage Application
  6. 💾 Create Backup
  7. ♻️  Restore Backup

  KONFIGURASI
  8. 🌐 Setup Nginx
  9. 🔧 Edit .env

  LAINNYA
  10. 🗑️  Uninstall
  11. ❌ Exit

======================================
Pilih menu (1-11): 1    ← KETIK 1 DAN ENTER
```

---

## ⚙️ PROSES INSTALASI OTOMATIS

Setelah pilih menu "1", script akan otomatis:

```
[1/8] 🔍 Cek Prerequisites...
      ✅ Running sebagai root
      ✅ aaPanel terdeteksi
      ✅ Environment: Native Server

[2/8] 📦 Install Dependencies...
      📥 Updating system packages...
      ✅ Git installed
      ✅ Node.js 18.x LTS installed
      ✅ NPM 9.x installed
      ✅ PM2 5.x installed

[3/8] 📥 Clone dari GitHub...
      📥 Cloning https://github.com/adiprayitno160-svg/billing_system.git
      ✅ Repository cloned
      📁 Location: /www/wwwroot/billing

[4/8] 🗄️  Setup Database...
      📝 MySQL root password: [AUTO DETECTED]
      ✅ Database 'billing_system' created
      ✅ User 'billing_user' created
      🔑 Password generated & saved

[5/8] ⚙️  Konfigurasi Environment...
      ✅ .env file created
      ✅ SESSION_SECRET generated (32 chars)
      ✅ Database credentials saved
      📄 Credentials file: /www/wwwroot/billing/CREDENTIALS.txt

[6/8] 📦 Install NPM Packages...
      ⏳ Installing packages... (ini mungkin 5-10 menit)
      📦 Installing 250+ packages...
      ✅ node_modules/ created (120 MB)
      ✅ All packages installed

[7/8] 🔨 Build Application...
      🏗️  Compiling TypeScript to JavaScript...
      ✅ dist/server.js created
      ✅ dist/ folder ready (15 MB)
      ✅ Build completed successfully

[8/8] 🚀 Start dengan PM2...
      🚀 Starting application...
      ✅ Application started: billing-system
      ✅ PM2 status: online
      ✅ PM2 save successful
      ✅ PM2 startup configured

[OPSIONAL] 🌐 Setup Nginx Reverse Proxy?
      Masukkan domain (atau Enter untuk skip): billing.yourdomain.com
      ✅ Nginx configured
      ✅ Config file: /www/server/panel/vhost/nginx/billing.yourdomain.com.conf
      ✅ Nginx reloaded

╔══════════════════════════════════════════════════════════╗
║            ✅ INSTALLATION COMPLETED!                    ║
╚══════════════════════════════════════════════════════════╝

📋 Application Information:
  🌐 URL        : http://IP_SERVER:3000
  📁 Directory  : /www/wwwroot/billing
  🗄️  Database   : billing_system
  👤 DB User    : billing_user

🔑 Default Login:
  Admin: admin / admin123
  Kasir: kasir / kasir123

⚠️  PENTING:
  1. GANTI password default setelah login!
  2. Credentials tersimpan di: /www/wwwroot/billing/CREDENTIALS.txt
  3. Konfigurasi payment gateway via Settings menu

📝 Useful Commands:
  Status  : pm2 status
  Logs    : pm2 logs billing-system
  Restart : pm2 restart billing-system
  Manager : bash aapanel-manager.sh

Tekan Enter untuk kembali ke menu...
```

---

## ✅ VERIFIKASI INSTALASI

### 1. Cek PM2 Status

```bash
pm2 status
```

**Output yang benar:**
```
┌─────┬────────────────┬─────────┬──────┬──────────┐
│ id  │ name           │ status  │ cpu  │ memory   │
├─────┼────────────────┼─────────┼──────┼──────────┤
│ 0   │ billing-system │ online  │ 0%   │ 85.2 MB  │
└─────┴────────────────┴─────────┴──────┴──────────┘
```

### 2. Cek Logs

```bash
pm2 logs billing-system --lines 20
```

**Output yang benar:**
```
0|billing  | Server running on port 3000
0|billing  | Environment: production
0|billing  | Database connected successfully
0|billing  | All routes loaded
```

### 3. Test HTTP Response

```bash
curl -I http://localhost:3000
```

**Output yang benar:**
```
HTTP/1.1 302 Found
Location: /login
...
```

### 4. Test dari Browser

Buka browser dan akses:
```
http://IP_SERVER:3000
```

**Harus muncul halaman login!**

---

## 🌐 SETUP DOMAIN & SSL (OPSIONAL)

### Via aaPanel Web Interface

#### 1. Login aaPanel
```
http://IP_SERVER:7800
```

#### 2. Add Website
- **Website** → **Add Site**
- Domain: `billing.yourdomain.com`
- PHP: **Static** (bukan PHP!)
- Submit

#### 3. Setup Reverse Proxy
- Klik domain → **Settings**
- Tab **Reverse Proxy**
- Add Proxy:
  - Name: `billing`
  - Target: `http://127.0.0.1:3000`
  - Enable: ON
- Submit

#### 4. Setup SSL
- Tab **SSL**
- Pilih **Let's Encrypt**
- Email: your@email.com
- Apply

**SELESAI! Akses:**
```
https://billing.yourdomain.com
```

---

## 🔄 UPDATE APLIKASI

### Setelah Ada Perubahan di Local:

#### 1. Push Update ke GitHub

```bash
# Di local Windows
cd C:\laragon\www\billing

git add .
git commit -m "Update: fitur baru xyz"
git push origin main
```

#### 2. Update di Server

**Option A: Via Menu (Mudah)**
```bash
# Di server
bash aapanel-manager.sh
# Pilih: 2. Update Application
```

**Option B: Manual**
```bash
cd /www/wwwroot/billing
git pull origin main
npm install
npm run build
pm2 restart billing-system
```

**Option C: Otomatis (via Cron)**
```bash
# Setup cron job (update setiap hari jam 2 pagi)
crontab -e

# Tambahkan:
0 2 * * * /www/wwwroot/billing/auto-update.sh >> /var/log/billing-update.log 2>&1
```

---

## 📊 MONITORING & MAINTENANCE

### Setup Health Check

```bash
# Copy script
cp /www/wwwroot/billing/health-check.sh /usr/local/bin/
chmod +x /usr/local/bin/health-check.sh

# Setup cron (check setiap 5 menit)
crontab -e

# Tambahkan:
*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/billing-health.log 2>&1
```

### Setup Auto-Backup

```bash
# Via menu
bash aapanel-manager.sh
# Pilih: 6. Create Backup

# Setup cron (backup setiap hari jam 3 pagi)
crontab -e

# Tambahkan:
0 3 * * * cd /www/wwwroot/billing && tar -czf /www/backup/billing_$(date +\%Y\%m\%d).tar.gz --exclude=node_modules --exclude=.git .
```

### View Logs

```bash
# Application logs
pm2 logs billing-system

# Auto-update logs
tail -f /var/log/billing-update.log

# Health check logs
tail -f /var/log/billing-health.log
```

---

## 🎯 RINGKASAN WORKFLOW

### Workflow Sehari-hari:

```
DEVELOPMENT (Local)
├─ Coding perubahan
├─ Test local (npm run dev)
├─ git commit & push
└─ ✅ Push to GitHub

GITHUB (Automatic)
├─ Receive push
├─ Store code
└─ ✅ Ready to pull

PRODUCTION (Server)
├─ Auto-update (cron jam 2 pagi)
│  ├─ git pull
│  ├─ npm install
│  ├─ npm run build
│  └─ pm2 restart
├─ Health check (setiap 5 menit)
│  ├─ Check PM2 status
│  ├─ Check HTTP response
│  ├─ Check database
│  └─ Auto-restart if down
└─ Auto-backup (cron jam 3 pagi)
   └─ ✅ System running 24/7
```

---

## 🛠️ TROUBLESHOOTING

### Problem: Script tidak bisa didownload

**Error:**
```
curl: (6) Could not resolve host
```

**Solusi:**
```bash
# Cek koneksi internet
ping google.com

# Cek DNS
echo "nameserver 8.8.8.8" >> /etc/resolv.conf

# Atau clone manual
git clone https://github.com/adiprayitno160-svg/billing_system.git
cd billing_system
bash aapanel-manager.sh
```

### Problem: Permission denied

**Error:**
```
bash: ./aapanel-manager.sh: Permission denied
```

**Solusi:**
```bash
chmod +x aapanel-manager.sh
bash aapanel-manager.sh

# Atau run dengan bash
bash aapanel-manager.sh
```

### Problem: Port 3000 sudah digunakan

**Error:**
```
Error: listen EADDRINUSE :::3000
```

**Solusi:**
```bash
# Cek apa yang menggunakan port
netstat -tulpn | grep 3000

# Kill process
kill -9 PID

# Atau ganti port
export APP_PORT=3001
bash aapanel-manager.sh
```

---

## ✅ CHECKLIST DEPLOYMENT

### Pre-Deployment:
- [ ] Code sudah tested di local
- [ ] All changes committed
- [ ] Pushed to GitHub
- [ ] GitHub repository accessible
- [ ] Server dengan aaPanel ready
- [ ] SSH access ke server
- [ ] MySQL/MariaDB running

### During Deployment:
- [ ] Login SSH ke server
- [ ] Run installer script
- [ ] Pilih Full Installation
- [ ] Wait for completion (10-15 menit)
- [ ] Note credentials dari output

### Post-Deployment:
- [ ] Test akses http://IP:3000
- [ ] Login dengan default credentials
- [ ] Ganti password admin
- [ ] Ganti password kasir
- [ ] Setup domain & SSL (opsional)
- [ ] Setup auto-update cron
- [ ] Setup health-check cron
- [ ] Setup backup cron
- [ ] Configure payment gateway
- [ ] Test semua fitur utama

---

## 🎉 SELESAI!

Workflow deployment Anda sudah siap:

1. **Local:** Coding → Commit → Push
2. **GitHub:** Store & Version Control
3. **Server:** Auto Pull & Deploy

**Sistem berjalan otomatis dengan:**
- ✅ Auto-update (setiap hari jam 2 pagi)
- ✅ Health check (setiap 5 menit)
- ✅ Auto-restart jika down
- ✅ Auto-backup (setiap hari jam 3 pagi)
- ✅ Telegram notification (opsional)

**Happy Deploying! 🚀**

---

*Dokumentasi: WORKFLOW_DEPLOYMENT.md*  
*Version: 2.0.0*  
*Repository: https://github.com/adiprayitno160-svg/billing_system*  
*Last Updated: $(date)*

