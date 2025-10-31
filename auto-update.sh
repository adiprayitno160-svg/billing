#!/bin/bash

# Script untuk auto-update aplikasi dari GitHub
# Bisa dijalankan via cron job atau webhook

APP_PATH="/opt/billing"
LOG_FILE="/opt/billing/logs/auto-update.log"

# Buat log directory jika belum ada
mkdir -p "$(dirname "$LOG_FILE")"

# Fungsi untuk logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Starting auto-update process ==="

cd "$APP_PATH" || exit 1

# Check if there are updates
log "Checking for updates from GitHub..."
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "No updates available. Already up to date."
    exit 0
fi

log "Updates found! Starting deployment..."

# Fix permissions (if needed)
log "Fixing permissions..."
su -c "chown -R adi:adi $APP_PATH" root <<EOF
root
EOF

# Pull latest changes
log "Pulling latest changes..."
git pull origin main || {
    log "ERROR: Git pull failed!"
    exit 1
}

# Install dependencies (if package.json changed)
log "Installing dependencies..."
npm install || {
    log "WARNING: npm install had issues, continuing anyway..."
}

# Build application
log "Building application..."
npm run build || {
    # Try with skipLibCheck if normal build fails
    log "Normal build failed, trying with skipLibCheck..."
    npx tsc --skipLibCheck || {
        log "Build with skipLibCheck failed, trying transpileOnly..."
        npx tsc --transpileOnly --skipLibCheck || {
            log "WARNING: Build had errors, but continuing..."
        }
    }
}

# Build CSS
log "Building CSS..."
npm run css:build || {
    log "WARNING: CSS build had issues, continuing anyway..."
}

# Reload PM2
log "Reloading PM2 application..."
if pm2 list | grep -q "billing-app"; then
    pm2 reload billing-app || {
        log "PM2 reload failed, trying restart..."
        pm2 restart billing-app || {
            log "ERROR: PM2 reload/restart failed!"
            exit 1
        }
    }
else
    log "PM2 app not found, starting..."
    pm2 start ecosystem.config.js --env production || {
        pm2 start dist/server.js --name billing-app || {
            log "ERROR: Failed to start PM2 application!"
            exit 1
        }
    }
fi

log "=== Auto-update completed successfully ==="
pm2 list

