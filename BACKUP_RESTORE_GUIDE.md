# 🗄️ Panduan Backup & Restore - Sistem Billing

## 📋 Daftar Isi
1. [Fitur Utama](#fitur-utama)
2. [Cara Mengakses](#cara-mengakses)
3. [Jenis Backup](#jenis-backup)
4. [Cara Membuat Backup](#cara-membuat-backup)
5. [Cara Restore Database](#cara-restore-database)
6. [Upload Backup](#upload-backup)
7. [Manajemen Backup](#manajemen-backup)
8. [Persiapan Sistem](#persiapan-sistem)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Fitur Utama

Fitur Backup & Restore menyediakan:
- ✅ **Backup Database** - Backup seluruh database MySQL
- ✅ **Backup Source Code** - Backup kode aplikasi
- ✅ **Backup Lengkap** - Backup database + source code sekaligus
- ✅ **Restore Database** - Pulihkan database dari backup
- ✅ **Upload & Restore** - Upload file backup dan restore
- ✅ **Manajemen Backup** - Download, lihat, dan hapus backup
- ✅ **Statistik Backup** - Monitor total backup, ukuran, dan tanggal

---

## 🔗 Cara Mengakses

1. Login ke sistem billing
2. Buka menu **Pengaturan** di sidebar
3. Klik **Backup & Restore**
4. Atau akses langsung: `http://your-domain/backup`

---

## 📦 Jenis Backup

### 1. **Backup Database** 
- 🗂️ Format: `.sql`
- 📊 Berisi: Semua tabel dan data database
- ⚡ Waktu: Cepat (tergantung ukuran database)
- 🎯 Gunakan untuk: Backup rutin data pelanggan dan transaksi

### 2. **Backup Source Code**
- 📁 Format: `.zip`
- 💻 Berisi: Kode aplikasi (tanpa node_modules, logs, dll)
- ⏱️ Waktu: Sedang
- 🎯 Gunakan untuk: Backup sebelum update atau perubahan kode

### 3. **Backup Lengkap**
- 📦 Format: `.sql` + `.zip`
- 🔄 Berisi: Database + Source Code
- ⏳ Waktu: Paling lama
- 🎯 Gunakan untuk: Backup lengkap sebelum maintenance besar

---

## 💾 Cara Membuat Backup

### Backup Database
```
1. Klik tombol "Backup Database"
2. Tunggu proses selesai
3. File backup akan tersimpan di folder /backups/
4. Nama file: database_backup_YYYYMMDD_HHMMSS.sql
```

### Backup Source Code
```
1. Klik tombol "Backup Source Code"
2. Tunggu proses kompresi selesai
3. File backup tersimpan di folder /backups/
4. Nama file: source_backup_YYYYMMDD_HHMMSS.zip
```

### Backup Lengkap
```
1. Klik tombol "Backup Lengkap"
2. Sistem akan membuat backup database dan source code bersamaan
3. Dua file akan dibuat secara paralel
4. Proses lebih cepat dibanding backup satu per satu
```

---

## 🔄 Cara Restore Database

### ⚠️ PENTING: Backup Data Saat Ini!
**SEBELUM RESTORE, PASTIKAN SUDAH BACKUP DATABASE SAAT INI!**

### Cara Restore dari Backup yang Ada:
```
1. Di tabel "Daftar Backup", cari backup database yang ingin direstore
2. Klik ikon "Restore" (undo) pada baris backup
3. Konfirmasi restore (PERINGATAN: Data saat ini akan ditimpa!)
4. Tunggu proses restore selesai
5. Sistem akan menampilkan notifikasi sukses/gagal
```

### ⚠️ Restore akan:
- ✅ Mengganti SEMUA data database dengan data dari backup
- ❌ Tidak bisa di-undo (kecuali ada backup)
- ⏱️ Membutuhkan waktu tergantung ukuran database
- 🔐 Memerlukan akses superadmin

---

## 📤 Upload Backup

### Untuk Database (.sql)
```
1. Pilih file backup (.sql) dari komputer Anda
2. Pilih "Database (.sql)" pada dropdown Tipe Backup
3. Klik "Upload & Restore"
4. Sistem akan langsung restore database
```

### Untuk Source Code (.zip)
```
1. Pilih file backup (.zip) dari komputer Anda
2. Pilih "Source Code (.zip)" pada dropdown Tipe Backup
3. Klik "Upload & Restore"
4. File akan disimpan, restore manual diperlukan
```

---

## 🗂️ Manajemen Backup

### Daftar Backup
Tabel menampilkan:
- 📄 Nama File
- 🏷️ Tipe (Database/Source/Full)
- 📊 Ukuran File
- 📅 Tanggal Backup

### Aksi yang Tersedia:
1. **Download** 📥
   - Klik ikon download untuk mengunduh file backup
   - Simpan di tempat aman (cloud storage, external drive)

2. **Restore** 🔄
   - Hanya untuk backup database
   - Restore data dari file backup

3. **Delete** 🗑️
   - Hapus file backup yang tidak diperlukan
   - Konfirmasi diperlukan

### Statistik Backup:
- **Total Backup**: Jumlah file backup yang tersimpan
- **Total Ukuran**: Total ruang disk yang digunakan
- **Backup Terbaru**: Tanggal backup terakhir
- **Backup Terlama**: Tanggal backup pertama

---

## ⚙️ Persiapan Sistem

### Persyaratan:
1. **MySQL/MariaDB** harus terinstall dan accessible via command line
   - `mysqldump` untuk backup
   - `mysql` untuk restore

2. **PowerShell** (untuk Windows)
   - Digunakan untuk kompresi source code

3. **Folder Backup** harus writable
   - Default: `/backups/`
   - Pastikan ada permission write

4. **Environment Variables** harus dikonfigurasi:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=billing
```

### Konfigurasi MySQL PATH (Jika mysqldump tidak terdeteksi):

#### Windows:
```powershell
# Tambahkan ke System PATH:
C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin
# atau path sesuai instalasi MySQL Anda
```

#### Cara menambahkan ke PATH:
1. Tekan `Win + X` → System
2. Advanced system settings → Environment Variables
3. Pada System Variables, pilih `Path` → Edit
4. Tambahkan path ke folder `bin` MySQL
5. OK → Restart terminal/aplikasi

---

## 🔧 Troubleshooting

### ❌ Error: "mysqldump is not recognized"
**Solusi:**
1. Pastikan MySQL terinstall
2. Tambahkan MySQL bin folder ke System PATH
3. Restart aplikasi setelah update PATH
4. Cek dengan: `mysqldump --version` di terminal

### ❌ Error: "Gagal membuat backup database"
**Kemungkinan Penyebab:**
- Database credentials salah
- MySQL service tidak berjalan
- Tidak ada permission untuk folder backup
- Disk space penuh

**Solusi:**
1. Cek `.env` file untuk credentials yang benar
2. Pastikan MySQL service running
3. Cek permission folder `/backups/`
4. Cek disk space available

### ❌ Error: "Gagal restore database"
**Kemungkinan Penyebab:**
- File backup corrupt
- Database sedang digunakan
- Tidak ada permission

**Solusi:**
1. Verifikasi file backup tidak corrupt
2. Tutup semua koneksi ke database
3. Coba restore manual via terminal:
```bash
mysql -u root -p billing < backup_file.sql
```

### ❌ Error: "File harus berformat .sql atau .zip"
**Solusi:**
- Pastikan file yang diupload memiliki ekstensi yang benar
- Rename file jika perlu
- File tidak boleh corrupt

### ⚠️ Warning: "Backup source code terlalu lama"
**Solusi:**
1. Cek ukuran project (folder node_modules, logs, dll seharusnya di-exclude)
2. Periksa log untuk melihat folder apa yang di-compress
3. Update exclude list di `backupService.ts` jika perlu

---

## 📝 Best Practices

### Jadwal Backup yang Disarankan:
- 📅 **Database**: Backup otomatis setiap hari (gunakan cron job)
- 📅 **Source Code**: Backup sebelum update atau perubahan
- 📅 **Full Backup**: Backup mingguan atau sebelum maintenance besar

### Penyimpanan Backup:
- ✅ Simpan di lokasi terpisah dari server
- ✅ Gunakan cloud storage (Google Drive, Dropbox, dll)
- ✅ Simpan minimal 3 generasi backup
- ✅ Test restore secara berkala

### Keamanan:
- 🔒 Backup berisi data sensitif
- 🔒 Enkripsi backup sebelum upload ke cloud
- 🔒 Batasi akses ke folder backup
- 🔒 Hanya superadmin yang bisa restore

### Monitoring:
- 📊 Cek statistik backup secara rutin
- 📊 Monitor ukuran disk
- 📊 Hapus backup lama yang tidak diperlukan
- 📊 Dokumentasikan setiap restore yang dilakukan

---

## 🚀 Otomasi Backup (Opsional)

### Membuat Backup Otomatis dengan Task Scheduler (Windows):

1. Buat file batch `auto-backup.bat`:
```batch
@echo off
cd C:\laragon\www\billing
curl -X POST http://localhost:3000/backup/database
echo Backup completed at %date% %time%
```

2. Buka Task Scheduler
3. Create Basic Task
4. Name: "Billing Database Backup"
5. Trigger: Daily, Time: 02:00 AM
6. Action: Start a program → Browse ke `auto-backup.bat`
7. Finish

### Atau gunakan API:
```javascript
// Backup via API
fetch('http://localhost:3000/backup/database', {
    method: 'POST',
    credentials: 'include'
});
```

---

## 📞 Support

Jika mengalami masalah:
1. Cek log error di folder `/logs/`
2. Verifikasi konfigurasi environment
3. Test MySQL connection
4. Hubungi administrator sistem

---

## 📄 Changelog

### Version 1.0.0 (2025-10-25)
- ✨ Fitur backup database
- ✨ Fitur backup source code
- ✨ Fitur backup lengkap
- ✨ Fitur restore database
- ✨ Upload dan manage backup
- ✨ Statistik dan monitoring
- 🎨 UI modern dengan konfirmasi modal
- 📊 Real-time statistics

---

## 🔐 Keamanan

**PENTING:**
- Jangan share file backup database (berisi data sensitif)
- Gunakan enkripsi untuk backup yang disimpan di cloud
- Batasi akses ke folder `/backups/`
- Audit log setiap restore yang dilakukan
- Backup harus dilindungi seperti database production

---

**Sistem Backup & Restore untuk Billing System v1.0**
Dibuat dengan ❤️ untuk keamanan dan kemudahan backup data Anda.

