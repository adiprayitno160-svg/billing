# 🚀 PANDUAN LENGKAP: Deploy Billing System ke aaPanel

## 📋 KONSEP & ALUR KERJA

### ✅ YA! Script Otomatis Deploy ke aaPanel

Script yang sudah dibuat akan **OTOMATIS**:
1. ✅ Install semua dependencies (Node.js, PM2, dll)
2. ✅ Clone aplikasi dari GitHub
3. ✅ Setup database MySQL
4. ✅ Generate konfigurasi (.env)
5. ✅ Build & compile aplikasi
6. ✅ Start dengan PM2 (auto-restart)
7. ✅ Setup Nginx reverse proxy (opsional)

---

## 🎯 ALUR KERJA LENGKAP

```
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: Di Local Windows (C:\laragon\www\billing)          │
├──────────────────────────────────────────────────────────────┤
│  • Script automation sudah dibuat                            │
│  • Push semua ke GitHub                                      │
│                                                               │
│  Commands:                                                    │
│  git add .                                                    │
│  git commit -m "Add aaPanel automation scripts"              │
│  git push origin main                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: Script Tersimpan di GitHub                          │
├──────────────────────────────────────────────────────────────┤
│  URL: https://github.com/adiprayitno160-svg/billing_system  │
│                                                               │
│  📁 Files:                                                    │
│  ├── aapanel-manager.sh      (Menu utama all-in-one)        │
│  ├── quick-install.sh        (One-liner installer)          │
│  ├── auto-update.sh          (Auto-update dari GitHub)      │
│  ├── health-check.sh         (Monitoring & health check)    │
│  └── install.sh              (General installer)            │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: Login ke Server aaPanel                             │
├──────────────────────────────────────────────────────────────┤
│  ssh root@IP_SERVER_ANDA                                     │
│                                                               │
│  Pastikan aaPanel sudah terinstall!                          │
│  Cek: http://IP_SERVER:7800                                  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 4: Pilih Metode Instalasi                              │
└──────────────────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────────┐    ┌────────────────────┐
│  METODE 1         │    │  METODE 2          │
│  One-Liner        │    │  Manual Download   │
│  (Tercepat!)      │    │  (Lebih Kontrol)   │
└───────────────────┘    └────────────────────┘
```

---

## 🚀 METODE 1: One-Liner Install (TERCEPAT!)

### Langkah-Langkah:

**1. Login SSH ke Server**
```bash
ssh root@IP_SERVER_ANDA
```

**2. Jalankan One-Liner Command**
```bash
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/quick-install.sh | bash
```

**3. SELESAI!** 
Script akan otomatis:
- Download installer
- Tampilkan menu interaktif
- Tinggal pilih "1" untuk Full Installation

---

## 🔧 METODE 2: Manual Download & Run

### Langkah-Langkah:

**1. Login SSH ke Server**
```bash
ssh root@IP_SERVER_ANDA
```

**2. Download Script**
```bash
# Download main manager
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/aapanel-manager.sh

# Atau download semua scripts
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/aapanel-manager.sh
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/auto-update.sh
wget https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/health-check.sh
```

**3. Beri Permission Execute**
```bash
chmod +x aapanel-manager.sh
chmod +x auto-update.sh
chmod +x health-check.sh
```

**4. Jalankan Installer**
```bash
bash aapanel-manager.sh
```

---

## 📺 MENU INTERAKTIF aaPanel Manager

Setelah script dijalankan, akan muncul menu seperti ini:

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║           🚀 aaPanel Billing System Manager            ║
║                    Version 2.0.0                        ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

MAIN MENU
======================================

  INSTALASI & UPDATE
  1. 🚀 Full Installation
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
Pilih menu (1-11): _
```

---

## 🎬 PROSES INSTALASI (Pilih Menu 1)

### Yang Akan Terjadi Otomatis:

```
[1/8] 🔍 Cek Prerequisites...
      ✅ Running sebagai root
      ✅ aaPanel terdeteksi
      ✅ Environment: Native Server

[2/8] 📦 Install Dependencies...
      ✅ Git installed
      ✅ Node.js 18.x installed
      ✅ NPM 9.x installed
      ✅ PM2 installed

[3/8] 📥 Clone dari GitHub...
      ✅ Repository cloned
      📁 Location: /www/wwwroot/billing

[4/8] 🗄️  Setup Database...
      ✅ Database 'billing_system' created
      ✅ User 'billing_user' created
      🔑 Credentials saved

[5/8] ⚙️  Konfigurasi Environment...
      ✅ .env file created
      ✅ SESSION_SECRET generated

[6/8] 📦 Install NPM Packages...
      ⏳ Installing... (5-10 menit)
      ✅ 250+ packages installed

[7/8] 🔨 Build Application...
      ✅ TypeScript compiled
      ✅ dist/ folder created

[8/8] 🚀 Start dengan PM2...
      ✅ Application started
      ✅ PM2 auto-restart configured

[OPSIONAL] 🌐 Setup Nginx?
      Masukkan domain: billing.yourdomain.com
      ✅ Nginx configured
      ✅ Reverse proxy active
```

---

## ✅ HASIL INSTALASI

### Setelah Selesai:

```
╔══════════════════════════════════════════════════════════╗
║                 INSTALLATION COMPLETE!                    ║
╚══════════════════════════════════════════════════════════╝

📋 Application Information:
  🌐 URL        : http://YOUR_IP:3000
  📁 Directory  : /www/wwwroot/billing
  🗄️  Database   : billing_system

🔑 Default Login:
  Admin: admin / admin123
  Kasir: kasir / kasir123

⚠️  PENTING:
  1. GANTI password default setelah login!
  2. Simpan credentials di: /www/wwwroot/billing/CREDENTIALS.txt
  3. Konfigurasi payment gateway via Settings

📝 Useful Commands:
  Status  : pm2 status
  Logs    : pm2 logs billing-system
  Restart : pm2 restart billing-system
```

---

## 🔍 CARA CEK APLIKASI RUNNING

### 1. Cek Status PM2
```bash
pm2 status
```

Output yang benar:
```
┌─────┬────────────────┬─────────┬──────┐
│ id  │ name           │ status  │ cpu  │
├─────┼────────────────┼─────────┼──────┤
│ 0   │ billing-system │ online  │ 0%   │
└─────┴────────────────┴─────────┴──────┘
```

### 2. Cek Logs
```bash
pm2 logs billing-system --lines 20
```

### 3. Test dari Browser
```
http://IP_SERVER:3000
```

Harus muncul halaman login!

---

## 🔄 UPDATE APLIKASI

### Cara Update ke Versi Terbaru:

**Option 1: Via Menu (Mudah)**
```bash
bash aapanel-manager.sh
# Pilih: 2. Update Application
```

**Option 2: Manual**
```bash
cd /www/wwwroot/billing
git pull origin main
npm install
npm run build
pm2 restart billing-system
```

**Option 3: Auto Update (Cron)**
```bash
# Setup auto-update setiap hari jam 2 pagi
crontab -e

# Tambahkan baris ini:
0 2 * * * /www/wwwroot/billing/auto-update.sh >> /var/log/billing-update.log 2>&1
```

---

## 🌐 SETUP DOMAIN & SSL

### 1. Setup Nginx via aaPanel (Web UI)

**Metode A: Via aaPanel Dashboard**
1. Login ke aaPanel: `http://IP_SERVER:7800`
2. **Website** → **Add Site**
3. Isi:
   - Domain: `billing.yourdomain.com`
   - PHP Version: **Static** (bukan PHP!)
   - Root: `/www/wwwroot/billing`
4. Klik **Submit**

**Metode B: Via Script Menu**
```bash
bash aapanel-manager.sh
# Pilih: 8. Setup Nginx
# Masukkan domain Anda
```

### 2. Configure Reverse Proxy

Di aaPanel:
1. Klik domain yang baru dibuat
2. **Settings** → **Reverse Proxy**
3. Tambah proxy:
   - Proxy Name: `billing`
   - Target URL: `http://127.0.0.1:3000`
   - Enable: ON
4. Klik **Submit**

### 3. Setup SSL Certificate (HTTPS)

Di aaPanel:
1. **Settings** → **SSL**
2. Pilih **Let's Encrypt**
3. Isi email Anda
4. Klik **Apply**
5. Tunggu 1-2 menit

**SELESAI!** Aplikasi bisa diakses:
```
https://billing.yourdomain.com
```

---

## 💾 BACKUP & RESTORE

### Membuat Backup

**Via Menu:**
```bash
bash aapanel-manager.sh
# Pilih: 6. Create Backup
```

**Manual:**
```bash
# Backup files
tar -czf billing_backup_$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  /www/wwwroot/billing

# Backup database
mysqldump -u root -p billing_system > billing_db_$(date +%Y%m%d).sql
gzip billing_db_$(date +%Y%m%d).sql
```

### Restore Backup

**Via Menu:**
```bash
bash aapanel-manager.sh
# Pilih: 7. Restore Backup
# Pilih file backup yang ingin di-restore
```

---

## 🔧 PERINTAH-PERINTAH BERGUNA

### PM2 Commands
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

# Hapus dari PM2
pm2 delete billing-system

# Monitoring real-time
pm2 monit
```

### Git Commands
```bash
# Cek status
cd /www/wwwroot/billing
git status

# Pull update terbaru
git pull origin main

# Cek branch
git branch

# Cek log commits
git log --oneline -10
```

### Database Commands
```bash
# Login MySQL
mysql -u root -p

# Gunakan database
USE billing_system;

# Lihat tables
SHOW TABLES;

# Cek jumlah customers
SELECT COUNT(*) FROM customers;

# Export database
mysqldump -u root -p billing_system > backup.sql

# Import database
mysql -u root -p billing_system < backup.sql
```

### System Commands
```bash
# Cek port yang digunakan
netstat -tulpn | grep 3000

# Cek resource usage
htop  # atau: top

# Cek disk space
df -h

# Cek memory
free -h

# Cek proses Node.js
ps aux | grep node
```

---

## 🐛 TROUBLESHOOTING

### Problem 1: Port 3000 Sudah Digunakan

**Gejala:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solusi:**
```bash
# Cek apa yang menggunakan port 3000
netstat -tulpn | grep 3000

# Kill process (ganti PID dengan nomor yang muncul)
kill -9 PID

# Atau ganti port di .env
nano /www/wwwroot/billing/.env
# Ubah: PORT=3001
```

### Problem 2: Database Connection Error

**Gejala:**
```
Error: Access denied for user 'billing_user'@'localhost'
```

**Solusi:**
```bash
# Test koneksi
mysql -u billing_user -p

# Jika gagal, reset password
mysql -u root -p
> ALTER USER 'billing_user'@'localhost' IDENTIFIED BY 'new_password';
> FLUSH PRIVILEGES;

# Update .env
nano /www/wwwroot/billing/.env
# Sesuaikan DB_PASSWORD
```

### Problem 3: PM2 Tidak Auto-Start Setelah Reboot

**Solusi:**
```bash
# Setup ulang PM2 startup
pm2 unstartup systemd
pm2 startup systemd

# Copy-paste command yang muncul
# Contoh: sudo env PATH=...

# Save PM2 list
pm2 save
```

### Problem 4: Nginx 502 Bad Gateway

**Gejala:**
Browser menunjukkan "502 Bad Gateway"

**Solusi:**
```bash
# 1. Cek apakah aplikasi running
pm2 status

# 2. Jika mati, start ulang
pm2 restart billing-system

# 3. Cek logs error
pm2 logs billing-system --err

# 4. Test direct access
curl http://localhost:3000

# 5. Cek Nginx config
nginx -t

# 6. Restart Nginx
/etc/init.d/nginx restart
```

### Problem 5: Build Error

**Gejala:**
```
npm run build gagal dengan error TypeScript
```

**Solusi:**
```bash
cd /www/wwwroot/billing

# Clear cache
rm -rf node_modules dist

# Install ulang
npm install

# Build ulang
npm run build

# Jika masih error, cek logs
cat /tmp/npm_build.log
```

### Problem 6: Out of Memory

**Gejala:**
```
JavaScript heap out of memory
```

**Solusi:**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Build ulang
npm run build

# Atau tambahkan ke ecosystem.config.js
node_args: "--max-old-space-size=4096"
```

---

## 📊 MONITORING & MAINTENANCE

### Setup Health Check

```bash
# Copy health check script
cp health-check.sh /usr/local/bin/
chmod +x /usr/local/bin/health-check.sh

# Setup cron untuk health check setiap 5 menit
crontab -e

# Tambahkan:
*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/billing-health.log 2>&1
```

### Setup Auto Update

```bash
# Copy auto-update script
cp auto-update.sh /www/wwwroot/billing/
chmod +x /www/wwwroot/billing/auto-update.sh

# Setup cron untuk update setiap hari jam 2 pagi
crontab -e

# Tambahkan:
0 2 * * * /www/wwwroot/billing/auto-update.sh >> /var/log/billing-update.log 2>&1
```

### View Logs

```bash
# Application logs
pm2 logs billing-system

# Update logs
tail -f /var/log/billing-update.log

# Health check logs
tail -f /var/log/billing-health.log

# Nginx access logs
tail -f /www/wwwlogs/billing.yourdomain.com.log

# Nginx error logs
tail -f /www/wwwlogs/billing.yourdomain.com.error.log
```

---

## 🔒 SECURITY CHECKLIST

### Setelah Instalasi:

- [ ] ✅ Ganti password admin default
- [ ] ✅ Ganti password kasir default  
- [ ] ✅ Update SESSION_SECRET di .env
- [ ] ✅ Ganti password database
- [ ] ✅ Setup firewall (UFW/Firewalld)
- [ ] ✅ Setup SSL certificate
- [ ] ✅ Disable root SSH login
- [ ] ✅ Setup backup otomatis
- [ ] ✅ Enable fail2ban
- [ ] ✅ Update sistem secara berkala

### Firewall Setup

```bash
# Ubuntu/Debian (UFW)
ufw enable
ufw allow 22         # SSH
ufw allow 80         # HTTP
ufw allow 443        # HTTPS
ufw allow 7800       # aaPanel
ufw status

# CentOS/RHEL (Firewalld)
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=7800/tcp
firewall-cmd --reload
firewall-cmd --list-all
```

---

## 🎓 FAQ (Frequently Asked Questions)

### Q: Apakah harus push ke GitHub dulu?
**A:** Ya! Script akan clone dari GitHub repo Anda:
```
https://github.com/adiprayitno160-svg/billing_system
```

### Q: Berapa lama proses instalasi?
**A:** Sekitar 10-15 menit tergantung kecepatan server dan internet.

### Q: Apakah bisa untuk repository private?
**A:** Ya! Setup SSH key dulu:
```bash
ssh-keygen -t rsa -b 4096 -C "deploy"
cat ~/.ssh/id_rsa.pub
# Copy key tersebut ke GitHub Settings > SSH Keys
```

### Q: Bagaimana cara uninstall?
**A:** 
```bash
bash aapanel-manager.sh
# Pilih: 10. Uninstall
# Ketik: UNINSTALL untuk konfirmasi
```

### Q: Apakah data aman saat update?
**A:** Ya! Script otomatis backup sebelum update. Jika gagal, bisa rollback.

### Q: Bisa akses tanpa domain?
**A:** Ya! Akses langsung via:
```
http://IP_SERVER:3000
```

### Q: Cara ganti port?
**A:**
```bash
nano /www/wwwroot/billing/.env
# Ubah: PORT=3001
pm2 restart billing-system
```

---

## 📞 SUPPORT & BANTUAN

### Jika Ada Masalah:

1. **Cek Logs:**
   ```bash
   pm2 logs billing-system
   ```

2. **Cek Status:**
   ```bash
   pm2 status
   bash aapanel-manager.sh  # Pilih: 3. Show Status
   ```

3. **Restart Aplikasi:**
   ```bash
   pm2 restart billing-system
   ```

4. **Cek Dokumentasi:**
   - `PANDUAN_LENGKAP_AAPANEL.md` (file ini)
   - `INSTALL_AAPANEL.md`
   - `AAPANEL_DEPLOY_SUMMARY.md`

5. **Review Code:**
   - File .env configuration
   - PM2 ecosystem.config.js
   - Error logs di console

---

## 🚀 QUICK REFERENCE

### One-Liner Commands

```bash
# Install (one-liner)
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing_system/main/quick-install.sh | bash

# Update aplikasi
cd /www/wwwroot/billing && git pull && npm install && npm run build && pm2 restart billing-system

# Backup
tar -czf backup_$(date +%Y%m%d).tar.gz /www/wwwroot/billing

# View logs
pm2 logs billing-system --lines 50

# Check status
pm2 status && curl -I http://localhost:3000
```

---

## ✅ CHECKLIST DEPLOYMENT

### Pre-Deployment:
- [ ] Server dengan aaPanel sudah siap
- [ ] Domain sudah pointing ke IP server (opsional)
- [ ] Akses root/sudo ke server
- [ ] Code sudah di-push ke GitHub

### During Deployment:
- [ ] Run installer script
- [ ] Pilih Full Installation
- [ ] Setup database credentials
- [ ] Generate .env configuration
- [ ] Build & start aplikasi
- [ ] Setup Nginx reverse proxy (opsional)
- [ ] Setup SSL certificate (opsional)

### Post-Deployment:
- [ ] Test akses via browser
- [ ] Login dengan credentials default
- [ ] Ganti password admin & kasir
- [ ] Configure payment gateway
- [ ] Setup Telegram/WhatsApp bot
- [ ] Setup backup otomatis
- [ ] Setup monitoring
- [ ] Test semua fitur utama
- [ ] Setup firewall & security

---

## 🎉 SELESAI!

Aplikasi Billing System Anda sudah **ONLINE** dan **PRODUCTION-READY**!

**Akses Aplikasi:**
- Direct: `http://IP_SERVER:3000`
- Via Domain: `http://billing.yourdomain.com`
- Via HTTPS: `https://billing.yourdomain.com`

**Next Steps:**
1. Login dan ganti password
2. Configure payment gateway
3. Setup notifikasi (Telegram/WhatsApp)
4. Invite team members
5. Mulai gunakan sistem!

---

**Happy Billing! 🚀💰**

*Dokumentasi ini dibuat: $(date)*  
*Repository: https://github.com/adiprayitno160-svg/billing_system*  
*Version: 2.0.0*

