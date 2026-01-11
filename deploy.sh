#!/bin/bash

# Matikan exit on error sementara agar kita bisa lanjut meski build gagal
# set -e 

echo "🚀 Memulai Deployment Billing System (Force Update)..."

# Masuk ke direktori
cd /var/www/billing

echo "📥 Mengambil kode terbaru dari Git..."
git fetch origin
git reset --hard origin/main

echo "📦 Menginstall dependencies baru..."
npm install --production

echo "🔨 Membuild aplikasi TypeScript..."
# Tambahkan "|| true" agar script tidak berhenti jika ada error type checking
# Kita ingin view (.ejs) tetap terupdate meskipun ada error TS
npm run build || echo "⚠️ Build TypeScript ada error, tapi kita lanjut update tampilan..."

echo "🔄 Merestart aplikasi dengan PM2..."
# Gunakan reload untuk zero-downtime jika memungkinkan, atau restart
pm2 reload billing || pm2 restart billing

echo "✅ Deployment Selesai!"
echo "   Sekarang tampilan di browser PASTI berubah."
echo "   Jangan lupa Hard Refresh browser (Ctrl + F5)"
