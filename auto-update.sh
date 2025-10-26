#!/bin/bash

################################################################################
# 🔄 Auto Update Script - Billing System
# Script untuk otomatis update aplikasi dari GitHub
# Usage: bash auto-update.sh
# Atau via cron: 0 2 * * * /www/wwwroot/billing/auto-update.sh >> /var/log/billing-update.log 2>&1
################################################################################

# Configuration
APP_DIR="${APP_DIR:-/www/wwwroot/billing}"
PM2_APP_NAME="billing-system"
BACKUP_DIR="/www/backup/billing"
LOG_FILE="/var/log/billing-update.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

# Start update process
log "========================================"
log "Auto Update Started"
log "========================================"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    log_error "Application directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# Check if git repository
if [ ! -d ".git" ]; then
    log_error "Not a git repository: $APP_DIR"
    exit 1
fi

# Fetch latest changes
log "Fetching latest changes from GitHub..."
git fetch origin main 2>&1 | tee -a "$LOG_FILE"

# Check if there are updates
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
    log_success "Already up to date. No update needed."
    exit 0
fi

log_warning "New version detected. Starting update process..."

# Create backup before update
log "Creating backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/auto_backup_$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='logs' \
    --exclude='whatsapp-session' \
    -C "$(dirname "$APP_DIR")" \
    "$(basename "$APP_DIR")" 2>&1 | tee -a "$LOG_FILE"

if [ $? -eq 0 ]; then
    log_success "Backup created: $BACKUP_FILE"
else
    log_error "Backup failed!"
    exit 1
fi

# Pull latest changes
log "Pulling latest changes..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    log_error "Git pull failed!"
    exit 1
fi

# Check if package.json changed
if git diff --name-only $LOCAL $REMOTE | grep -q "package.json"; then
    log "package.json changed, installing dependencies..."
    npm install --production 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -ne 0 ]; then
        log_error "npm install failed!"
        log "Rolling back..."
        git reset --hard $LOCAL
        exit 1
    fi
fi

# Build application
log "Building application..."
npm run build 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    log_error "Build failed!"
    log "Rolling back..."
    git reset --hard $LOCAL
    exit 1
fi

# Restart application
log "Restarting application with PM2..."
pm2 restart $PM2_APP_NAME 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    log_error "PM2 restart failed!"
    exit 1
fi

# Wait and check if app is running
sleep 5

if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
    log_success "Application restarted successfully"
else
    log_error "Application not running after restart!"
    log "Rolling back..."
    
    # Restore backup
    cd "$(dirname "$APP_DIR")"
    rm -rf "$APP_DIR"
    tar -xzf "$BACKUP_FILE"
    
    cd "$APP_DIR"
    pm2 restart $PM2_APP_NAME
    
    exit 1
fi

# Cleanup old backups (keep last 5)
log "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t auto_backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
log_success "Old backups cleaned"

# Send notification (optional - requires telegram bot configured)
if [ -f "$APP_DIR/.env" ]; then
    TELEGRAM_BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN "$APP_DIR/.env" | cut -d'=' -f2)
    TELEGRAM_CHAT_ID=$(grep TELEGRAM_CHAT_ID "$APP_DIR/.env" | cut -d'=' -f2)
    
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        MESSAGE="🔄 Billing System Auto-Update Berhasil%0A%0ATime: $(date +'%Y-%m-%d %H:%M:%S')%0AVersion: $(git rev-parse --short HEAD)"
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID&text=$MESSAGE" > /dev/null
    fi
fi

log_success "========================================"
log_success "Auto Update Completed Successfully"
log_success "========================================"

exit 0

