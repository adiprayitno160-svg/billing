# Cara Backup Aplikasi dan Database

Script backup akan membuat 1 file ZIP yang berisi:
- ✅ Semua file aplikasi (source code, config, dll)
- ✅ Database dump (SQL file)
- ✅ File .env (jika ada)
- ✅ File info backup

## Di Server Production (Linux):

```bash
# Jalankan script backup
bash backup-all.sh

# Atau via npm
npm run backup
```

Backup akan tersimpan di: `/opt/billing/backups/billing-backup-YYYYMMDD_HHMMSS.zip`

## Di Local Development (Windows):

```bash
# Jalankan script backup
backup-all.bat

# Atau via npm
npm run backup:windows
```

Backup akan tersimpan di: `backups\billing-backup-YYYYMMDD_HHMMSS.zip`

## Cara Restore Backup:

### 1. Extract ZIP file
```bash
unzip billing-backup-YYYYMMDD_HHMMSS.zip
# atau
tar -xzf billing-backup-YYYYMMDD_HHMMSS.tar.gz
```

### 2. Restore Database
```bash
mysql -u billing_user -p billing < database.sql
```

### 3. Copy Files
```bash
cp -r files/* /opt/billing/
```

### 4. Install Dependencies & Build
```bash
cd /opt/billing
npm install
npm run build
npm run css:build
```

### 5. Restore .env (jika perlu)
```bash
cp .env.backup /opt/billing/.env
```

### 6. Restart Application
```bash
pm2 restart billing-app
```

## File yang TIDAK Di-backup:

- `node_modules` - Bisa diinstall ulang dengan `npm install`
- `dist` - Bisa dibuild ulang dengan `npm run build`
- `.git` - Version control (sudah ada di GitHub)
- `logs` - File log
- `uploads` - File upload user
- `backups` - Direktori backup itu sendiri
- `whatsapp-session` - Session files WhatsApp

## Backup Otomatis (Cron Job):

Tambahkan ke crontab untuk backup otomatis setiap hari:

```bash
# Edit crontab
crontab -e

# Backup setiap hari jam 2 pagi
0 2 * * * /opt/billing/backup-all.sh >> /opt/billing/logs/backup-cron.log 2>&1
```

## Konfigurasi Database:

Jika backup database gagal, edit script `backup-all.sh` dan sesuaikan:
- `DB_HOST` - Host database (default: localhost)
- `DB_USER` - Username database (default: billing_user)
- `DB_NAME` - Nama database (default: billing)
- `DB_PASSWORD` - Password database (atau akan prompt saat backup)

## Troubleshooting:

### Database backup gagal:
- Pastikan MySQL/MariaDB client terinstall
- Pastikan user punya akses ke database
- Cek kredensial database di `.env`

### File backup terlalu besar:
- Pastikan exclude list bekerja dengan benar
- Cek apakah ada file besar yang tidak perlu di-backup

### ZIP creation gagal:
- Pastikan `zip` atau `tar` command tersedia
- Cek space disk yang tersedia

