#!/bin/bash

################################################################################
# 🏥 Health Check Script - Billing System
# Monitoring kesehatan aplikasi dan notifikasi otomatis
# Usage: bash health-check.sh
# Cron: */5 * * * * /usr/local/bin/health-check.sh >> /var/log/billing-health.log 2>&1
################################################################################

# Configuration
APP_DIR="/www/wwwroot/billing"
PM2_APP_NAME="billing-system"
APP_PORT="3000"
LOG_FILE="/var/log/billing-health.log"
MAX_RESPONSE_TIME=5000  # milliseconds

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

# Send Telegram notification (if configured)
send_telegram_notification() {
    local message="$1"
    
    if [ -f "$APP_DIR/.env" ]; then
        TELEGRAM_BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN "$APP_DIR/.env" | cut -d'=' -f2)
        TELEGRAM_CHAT_ID=$(grep TELEGRAM_CHAT_ID "$APP_DIR/.env" | cut -d'=' -f2)
        
        if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
            curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
                -d "chat_id=$TELEGRAM_CHAT_ID" \
                -d "text=$message" \
                -d "parse_mode=HTML" > /dev/null
        fi
    fi
}

# Auto-restart function
auto_restart() {
    log_warning "Attempting to restart application..."
    
    cd "$APP_DIR"
    pm2 restart $PM2_APP_NAME
    
    sleep 5
    
    # Check if restart successful
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        log_success "Application restarted successfully"
        send_telegram_notification "🔄 <b>Billing System Auto-Restart</b>%0A%0AApplication was down and has been restarted automatically.%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
        return 0
    else
        log_error "Restart failed!"
        send_telegram_notification "🚨 <b>CRITICAL: Billing System Down!</b>%0A%0AApplication restart failed!%0AManual intervention required.%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
        return 1
    fi
}

# Start health check
log "========================================"
log "Health Check Started"
log "========================================"

# Check 1: PM2 Process Status
log "Checking PM2 process..."
if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
    log_success "PM2 process is running"
else
    log_error "PM2 process is not running!"
    
    # Attempt auto-restart
    auto_restart
    exit 1
fi

# Check 2: Application Port
log "Checking application port $APP_PORT..."
if netstat -tuln | grep -q ":$APP_PORT "; then
    log_success "Port $APP_PORT is listening"
else
    log_error "Port $APP_PORT is not listening!"
    
    # Attempt auto-restart
    auto_restart
    exit 1
fi

# Check 3: HTTP Response
log "Checking HTTP response..."
START_TIME=$(date +%s%3N)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:$APP_PORT" 2>/dev/null)
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    log_success "HTTP response: $HTTP_CODE (${RESPONSE_TIME}ms)"
    
    if [ "$RESPONSE_TIME" -gt "$MAX_RESPONSE_TIME" ]; then
        log_warning "Response time is slow: ${RESPONSE_TIME}ms (threshold: ${MAX_RESPONSE_TIME}ms)"
        send_telegram_notification "⚠️ <b>Billing System Slow Response</b>%0A%0AResponse time: ${RESPONSE_TIME}ms%0AThreshold: ${MAX_RESPONSE_TIME}ms%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
    fi
else
    log_error "HTTP response error: $HTTP_CODE"
    
    # Attempt auto-restart
    auto_restart
    exit 1
fi

# Check 4: Database Connection
if [ -f "$APP_DIR/.env" ]; then
    log "Checking database connection..."
    
    DB_HOST=$(grep DB_HOST "$APP_DIR/.env" | cut -d'=' -f2)
    DB_PORT=$(grep DB_PORT "$APP_DIR/.env" | cut -d'=' -f2)
    DB_USER=$(grep DB_USER "$APP_DIR/.env" | cut -d'=' -f2)
    DB_PASS=$(grep DB_PASSWORD "$APP_DIR/.env" | cut -d'=' -f2)
    DB_NAME=$(grep DB_NAME "$APP_DIR/.env" | cut -d'=' -f2)
    
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -e "USE $DB_NAME; SELECT 1;" 2>/dev/null | grep -q "1"; then
        log_success "Database connection is OK"
    else
        log_error "Database connection failed!"
        send_telegram_notification "🚨 <b>Billing System Database Error</b>%0A%0ADatabase connection failed!%0ACheck MySQL service.%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
        exit 1
    fi
fi

# Check 5: Disk Space
log "Checking disk space..."
DISK_USAGE=$(df -h "$APP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$DISK_USAGE" -lt 80 ]; then
    log_success "Disk usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    log_warning "Disk usage is high: ${DISK_USAGE}%"
    send_telegram_notification "⚠️ <b>Billing System Disk Warning</b>%0A%0ADisk usage: ${DISK_USAGE}%%25%0AConsider cleaning up old files.%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
else
    log_error "Disk usage is critical: ${DISK_USAGE}%"
    send_telegram_notification "🚨 <b>Billing System Disk Critical!</b>%0A%0ADisk usage: ${DISK_USAGE}%%25%0AImmediate action required!%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
fi

# Check 6: Memory Usage
log "Checking memory usage..."
MEM_TOTAL=$(free -m | awk 'NR==2 {print $2}')
MEM_USED=$(free -m | awk 'NR==2 {print $3}')
MEM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))

if [ "$MEM_PERCENT" -lt 80 ]; then
    log_success "Memory usage: ${MEM_PERCENT}% (${MEM_USED}MB / ${MEM_TOTAL}MB)"
elif [ "$MEM_PERCENT" -lt 90 ]; then
    log_warning "Memory usage is high: ${MEM_PERCENT}%"
else
    log_error "Memory usage is critical: ${MEM_PERCENT}%"
    send_telegram_notification "🚨 <b>Billing System Memory Critical!</b>%0A%0AMemory usage: ${MEM_PERCENT}%%25%0AConsider restarting or upgrading.%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
fi

# Check 7: PM2 Memory & CPU
log "Checking PM2 metrics..."
PM2_MEM=$(pm2 jlist | grep -A 10 "$PM2_APP_NAME" | grep "memory" | awk -F': ' '{print $2}' | tr -d ',')
PM2_CPU=$(pm2 jlist | grep -A 10 "$PM2_APP_NAME" | grep "cpu" | awk -F': ' '{print $2}' | tr -d ',')

if [ -n "$PM2_MEM" ] && [ -n "$PM2_CPU" ]; then
    PM2_MEM_MB=$((PM2_MEM / 1024 / 1024))
    log_success "PM2 metrics - Memory: ${PM2_MEM_MB}MB, CPU: ${PM2_CPU}%"
    
    if [ "$PM2_MEM_MB" -gt 500 ]; then
        log_warning "Application memory usage is high: ${PM2_MEM_MB}MB"
    fi
fi

# Check 8: Log Files Size
log "Checking log files..."
if [ -d "$APP_DIR/logs" ]; then
    LOGS_SIZE=$(du -sh "$APP_DIR/logs" | cut -f1)
    log_success "Logs directory size: $LOGS_SIZE"
    
    # Clean old PM2 logs (keep last 7 days)
    find "$APP_DIR/logs" -name "*.log" -mtime +7 -delete 2>/dev/null
fi

# Check 9: Node.js Version
log "Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ -n "$NODE_VERSION" ]; then
    log_success "Node.js version: $NODE_VERSION"
else
    log_error "Node.js not found!"
fi

# Check 10: Git Status (optional)
if [ -d "$APP_DIR/.git" ]; then
    log "Checking git status..."
    cd "$APP_DIR"
    
    # Check for updates
    git fetch origin main 2>/dev/null
    LOCAL=$(git rev-parse @ 2>/dev/null)
    REMOTE=$(git rev-parse @{u} 2>/dev/null)
    
    if [ "$LOCAL" != "$REMOTE" ]; then
        log_warning "New version available on GitHub!"
        send_telegram_notification "ℹ️ <b>Billing System Update Available</b>%0A%0AA new version is available on GitHub.%0AConsider updating soon.%0ATime: $(date +'%Y-%m-%d %H:%M:%S')"
    else
        log_success "Application is up to date"
    fi
fi

# Summary
log "========================================"
log_success "Health Check Completed Successfully"
log "========================================"

# Return success
exit 0

