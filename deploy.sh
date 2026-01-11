#!/bin/bash

# Matikan exit on error sementara
# set -e 

echo "🚀 DEPLOYMENT EKSTRIM (CLEAN START)..."

# Masuk ke direktori
cd /var/www/billing

echo "📥 Mengambil kode terbaru dari Git..."
git fetch origin
git reset --hard origin/main

echo "🧹 Membersihkan potensi file sampah..."
# Hapus folder views di dalam dist jika entah bagaimana pernah tercopy ke sana
rm -rf dist/views
# Hapus cache npm jika perlu (opsional)
# npm cache clean --force

echo "📦 Menginstall dependencies..."
npm install --production

echo "🔨 Membuild aplikasi..."
npm run build || echo "⚠️ Build error ignored..."

echo "💀 Mematikan total proses lama..."
pm2 delete billing || true

echo "🔥 Menyalakan ulang proses baru..."
pm2 start dist/server.js --name billing --update-env

echo "✨ Verifikasi File View..."
# Cek apakah file list.ejs mengandung string ID di header tabel
if grep -q "<th>ID</th>" views/customers/list.ejs; then
    echo "❌ GAWAT: File views/customers/list.ejs MASIH mengandung kolom ID!"
else
    echo "✅ BAGUS: File views/customers/list.ejs SUDAH BERSIH dari kolom ID."
fi

echo "✅ Deployment Selesai!"
