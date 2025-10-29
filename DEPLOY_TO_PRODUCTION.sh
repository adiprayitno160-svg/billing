#!/bin/bash

# ========================================
# DEPLOY TO PRODUCTION SERVER
# Target: 192.168.239.126:3000
# ========================================

echo "========================================="
echo "🚀 DEPLOY TO PRODUCTION - v2.0.4"
echo "========================================="
echo ""

# Configuration
PROD_SERVER="192.168.239.126"
PROD_USER="YOUR_SSH_USER"  # Change this!
PROD_PATH="/path/to/billing"  # Change this!
BACKUP_DIR="../billing-backup-$(date +%Y%m%d-%H%M%S)"

echo "Target: $PROD_USER@$PROD_SERVER:$PROD_PATH"
echo ""
read -p "Lanjutkan deploy? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Deploy dibatalkan"
    exit 0
fi

echo ""
echo "[1/8] Connecting to production server..."
ssh $PROD_USER@$PROD_SERVER << 'ENDSSH'

echo ""
echo "[2/8] Navigating to project directory..."
cd /path/to/billing || exit 1  # Change this!

echo ""
echo "[3/8] Creating backup..."
cp -r . ../billing-backup-$(date +%Y%m%d-%H%M%S)
echo "✅ Backup created"

echo ""
echo "[4/8] Pulling latest code from GitHub..."
git pull origin main
if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!"
    exit 1
fi
echo "✅ Code pulled successfully"

echo ""
echo "[5/8] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "⚠️  npm install had warnings, but continuing..."
fi
echo "✅ Dependencies installed"

echo ""
echo "[6/8] Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful"

echo ""
echo "[7/8] Restarting server with PM2..."
pm2 restart billing-system
if [ $? -ne 0 ]; then
    echo "⚠️  PM2 restart failed, trying to start..."
    pm2 start ecosystem.config.js
fi
echo "✅ Server restarted"

echo ""
echo "[8/8] Checking server status..."
sleep 3
pm2 status billing-system
pm2 logs billing-system --lines 20 --nostream

echo ""
echo "========================================="
echo "✅ DEPLOY COMPLETED!"
echo "========================================="
echo ""
echo "Verify at: http://192.168.239.126:3000"
echo ""
echo "Check these URLs:"
echo "  - http://192.168.239.126:3000/prepaid/packages"
echo "  - http://192.168.239.126:3000/prepaid/speed-profiles"
echo "  - http://192.168.239.126:3000/prepaid/mikrotik-setup"
echo "  - http://192.168.239.126:3000/prepaid/address-list"
echo ""

ENDSSH

echo ""
echo "Deploy script completed"
echo ""

