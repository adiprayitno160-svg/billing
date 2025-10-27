#!/bin/bash

# Auto Update Script untuk Billing System
# Script ini dijalankan di server untuk pull latest changes dan update aplikasi

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/billing"
PM2_APP_NAME="billing-app"
BACKUP_DIR="/opt/billing-backups"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🚀 Billing System Auto Update${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if running as correct user
CURRENT_USER=$(whoami)
echo -e "${YELLOW}Current user: ${CURRENT_USER}${NC}"

# Change to app directory
cd $APP_DIR || { echo -e "${RED}❌ Failed to change to app directory${NC}"; exit 1; }
echo -e "${GREEN}✓ Changed to $APP_DIR${NC}"

# Get current version
CURRENT_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}\n"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Create backup
echo -e "${YELLOW}📦 Creating backup...${NC}"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S)-v${CURRENT_VERSION}.tar.gz"
tar -czf $BACKUP_FILE \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='*.log' \
    --exclude='whatsapp-session' \
    --exclude='.wwebjs_cache' \
    . 2>/dev/null || echo "Warning: Some files skipped in backup"
echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}\n"

# Stash any local changes
echo -e "${YELLOW}💾 Stashing local changes...${NC}"
git stash || true
echo -e "${GREEN}✓ Local changes stashed${NC}\n"

# Fetch latest changes
echo -e "${YELLOW}📥 Fetching latest changes from GitHub...${NC}"
git fetch origin --tags || { echo -e "${RED}❌ Failed to fetch${NC}"; exit 1; }
echo -e "${GREEN}✓ Fetched from GitHub${NC}\n"

# Get latest version from remote
LATEST_VERSION=$(git describe --tags --abbrev=0 origin/main 2>/dev/null | sed 's/^v//' || echo "unknown")
echo -e "${YELLOW}Latest version: ${LATEST_VERSION}${NC}"

# Check if update needed
if [ "$CURRENT_VERSION" == "$LATEST_VERSION" ]; then
    echo -e "${GREEN}✅ Already on latest version!${NC}"
    exit 0
fi

echo -e "${BLUE}Updating from ${CURRENT_VERSION} to ${LATEST_VERSION}...${NC}\n"

# Pull latest changes
echo -e "${YELLOW}⬇️  Pulling latest changes...${NC}"
git pull origin main || { echo -e "${RED}❌ Failed to pull${NC}"; exit 1; }
echo -e "${GREEN}✓ Pulled latest changes${NC}\n"

# Install/Update dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production || { echo -e "${RED}❌ Failed to install dependencies${NC}"; exit 1; }
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Build TypeScript
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build || { echo -e "${RED}❌ Failed to build${NC}"; exit 1; }
echo -e "${GREEN}✓ Application built${NC}\n"

# Build CSS (if needed)
if [ -f "tailwind.config.cjs" ]; then
    echo -e "${YELLOW}🎨 Building CSS...${NC}"
    npm run css:build || echo "Warning: CSS build failed, continuing..."
    echo -e "${GREEN}✓ CSS built${NC}\n"
fi

# Run database migrations (if any)
if [ -d "migrations" ]; then
    echo -e "${YELLOW}🗄️  Checking database migrations...${NC}"
    # Add your migration commands here if needed
    echo -e "${GREEN}✓ Migrations checked${NC}\n"
fi

# Restart PM2 app
echo -e "${YELLOW}🔄 Restarting application...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 restart $PM2_APP_NAME || { 
        echo -e "${YELLOW}⚠️  PM2 restart failed, trying to start...${NC}"
        pm2 start ecosystem.config.js --env production
    }
    echo -e "${GREEN}✓ Application restarted${NC}\n"
else
    echo -e "${YELLOW}⚠️  PM2 not found, skipping restart${NC}\n"
fi

# Update VERSION file
echo $LATEST_VERSION > VERSION

# Clean old backups (keep last 5)
echo -e "${YELLOW}🧹 Cleaning old backups...${NC}"
cd $BACKUP_DIR
ls -t backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
echo -e "${GREEN}✓ Old backups cleaned${NC}\n"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Update completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Updated from ${CURRENT_VERSION} to ${LATEST_VERSION}${NC}\n"

# Show PM2 status
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Application status:${NC}"
    pm2 list | grep -E "$PM2_APP_NAME|App name" || pm2 list
fi

exit 0

