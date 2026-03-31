#!/bin/bash

# Script Bantuan untuk Restore Database di Ubuntu
# Berguna jika file SQL anda terlalu besar untuk di-upload via phpMyAdmin

echo "========================================================"
echo "   RESTORE DATABASE MANUAL (Ubuntu)"
echo "========================================================"

# Cek parameter
if [ "$#" -ne 1 ]; then
    echo "❌ Cara penggunaan: ./restore_db_ubuntu.sh <nama_file.sql>"
    echo "   Contoh: ./restore_db_ubuntu.sh backup_billing.sql"
    exit 1
fi

FILE_SQL=$1

# Cek file ada
if [ ! -f "$FILE_SQL" ]; then
    echo "❌ File '$FILE_SQL' tidak ditemukan!"
    exit 1
fi

# Konfigurasi Database (Sesuaikan jika perlu)
DB_NAME="radius"
DB_USER="root"
# Password akan ditanyakan saat eksekusi agar aman

echo "🗄️  Database Target: $DB_NAME"
echo "📂 File Sumber: $FILE_SQL"
echo ""
echo "⚠️  PERINGATAN: Database '$DB_NAME' akan ditimpa!"
echo "   Pastikan database sudah dibuat. Jika belum, script akan mencoba membuatnya."
echo ""
read -p "Lanjutkan? (y/n): " confirm
if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "Dibatalkan."
    exit 1
fi

echo ""
echo "🔐 Masukkan password MySQL ROOT saat diminta:"

# Create DB if not exists
mysql -u $DB_USER -p -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;" 2>/dev/null

# Restore
echo "⏳ Sedang melakukan restore (bisa memakan waktu lama untuk file besar)..."
mysql -u $DB_USER -p $DB_NAME < "$FILE_SQL"

if [ $? -eq 0 ]; then
    echo "✅ RESTORE SELESAI!"
    echo "   Database '$DB_NAME' telah berhasil dipulihkan dari '$FILE_SQL'."
else
    echo "❌ Terjadi kesalahan saat restore."
fi
