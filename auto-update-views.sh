#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 AUTO-UPDATE VIEWS ONLY (Tanpa Rebuild TypeScript)
# ═══════════════════════════════════════════════════════════════════════════
# Script ini untuk update VIEW FILES (EJS, CSS) tanpa perlu rebuild TypeScript
# Cocok untuk hotfix UI/frontend yang tidak mengubah backend code
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  🚀 AUTO-UPDATE VIEWS ONLY (No TypeScript Rebuild)                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the correct directory?"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Backup current views (optional, for safety)
echo "1️⃣  Creating backup of current views..."
BACKUP_DIR="backups/views-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ -d "views" ]; then
    cp -r views "$BACKUP_DIR/"
    echo "✅ Backup created: $BACKUP_DIR"
else
    echo "⚠️  No views directory found to backup"
fi
echo ""

# Step 2: Git pull (only views and public files)
echo "2️⃣  Pulling latest changes from GitHub..."
git fetch origin main

# Only update views and public directories
git checkout origin/main -- views/ public/ VERSION

echo "✅ Views and public files updated from GitHub"
echo ""

# Step 3: Read new version
if [ -f "VERSION" ]; then
    NEW_VERSION=$(cat VERSION)
    echo "📦 New version: $NEW_VERSION"
else
    echo "⚠️  VERSION file not found"
fi
echo ""

# Step 4: Restart PM2 (optional, only if needed)
read -p "🔄 Restart PM2 process? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "4️⃣  Restarting PM2..."
    pm2 restart billing-system
    echo "✅ PM2 restarted"
else
    echo "⏭️  Skipping PM2 restart"
fi
echo ""

# Step 5: Show changes
echo "5️⃣  Files updated:"
git diff HEAD origin/main --stat -- views/ public/
echo ""

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ AUTO-UPDATE COMPLETED!                                                ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Summary:"
echo "   - Views updated: ✅"
echo "   - Public files updated: ✅"
echo "   - TypeScript rebuild: ❌ (not needed for view-only updates)"
echo "   - Version: $NEW_VERSION"
echo ""
echo "🌐 Test your application: http://your-server:3000"
echo ""

