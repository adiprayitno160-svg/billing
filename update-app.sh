#!/bin/bash

# Simple Updater for Billing App
echo "==================================="
echo "Starting Billing App Update..."
echo "==================================="

APP_DIR="/var/www/billing" # Sesuaikan jika path berbeda

# 1. Masuk ke direktori
cd $APP_DIR || { echo "❌ Directory not found"; exit 1; }

# 2. Ambil update dari git
echo "⬇️  Pulling latest changes..."
git pull origin main

# 3. Install dependencies (jaga-jaga ada update library)
echo "📦 Installing dependencies..."
npm install

# 4. Build TypeScript
echo "🔨 Building project..."
npm run build

# 5. Restart PM2 (Reload untuk zero-downtime jika memungkinkan)
echo "🔄 Reloading PM2..."
pm2 reload billing-app || pm2 start ecosystem.config.js --env production

echo "==================================="
echo "✅ Update Complete! (v2.4.14)"
echo "==================================="
