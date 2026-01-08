#!/bin/bash

# Simple Updater for Billing App
echo "==================================="
echo "Starting Billing App Update..."
echo "==================================="

APP_DIR="/var/www/billing" # Sesuaikan jika path berbeda

# 1. Masuk ke direktori
cd $APP_DIR || { echo "❌ Directory not found"; exit 1; }

# 2. Reset dan Ambil update dari git
echo "⬇️  Pulling latest changes..."
git reset --hard
git pull origin main

# 3. Hapus cache versi lama
rm -f VERSION VERSION_MAJOR

# 4. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 5. Build TypeScript
echo "🔨 Building project..."
npm run build

# 6. Restart PM2
echo "🔄 Restarting application..."
pm2 restart all

echo "==================================="
echo "✅ Update Complete! (v2.4.14)"
echo "==================================="
