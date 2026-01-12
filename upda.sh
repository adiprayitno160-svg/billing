#!/bin/bash

# --- CONFIGURATION ---
APP_NAME="billing-app"
echo "🚀 Starting Update Process for $APP_NAME..."

# 1. Pull latest changes from Git
echo "📦 Pulling latest changes from GitHub..."
git pull origin main

# 2. Install dependencies
echo "🔍 Installing dependencies..."
npm install

# 3. Build project
echo "🏗️  Building project (TypeScript to JavaScript)..."
npm run build

# 4. Restart application
echo "🔄 Restarting application with PM2..."
pm2 restart $APP_NAME

echo "✅ Update successfully completed!"
