#!/bin/bash

# Interface Traffic Realtime - Auto-Recovery Deployment Script
# For Linux/Production Server

set -e

echo "========================================"
echo "  FIX: Interface Traffic Realtime"
echo "  Auto-Recovery Deployment"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on production server
if [ ! -d "/var/www/billing" ]; then
    log_error "Not on production server. Run DEPLOY_INTERFACE_TRAFFIC_FIX.bat for local."
    exit 1
fi

cd /var/www/billing

log_info "Step 1/6: Pulling latest changes from Git..."
git pull origin main
log_success "Git pull completed"

log_info "Step 2/6: Backing up current build..."
if [ -d "dist.backup" ]; then
    rm -rf dist.backup
fi
cp -r dist dist.backup
log_success "Backup created"

log_info "Step 3/6: Installing dependencies..."
npm install --production
log_success "Dependencies installed"

log_info "Step 4/6: Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    log_error "Build failed! Restoring backup..."
    rm -rf dist
    mv dist.backup dist
    exit 1
fi
log_success "Build completed"

log_info "Step 5/6: Checking PM2 process..."
if ! pm2 list | grep -q "billing-system"; then
    log_warning "PM2 process not found. Starting new instance..."
    pm2 start ecosystem.config.js --env production
else
    log_info "Restarting PM2 process..."
    pm2 restart billing-system
fi
log_success "PM2 process running"

log_info "Step 6/6: Verifying deployment..."
sleep 3
if pm2 list | grep -q "billing-system.*online"; then
    log_success "Deployment successful!"
else
    log_error "Deployment may have issues. Check PM2 logs:"
    log_warning "pm2 logs billing-system"
    exit 1
fi

echo ""
echo "========================================"
echo "  DEPLOYMENT COMPLETED"
echo "========================================"
echo ""
echo "✅ Changes Applied:"
echo "  - Request timeout protection (3s)"
echo "  - Caching mechanism (5s)"
echo "  - Auto-recovery on failures"
echo "  - Optimized error handling"
echo ""
echo "🧪 Testing Checklist:"
echo "  1. Open: http://YOUR_SERVER/prepaid/dashboard"
echo "  2. Select interface for monitoring"
echo "  3. Click 'Start Monitor'"
echo "  4. Verify chart updates every 2 seconds"
echo "  5. Test auto-recovery (disconnect MikroTik briefly)"
echo ""
echo "📊 Monitoring Commands:"
echo "  - View logs:    pm2 logs billing-system"
echo "  - Check status: pm2 status"
echo "  - Restart:      pm2 restart billing-system"
echo ""
echo "📝 Rollback (if needed):"
echo "  cd /var/www/billing"
echo "  rm -rf dist"
echo "  mv dist.backup dist"
echo "  pm2 restart billing-system"
echo ""
echo "========================================"

# Cleanup backup after 10 minutes
(sleep 600 && rm -rf /var/www/billing/dist.backup 2>/dev/null) &

log_success "All done! Interface Traffic Realtime is now optimized."




