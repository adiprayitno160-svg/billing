#!/bin/bash
set -e # Exit on error

# Configuration
# Change this if your app is in a different folder
APP_DIR="/var/www/billing"
BRANCH="main"

echo "=========================================="
echo "🚀 Starting Deployment for Version 2.4.16"
echo "=========================================="

# 1. Navigate to Project Directory
if [ -d "$APP_DIR" ]; then
    cd $APP_DIR
    echo "✅ Navigated to $APP_DIR"
else
    echo "❌ Directory $APP_DIR not found. Please check configuration."
    exit 1
fi

# 2. Pull Latest Code
echo "📥 Pulling latest changes from git..."
git fetch origin
git reset --hard origin/$BRANCH
git clean -fd # Optional: Clean untracked files

# 3. Install Dependencies (Include DevDeps for Build)
echo "📦 Installing modules..."
npm install

# 4. Build Project
echo "🛠️  Building code..."
npm run build

# 5. Prune Dev Dependencies (Optional - save space)
# echo "🧹 Pruning dev dependencies..."
# npm prune --production

# 5. Database Information
echo "------------------------------------------"
echo "⚠️  DATABASE SCHEMA UPDATE"
echo "   A new schema definition is available at:"
echo "   database_updates/schema_v2.4.16.sql"
echo ""
echo "   NOTE: This is a full schema dump."
echo "   - For NEW installations: Import it directly."
echo "   - For EXISTING installations: Compare it with your database"
echo "     and apply only the necessary ALTER TABLE commands."
echo "------------------------------------------"

# 6. Restart PM2 Service
echo "🔄 Restarting Service..."
if command -v pm2 &> /dev/null; then
    pm2 restart billing || pm2 start dist/server.js --name billing
    echo "✅ Service restarted."
else
    echo "⚠️  PM2 not found. Please restart node manually."
fi

echo "=========================================="
echo "✅ DEPLOYMENT FINISHED SUCCESSFULLY"
echo "=========================================="
