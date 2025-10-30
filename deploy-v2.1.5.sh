#!/bin/bash

# ========================================
# Deploy Script v2.1.5
# ========================================
# Script untuk deploy versi 2.1.5 ke server
# Fixes: Version display & Hotfix checker
# ========================================

echo "🚀 Starting deployment v2.1.5..."
echo ""

# 1. Git pull latest
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Check if pull was successful
if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!"
    exit 1
fi

echo "✅ Git pull successful"
echo ""

# 2. Verify version files
echo "🔍 Verifying version files..."
echo "VERSION: $(cat VERSION)"
echo "VERSION_MAJOR: $(cat VERSION_MAJOR)"
echo "VERSION_HOTFIX: $(cat VERSION_HOTFIX)"
echo ""

# 3. Install dependencies (if needed)
echo "📦 Checking dependencies..."
if [ -f "package.json" ]; then
    npm install --production
    echo "✅ Dependencies checked"
else
    echo "⚠️  package.json not found, skipping npm install"
fi
echo ""

# 4. Build TypeScript
echo "🔨 Building TypeScript..."
if [ -d "src" ]; then
    npm run build
    if [ $? -eq 0 ]; then
        echo "✅ Build successful"
    else
        echo "⚠️  Build failed, but continuing..."
    fi
else
    echo "⚠️  src directory not found, skipping build"
fi
echo ""

# 5. Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart billing

if [ $? -eq 0 ]; then
    echo "✅ PM2 restart successful"
else
    echo "❌ PM2 restart failed!"
    exit 1
fi
echo ""

# 6. Show PM2 status
echo "📊 PM2 Status:"
pm2 list | grep billing
echo ""

# 7. Show logs (last 20 lines)
echo "📋 Recent logs:"
pm2 logs billing --lines 20 --nostream
echo ""

echo "========================================
✅ Deployment v2.1.5 Complete!
========================================"
echo ""
echo "🔍 Verify by visiting:"
echo "   http://your-server/about"
echo ""
echo "Expected version: 2.1.5"
echo ""
echo "📝 Changes in this version:"
echo "  - Fixed version display (VERSION_MAJOR updated)"
echo "  - Fixed hotfix checker (no more JSON.parse errors)"
echo "  - Improved Excel import for production"
echo "  - Bulk delete customers with validation"
echo ""


