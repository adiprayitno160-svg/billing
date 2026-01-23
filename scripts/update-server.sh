#!/bin/bash

# ========================================
# Update Billing App v2.4.1 via SSH
# ========================================

# Ganti dengan informasi server Anda
SERVER_USER="adi"
SERVER_HOST="192.168.239.154"
APP_PATH="/var/www/billing"

echo "========================================"
echo " Update Billing App v2.4.1 via SSH"
echo "========================================"
echo ""
echo "Connecting to $SERVER_USER@$SERVER_HOST..."
echo ""

# Jalankan update command via SSH
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd /var/www/billing

echo "=== 📥 Pulling latest code from GitHub ==="
git pull origin main

echo ""
echo "=== 📦 Installing dependencies ==="
npm install

echo ""
echo "=== 🔨 Building application ==="
npm run build

echo ""
echo "=== 🔄 Restarting application with PM2 ==="
pm2 restart billing-app

echo ""
echo "=== ✅ Update Complete! ==="
pm2 status
pm2 logs billing-app --lines 20

ENDSSH

echo ""
echo "========================================"
echo " ✅ Update selesai!"
echo "========================================"
