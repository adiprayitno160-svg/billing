#!/bin/bash

# ==========================================
# AUTOMATED DEPLOYMENT SCRIPT (UBUNTU VPS)
# ==========================================

# CONFIGURATION
# Ubah path ini sesuai lokasi project di VPS Anda
APP_DIR="/var/www/billing"
PM2_APP_NAME="billing" # Sesuaikan nama app di PM2 (cek dengan 'pm2 list')

echo "🚀 Memulai Proses Update..."

# 1. Cek Direktori
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    echo "📂 Masuk ke direktori: $APP_DIR"
else
    echo "❌ Error: Direktori $APP_DIR tidak ditemukan."
    echo "👉 Silakan edit file ini dan sesuaikan variabel APP_DIR."
    exit 1
fi

# 2. Git Pull
echo "📥 Menarik kode terbaru dari Git..."
git fetch --all
git reset --hard origin/main
git pull origin main

# 3. Install Dependencies
echo "📦 Menginstall/Update dependencies..."
npm install

# 4. Build TypeScript
echo "🔨 Membangun ulang project (Build)..."
npm run build

# 5. Restart PM2
echo "🔄 Merestart aplikasi..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
    pm2 restart "$PM2_APP_NAME"
    echo "✅ Service '$PM2_APP_NAME' berhasil direstart."
else
    echo "⚠️  Service '$PM2_APP_NAME' tidak ditemukan di PM2."
    echo "   Mencoba restart 'all'..."
    pm2 restart all
fi

echo "=========================================="
echo "✅ UPDATE SELESAI!"
echo "=========================================="
