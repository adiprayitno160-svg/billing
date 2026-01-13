#!/bin/bash

# ========================================
# AUTOMATIC UPDATE SCRIPT FOR BILLING APP
# ========================================

# Configuration
APP_DIR="/var/www/billing"
APP_NAME="billing-app"
LOG_FILE="$APP_DIR/logs/update.log"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# START UPDATE
echo "========================================"
echo "    UPDATE STARTING... "
echo "========================================"

# Check if directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Error: Directory $APP_DIR not found!"
    exit 1
fi

cd "$APP_DIR" || exit

log "📂 Changed directory to $APP_DIR"

# 1. GIT PULL
log "⬇️  Pulling latest version from git..."
git reset --hard
git pull origin main

if [ $? -ne 0 ]; then
    log "❌ Git pull failed!"
    exit 1
fi

# 2. INSTALL DEPENDENCIES
log "📦 Installing dependencies from package.json..."
npm install --production=false # Install dev deps too for building

# 3. BUILD PROJECT
log "🔨 Building TypeScript project..."
npm run build

if [ $? -ne 0 ]; then
    log "❌ Build failed! Aborting update."
    exit 1
fi

# 4. DATABASE MIGRATION (Optional/Safety)
# log "🗄️ Running database migrations..."
# npm run migrate 

# 5. RESTART PM2
log "🔄 Restarting PM2 process: $APP_NAME..."
pm2 reload "$APP_NAME" --update-env

# 6. STATUS CHECK
log "✅ Update finished successfully!"
echo "========================================"
echo "    UPDATE COMPLETED SUCCESSFULLY"
echo "========================================"
pm2 status "$APP_NAME"

exit 0
