#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 FULL DEPLOYMENT (Major/Minor/Patch Updates)
# ═══════════════════════════════════════════════════════════════════════════
# Script untuk deployment FULL yang memerlukan rebuild TypeScript
# Untuk Major/Minor/Patch updates yang mengubah backend code
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  🚀 FULL DEPLOYMENT WITH TYPESCRIPT REBUILD                               ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the correct directory?"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Read current version
if [ -f "VERSION" ]; then
    CURRENT_VERSION=$(cat VERSION)
    echo "📦 Current version: $CURRENT_VERSION"
else
    echo "⚠️  VERSION file not found"
    CURRENT_VERSION="unknown"
fi
echo ""

# Step 2: Backup
echo "1️⃣  Creating backup..."
BACKUP_DIR="backups/full-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r src views public "$BACKUP_DIR/" 2>/dev/null || echo "⚠️  Some directories not found"
cp package.json VERSION "$BACKUP_DIR/" 2>/dev/null || true
echo "✅ Backup created: $BACKUP_DIR"
echo ""

# Step 3: Git pull
echo "2️⃣  Pulling latest changes from GitHub..."
git fetch origin main
git pull origin main
echo "✅ Git pull completed"
echo ""

# Step 4: Read new version
if [ -f "VERSION" ]; then
    NEW_VERSION=$(cat VERSION)
    echo "📦 New version: $NEW_VERSION"
fi

if [ -f "VERSION_MAJOR" ]; then
    MAJOR_VERSION=$(cat VERSION_MAJOR)
    echo "📦 Major version (About page): $MAJOR_VERSION"
fi
echo ""

# Step 5: Check for new dependencies
echo "3️⃣  Checking dependencies..."
if git diff HEAD@{1} HEAD -- package.json | grep -q "dependencies"; then
    echo "🔄 New dependencies detected. Running npm install..."
    npm install
else
    echo "✅ No new dependencies"
fi
echo ""

# Step 6: Build TypeScript
echo "4️⃣  Building TypeScript..."

# Check if tsc is available
if ! npx tsc --version &> /dev/null; then
    echo "⚠️  TypeScript compiler not found. Installing..."
    npm install
fi

echo "🔨 Running: npm run build"
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed!"
    echo ""
    echo "🔧 Trying to fix tsc not found error..."
    bash setup-dependencies.sh
    npm run build
fi
echo ""

# Step 7: Restart PM2
echo "5️⃣  Restarting PM2..."

# Detect process name (try common names)
PROCESS_NAME=""
if pm2 list | grep -q "billing-system"; then
    PROCESS_NAME="billing-system"
elif pm2 list | grep -q "billing-app"; then
    PROCESS_NAME="billing-app"
elif pm2 list | grep -q " billing "; then
    PROCESS_NAME="billing"
fi

if [ -n "$PROCESS_NAME" ]; then
    echo "✅ Process found: $PROCESS_NAME"
    pm2 restart $PROCESS_NAME
    
    if [ $? -eq 0 ]; then
        echo "✅ PM2 restarted successfully"
    else
        echo "⚠️  PM2 restart failed. Trying to start fresh..."
        pm2 start ecosystem.config.js --env production
    fi
else
    echo "⚠️  No billing process found. Starting new process..."
    pm2 start ecosystem.config.js --env production
fi
echo ""

# Step 8: Save PM2 configuration
echo "6️⃣  Saving PM2 configuration..."
pm2 save
echo "✅ PM2 configuration saved"
echo ""

# Step 9: Show status
echo "7️⃣  Current status:"
pm2 list
echo ""

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ FULL DEPLOYMENT COMPLETED!                                            ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Summary:"
echo "   - Previous version: $CURRENT_VERSION"
echo "   - New version: $NEW_VERSION"
echo "   - About page shows: $MAJOR_VERSION"
echo "   - Git pull: ✅"
echo "   - Dependencies: ✅"
echo "   - TypeScript build: ✅"
echo "   - PM2 restart: ✅"
echo ""
echo "🌐 Test your application: http://your-server:3000"
echo "📖 Check logs: pm2 logs billing-system"
echo ""

