# 🚀 Update Guide - Billing System

Panduan lengkap untuk update aplikasi Billing System.

## 📋 Daftar Isi
- [Update via Web Interface](#update-via-web-interface)
- [Update via SSH (Remote)](#update-via-ssh-remote)
- [Update Manual di Server](#update-manual-di-server)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)

---

## 🌐 Update via Web Interface

### Cara Termudah (Recommended)

1. **Login ke aplikasi** sebagai admin
2. **Buka halaman About**: `http://your-server:3000/about`
3. **Klik tombol "Cek Update"**
4. **Jika ada update**, klik **"Update Sekarang"**
5. **Tunggu proses selesai** (1-2 menit)
6. **Aplikasi akan restart otomatis**

### Fitur Auto-Update
- ✅ Backup otomatis sebelum update
- ✅ Rollback otomatis jika gagal
- ✅ Restart PM2 otomatis
- ✅ Update history tracking

---

## 🔄 Update via SSH (Remote)

### Dari Windows

```powershell
# Basic usage
.\remote-update.ps1 -Host 192.168.1.100

# With custom SSH key
.\remote-update.ps1 -Host myserver.com -User ubuntu -KeyPath C:\Users\user\.ssh\id_rsa

# Force update without confirmation
.\remote-update.ps1 -Host 192.168.1.100 -Force

# Show help
.\remote-update.ps1 -Help
```

### Dari Linux/Mac

```bash
# Basic usage
./remote-update.sh --host 192.168.1.100

# With custom SSH settings
./remote-update.sh --host myserver.com --user ubuntu --port 2222

# With SSH key
./remote-update.sh --host 192.168.1.100 --key ~/.ssh/id_rsa

# Force update
./remote-update.sh --host 192.168.1.100 --force

# Show help
./remote-update.sh --help
```

### Setup Awal (One-time)

1. **Upload script ke server:**
   ```bash
   scp update.sh root@your-server:/opt/billing/
   ```

2. **Set permissions:**
   ```bash
   ssh root@your-server "chmod +x /opt/billing/update.sh"
   ```

3. **Edit script dengan server details:**
   - Windows: Edit `remote-update.ps1`
   - Linux/Mac: Edit `remote-update.sh`
   
   Ubah nilai default:
   ```bash
   SSH_USER="root"          # Ganti dengan user SSH Anda
   SSH_HOST="your-server-ip" # Ganti dengan IP/hostname server
   SSH_PORT="22"            # Ganti jika port SSH custom
   ```

---

## 🖥️ Update Manual di Server

### Via SSH

```bash
# 1. Login ke server
ssh root@your-server

# 2. Masuk ke directory aplikasi
cd /opt/billing

# 3. Jalankan update script
./update.sh
```

### Step-by-Step Manual

```bash
# 1. Backup
cd /opt/billing
tar -czf backup-$(date +%Y%m%d).tar.gz --exclude=node_modules --exclude=.git .

# 2. Pull latest changes
git fetch origin --tags
git pull origin main

# 3. Install dependencies
npm install --production

# 4. Build application
npm run build
npm run css:build

# 5. Restart PM2
pm2 restart billing-app
```

---

## 🔙 Rollback

### Automatic Rollback

Jika update gagal via web interface, sistem akan rollback otomatis.

### Manual Rollback

```bash
# 1. Login ke server
ssh root@your-server

# 2. Masuk ke directory aplikasi
cd /opt/billing

# 3. List backups
ls -lh /opt/billing-backups/

# 4. Extract backup
cd /opt/billing
tar -xzf /opt/billing-backups/backup-YYYYMMDD-HHMMSS-vX.X.X.tar.gz

# 5. Install dependencies
npm install --production

# 6. Build
npm run build

# 7. Restart
pm2 restart billing-app
```

---

## 🐛 Troubleshooting

### Issue: Update gagal - Git conflict

**Solusi:**
```bash
ssh root@your-server
cd /opt/billing

# Stash local changes
git stash

# Retry update
./update.sh
```

### Issue: PM2 tidak restart

**Solusi:**
```bash
ssh root@your-server

# Check PM2 status
pm2 list

# Force restart
pm2 restart billing-app

# Atau start jika belum running
pm2 start ecosystem.config.js --env production
```

### Issue: Dependencies error

**Solusi:**
```bash
ssh root@your-server
cd /opt/billing

# Clear node_modules
rm -rf node_modules
rm package-lock.json

# Reinstall
npm install --production

# Rebuild
npm run build
```

### Issue: Database migration error

**Solusi:**
```bash
ssh root@your-server
cd /opt/billing

# Check database connection
mysql -u billing_user -p billing

# Run migrations manually (if any)
# Check migrations/ folder for SQL files
```

### Issue: Port already in use

**Solusi:**
```bash
ssh root@your-server

# Find process using port 3000
lsof -i :3000

# Kill the process
pm2 stop billing-app
pm2 delete billing-app

# Restart
pm2 start ecosystem.config.js --env production
pm2 save
```

### Issue: Permission denied

**Solusi:**
```bash
ssh root@your-server
cd /opt/billing

# Fix permissions
sudo chown -R $USER:$USER /opt/billing
chmod +x update.sh
```

---

## 📊 Update History

Lihat history update di:
- **Web Interface:** `/about` page
- **Database:** `update_history` table
- **Logs:** `/opt/billing/logs/update.log` (jika ada)

---

## 🔒 Best Practices

1. **Selalu backup** sebelum update
2. **Test di staging** environment dulu
3. **Update saat traffic rendah** (malam/dini hari)
4. **Monitor logs** setelah update
5. **Keep backups** minimal 5 versi terakhir
6. **Dokumentasi changes** yang dibuat

---

## 📞 Support

Jika ada masalah:
1. Check logs: `pm2 logs billing-app`
2. Check error logs di console browser (F12)
3. Rollback jika critical
4. Contact developer

---

## 🎯 Quick Commands

```bash
# Check current version
cat /opt/billing/VERSION

# Check latest GitHub version
git ls-remote --tags https://github.com/adiprayitno160-svg/billing.git | tail -1

# Update via script
./update.sh

# Check PM2 status
pm2 status

# View logs
pm2 logs billing-app --lines 100

# Restart app
pm2 restart billing-app
```

---

**Last Updated:** $(date)
**Version:** 2.0.1

