#!/bin/bash

# ========================================================
# AUTO UPDATE SCRIPT FOR BILLING SYSTEM
# ========================================================

echo "========================================================"
echo "   STARTING UPDATE PROCCESS - BILLING SYSTEM"
echo "========================================================"

# 1. Pull latest changes from git
echo ""
echo "[1/5] Pulling changes from repository..."
git pull origin main

# 2. Install dependencies
echo ""
echo "[2/5] Installing new dependencies..."
npm install

# 3. Build the application
echo ""
echo "[3/5] Building application (TypeScript)..."
npm run build

# 4. Build CSS (Tailwind)
echo ""
echo "[4/5] Building TailwindCSS..."
npm run css:build

# 5. Restart PM2 process
echo ""
echo "[5/5] Restarting PM2 process..."
# Check if PM2 is running 'billing-app'
if pm2 list | grep -q "billing-app"; then
    pm2 reload billing-app
    echo "✅ PM2 Process 'billing-app' reloaded successfully."
else
    echo "⚠️  PM2 process 'billing-app' not found. Starting it now..."
    npm run pm2:start
fi

echo ""
echo "========================================================"
echo "   UPDATE COMPLETED SUCCESSFULLY! 🚀"
echo "========================================================"
