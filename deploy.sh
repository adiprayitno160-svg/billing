#!/bin/bash
# Billing App Deployment Script for Ubuntu

echo "----------------------------------------"
echo "🚀 STARTING DEPLOYMENT"
date
echo "----------------------------------------"

# 1. Update Code from GitHub
echo "📥 Pulling latest code from 'main'..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git Pull Failed! Please check your internet connection or git status."
    exit 1
fi

# 2. Install Dependencies
echo "📦 Installing Node Dependencies..."
npm install

# 3. Build TypeScript Project
echo "🔨 Compiling TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build Failed!"
    exit 1
fi

# 4. Run Database Migration (Safe Mode)
echo "💾 Running Database Migrations..."
node scripts/run_migration.js

# 5. Reload PM2 Process
echo "🔄 Reloading Application..."
if pm2 list | grep -q "billing-app"; then
    pm2 reload billing-app
else
    echo "ℹ️ App not running, starting it..."
    pm2 start dist/server.js --name billing-app
fi

echo "----------------------------------------"
echo "✅ DEPLOYMENT FINISHED SUCCESSFULLY"
echo "----------------------------------------"
