#!/bin/bash
# Simple Update Script untuk Billing System
# Version: 2.3.14

echo "🚀 Starting update to v2.3.14..."

# Pull latest version
echo "📥 Pulling latest code from GitHub..."
git fetch --tags
git checkout v2.3.14

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build application
echo "🔨 Building application..."
npm run build

# Restart PM2
echo "🔄 Restarting application..."
pm2 restart billing-app

# Save PM2 config
pm2 save

echo "✅ Update completed successfully!"
echo "📊 Current version: 2.3.14"
echo ""
echo "Don't forget to run the database migration:"
echo "mysql -u root -p billing_db < migration.sql"
