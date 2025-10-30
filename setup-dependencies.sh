#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🔧 SETUP DEPENDENCIES (Fix: tsc not found)
# ═══════════════════════════════════════════════════════════════════════════
# Script untuk install semua dependencies yang diperlukan
# Termasuk TypeScript compiler (tsc) yang missing
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  🔧 SETUP DEPENDENCIES & FIX MISSING PACKAGES                             ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo "✅ node found: $(node --version)"
echo ""

# Step 1: Clean install
echo "1️⃣  Cleaning node_modules and package-lock.json..."
rm -rf node_modules
rm -f package-lock.json
echo "✅ Cleaned"
echo ""

# Step 2: Install all dependencies
echo "2️⃣  Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 3: Verify TypeScript
echo "3️⃣  Verifying TypeScript..."
if command -v npx &> /dev/null; then
    TSC_VERSION=$(npx tsc --version)
    echo "✅ TypeScript found: $TSC_VERSION"
else
    echo "❌ TypeScript not found. Installing globally..."
    npm install -g typescript
fi
echo ""

# Step 4: Build project
echo "4️⃣  Building project..."
npm run build
echo "✅ Build completed"
echo ""

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ SETUP COMPLETED!                                                      ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next steps:"
echo "   1. Run: pm2 start ecosystem.config.js --env production"
echo "   2. Or: pm2 restart billing-system"
echo ""

