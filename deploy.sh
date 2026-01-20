
#!/bin/bash

# Configuration
APP_DIR="/var/www/billing" # Change this to your actual app directory on the server
BRANCH="main"

echo "🚀 Starting Deployment..."

# Navigate to app directory
cd $APP_DIR || { echo "❌ Directory not found: $APP_DIR"; exit 1; }

# Pull latest changes
echo "📥 Pulling latest changes from git..."
git fetch origin
git reset --hard origin/$BRANCH

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build application (if using TypeScript)
echo "🔨 Building application..."
npm run build 

# Restart PM2
echo "🔄 Restarting application..."
pm2 restart billing-app || pm2 restart all

echo "✅ Deployment Complete!"
