#!/bin/bash
# Billing App Deployment Script
# Usage: ./deploy.sh

echo "----------------------------------------"
echo "🚀 STARTING DEPLOYMENT"
echo "----------------------------------------"

# 1. Update Code
echo "📥 Pulling latest code..."
git pull origin main
if [ $? -ne 0 ]; then
    echo "❌ Git Pull Failed!"
    exit 1
fi

# 2. Install Dependencies
echo "📦 Installing Dependencies..."
npm install

# 3. Build Project
echo "🔨 Compiling TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build Failed!"
    exit 1
fi

# 4. Run Database Migrations (Critical!)
echo "💾 Running Database Migrations..."
node scripts/run_migration.js

# 5. Restart Application
echo "🔄 Reloading PM2..."
if pm2 list | grep -q "billing-app"; then
    pm2 reload billing-app
else
    echo "ℹ️ App not running, starting it..."
    pm2 start dist/server.js --name billing-app
fi

echo "----------------------------------------"
echo "✅ DEPLOYMENT SUCCESSFUL"
echo "----------------------------------------"
