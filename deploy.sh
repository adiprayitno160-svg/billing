#!/bin/bash

# Pastikan script berhenti jika ada error
set -e

echo "🚀 Memulai Deployment Billing System..."

# Masuk ke direktori
cd /var/www/billing

echo "📥 Mengambil kode terbaru dari Git..."
git fetch origin
git reset --hard origin/main

echo "📦 Menginstall dependencies baru (jika ada)..."
npm install --production

echo "🔨 Membuild aplikasi TypeScript..."
npm run build

echo "🔄 Merestart aplikasi dengan PM2..."
# Gunakan reload untuk zero-downtime jika memungkinkan, atau restart
pm2 reload billing || pm2 restart billing

echo "✅ Deployment Selesai! Aplikasi sudah menggunakan versi terbaru."
echo "   Jangan lupa Hard Refresh browser (Ctrl + F5)"
