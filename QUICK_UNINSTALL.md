# ⚡ QUICK UNINSTALL - Hapus Billing dari Server

## 🗑️ Cara Tercepat (1 Command!)

### Login SSH ke server, lalu:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/uninstall-from-server.sh | bash
```

> Ganti `YOUR-USERNAME` dengan username GitHub Anda!

---

## 🔧 Atau Download Dulu (Lebih Aman)

```bash
# Download script
wget https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/uninstall-from-server.sh

# Beri permission
chmod +x uninstall-from-server.sh

# Jalankan
bash uninstall-from-server.sh
```

---

## 📋 Script Akan Menanyakan:

1. **Konfirmasi**: Ketik `YES` untuk lanjut
2. **Backup**: Backup data sebelum dihapus? (y/n)
3. **MySQL Password**: Password root MySQL
4. **Nginx Config**: Hapus config Nginx? (y/n)
5. **Node.js & PM2**: Hapus juga? (y/n)

---

## ⚡ Manual Quick Commands

### Uninstall Tanpa Backup (Hati-hati!)

```bash
# Stop PM2
pm2 delete billing-system

# Hapus directory
rm -rf /www/wwwroot/billing

# Drop database
mysql -u root -p -e "DROP DATABASE IF EXISTS billing_system;"
```

### Uninstall Dengan Backup

```bash
# Backup dulu
BACKUP_DIR="$HOME/billing_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
mysqldump -u root -p billing_system > "$BACKUP_DIR/database.sql"
tar -czf "$BACKUP_DIR/app_files.tar.gz" -C /www/wwwroot billing

# Lalu uninstall
pm2 delete billing-system
rm -rf /www/wwwroot/billing
mysql -u root -p -e "DROP DATABASE billing_system;"

echo "Backup tersimpan di: $BACKUP_DIR"
```

---

## 🎯 Lokasi File yang Dihapus

```
/www/wwwroot/billing/              # Aplikasi
billing_system (database)          # Database
PM2: billing-system                # Process
/www/server/panel/vhost/nginx/     # Nginx config (aaPanel)
/etc/nginx/sites-available/        # Nginx config (standard)
```

---

## ✅ Verifikasi Setelah Uninstall

```bash
# Check directory
ls -la /www/wwwroot/billing
# Harus error: No such file or directory ✅

# Check PM2
pm2 list | grep billing
# Harus kosong ✅

# Check database
mysql -u root -p -e "SHOW DATABASES;" | grep billing
# Harus kosong ✅

# Check port
netstat -tulpn | grep 3000
# Harus kosong ✅
```

---

## 🔄 Fresh Install Setelah Uninstall

```bash
# Jalankan installer lagi
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/aapanel-deploy.sh | bash
```

---

## 📚 Dokumentasi Lengkap

Lihat: [UNINSTALL_GUIDE.md](UNINSTALL_GUIDE.md)

---

**Selesai! Server sudah bersih! 🧹**


