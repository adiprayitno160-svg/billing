#!/bin/bash

#################################################
# Billing App - Quick Update Script
# Usage: bash update.sh
#################################################

set -e

APP_DIR="/var/www/billing"
BRANCH="main"

echo "🔄 Billing App - Quick Update"
echo "=============================="

cd "$APP_DIR"

echo "📥 Pulling latest changes..."
git fetch origin
git reset --hard origin/$BRANCH
git pull origin $BRANCH

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "🔄 Restarting PM2..."
pm2 restart billing-app

echo ""
echo "✅ Update completed!"
echo ""
pm2 status billing-app
