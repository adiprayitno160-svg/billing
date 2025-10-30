#!/bin/bash
#
# Quick Fix untuk Import Gagal di Live Server
# Usage: ./quick-fix-import.sh
#

set -e

echo "🔧 Starting Quick Fix for Import Issue..."
echo ""

# Check if we're on live server
if [ ! -f "dist/server.js" ]; then
    echo "❌ Error: dist/server.js not found"
    echo "   Are you in the correct directory?"
    exit 1
fi

echo "📦 Step 1: Backup current code..."
git stash save "backup-before-import-fix-$(date +%Y%m%d-%H%M%S)"

echo ""
echo "📥 Step 2: Pull latest code..."
git pull origin main

echo ""
echo "📦 Step 3: Install/Update dependencies..."
npm install

echo ""
echo "🔨 Step 4: Rebuild TypeScript..."
npm run build

echo ""
echo "🔄 Step 5: Restart PM2..."
pm2 restart billing-app

echo ""
echo "⏳ Waiting for app to start..."
sleep 3

echo ""
echo "📊 Step 6: Check PM2 status..."
pm2 list

echo ""
echo "📝 Step 7: Show recent logs..."
pm2 logs billing-app --lines 30 --nostream

echo ""
echo "✅ Fix completed!"
echo ""
echo "Next steps:"
echo "1. Try import Excel again"
echo "2. Monitor logs: pm2 logs billing-app"
echo "3. If still fails, check: tail -f logs/err.log"
echo ""

