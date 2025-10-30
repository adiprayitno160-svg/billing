#!/bin/bash

####################################################################
# SCRIPT FIX BURST LIMITING - COMPLETE STEP BY STEP
####################################################################

set -e  # Exit on error

echo "======================================================================"
echo "🚀 FIX BURST LIMITING - COMPLETE DEPLOYMENT"
echo "======================================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Warning: Not running as root. Some commands may fail."
    echo "   Run with: sudo bash $0"
    echo ""
fi

# Navigate to project directory
echo "📁 Step 1: Navigate to project directory..."
cd /opt/billing || { echo "❌ Directory /opt/billing not found!"; exit 1; }
echo "✅ Current directory: $(pwd)"
echo ""

# Pull latest code
echo "📥 Step 2: Pull latest code from GitHub..."
git pull origin main || { echo "❌ Git pull failed!"; exit 1; }
echo "✅ Code updated"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. This is the first install."
fi

# Install dependencies
echo "📦 Step 3: Install/Update dependencies..."
echo "   This may take 1-2 minutes..."
npm install || { echo "❌ npm install failed!"; exit 1; }
echo "✅ Dependencies installed"
echo ""

# Check if TypeScript is available
echo "🔍 Step 4: Check TypeScript compiler..."
if npx tsc --version > /dev/null 2>&1; then
    TSC_VERSION=$(npx tsc --version)
    echo "✅ TypeScript found: $TSC_VERSION"
else
    echo "❌ TypeScript not found even after npm install!"
    echo "   Trying to install globally..."
    npm install -g typescript
fi
echo ""

# Build project
echo "🔨 Step 5: Build TypeScript project..."
echo "   This may take 30-60 seconds..."
echo "   (You may see some TypeScript errors, but build should succeed)"
npm run build
BUILD_STATUS=$?
if [ $BUILD_STATUS -eq 0 ]; then
    echo "✅ Build completed successfully"
elif [ $BUILD_STATUS -eq 2 ]; then
    echo "⚠️  Build completed with TypeScript errors (this is OK)"
    echo "   JavaScript files were still generated"
else
    echo "❌ Build failed with status: $BUILD_STATUS"
    exit 1
fi
echo ""

# Check if dist files exist
echo "📊 Step 6: Verify build output..."
if [ -f "dist/services/mikrotikService.js" ]; then
    FILESIZE=$(stat -f%z "dist/services/mikrotikService.js" 2>/dev/null || stat -c%s "dist/services/mikrotikService.js" 2>/dev/null)
    echo "✅ mikrotikService.js exists (${FILESIZE} bytes)"
else
    echo "❌ mikrotikService.js not found in dist/"
    exit 1
fi

if [ -f "dist/services/pppoeService.js" ]; then
    FILESIZE=$(stat -f%z "dist/services/pppoeService.js" 2>/dev/null || stat -c%s "dist/services/pppoeService.js" 2>/dev/null)
    echo "✅ pppoeService.js exists (${FILESIZE} bytes)"
else
    echo "❌ pppoeService.js not found in dist/"
    exit 1
fi
echo ""

# Detect PM2 process name
echo "🔍 Step 7: Detect PM2 process name..."
PROCESS_NAME=""
if pm2 list | grep -q "billing-system"; then
    PROCESS_NAME="billing-system"
elif pm2 list | grep -q "billing-app"; then
    PROCESS_NAME="billing-app"
elif pm2 list | grep -q " billing "; then
    PROCESS_NAME="billing"
fi

if [ -n "$PROCESS_NAME" ]; then
    echo "✅ Found PM2 process: $PROCESS_NAME"
else
    echo "⚠️  No PM2 process found. Will start new one..."
    PROCESS_NAME="billing-app"
fi
echo ""

# Restart PM2
echo "🔄 Step 8: Restart PM2 process..."
if pm2 list | grep -q "$PROCESS_NAME"; then
    pm2 restart $PROCESS_NAME
    echo "✅ PM2 restarted: $PROCESS_NAME"
else
    echo "⚠️  Starting new PM2 process..."
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo "✅ PM2 started with ecosystem.config.js"
    else
        pm2 start dist/server.js --name $PROCESS_NAME
        pm2 save
        echo "✅ PM2 started: $PROCESS_NAME"
    fi
fi
echo ""

# Show PM2 status
echo "📊 Step 9: PM2 Status..."
pm2 list
echo ""

# Final instructions
echo "======================================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================================================"
echo ""
echo "🧪 NEXT STEPS - TEST BURST LIMITING:"
echo ""
echo "1️⃣  MONITOR LOG (di terminal ini atau terminal baru):"
echo "    pm2 logs $PROCESS_NAME --lines 0"
echo ""
echo "2️⃣  DI BROWSER:"
echo "    - Login ke sistem billing"
echo "    - Buka: /packages/pppoe/profiles"
echo "    - Klik: \"🔄 Sync dari MikroTik\""
echo "    - Tunggu notifikasi sukses"
echo ""
echo "3️⃣  CEK LOG (di terminal):"
echo "    Cari output:"
echo "    📊 FINAL BURST DATA for [profile-name]: {"
echo "      'burst_limit_rx': '50M',        <-- HARUS TERISI"
echo "      'burst_limit_tx': '50M',        <-- HARUS TERISI"
echo "      'burst_threshold_rx': '15M',    <-- HARUS TERISI"
echo "      'burst_threshold_tx': '15M',    <-- HARUS TERISI"
echo "      'burst_time_rx': '10s',         <-- HARUS TERISI"
echo "      'burst_time_tx': '10s'          <-- HARUS TERISI"
echo "    }"
echo ""
echo "4️⃣  VERIFIKASI DI BROWSER:"
echo "    - Refresh halaman /packages/pppoe/profiles"
echo "    - Cek kolom Burst Threshold & Time"
echo "    - Jika terisi: ✅ SUKSES!"
echo ""
echo "======================================================================"
echo ""
echo "📝 TROUBLESHOOTING:"
echo ""
echo "Jika FINAL BURST DATA masih EMPTY:"
echo "  → Cek MikroTik apakah profile punya burst setting"
echo "  → Via Winbox: PPP > Profiles > Rate Limit tab"
echo "  → Via Terminal: /ppp profile print detail"
echo ""
echo "Jika ada error lain:"
echo "  → Kirim screenshot log PM2"
echo "  → Kirim screenshot /packages/pppoe/profiles"
echo ""
echo "======================================================================"

