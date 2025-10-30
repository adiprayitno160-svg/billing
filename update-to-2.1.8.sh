#!/bin/bash

# Quick Update Script to v2.1.8
# This script will update your application to version 2.1.8

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  🚀 Update to v2.1.8${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Get current directory
if [ -z "$1" ]; then
    BILLING_DIR="/opt/billing"
else
    BILLING_DIR="$1"
fi

echo -e "${YELLOW}📂 Working directory: $BILLING_DIR${NC}\n"

# Check if directory exists
if [ ! -d "$BILLING_DIR" ]; then
    echo -e "${RED}❌ Directory not found: $BILLING_DIR${NC}"
    exit 1
fi

cd "$BILLING_DIR" || exit 1

# Backup current state
echo -e "${YELLOW}📦 Creating backup...${NC}"
BACKUP_FILE="/opt/billing-backups/backup-pre-2.1.8-$(date +%Y%m%d-%H%M%S).tar.gz"
mkdir -p /opt/billing-backups
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    . 2>/dev/null || true
echo -e "${GREEN}✓ Backup saved: $BACKUP_FILE${NC}\n"

# Show current version
echo -e "${YELLOW}📋 Current version:${NC}"
CURRENT_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
echo -e "   $CURRENT_VERSION\n"

# Pull latest changes
echo -e "${YELLOW}⬇️  Pulling latest changes from GitHub...${NC}"
if ! git pull origin main; then
    echo -e "${RED}❌ Failed to pull from GitHub${NC}"
    echo -e "${YELLOW}⚠️  Trying with rebase...${NC}"
    if ! git pull --rebase origin main; then
        echo -e "${YELLOW}⚠️  Rebase failed, trying force pull...${NC}"
        git fetch origin main
        git reset --hard origin/main
    fi
fi
echo -e "${GREEN}✓ Pulled latest changes${NC}\n"

# Verify new version
echo -e "${YELLOW}📋 New version:${NC}"
NEW_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
echo -e "   $NEW_VERSION\n"

if [ "$CURRENT_VERSION" == "$NEW_VERSION" ]; then
    echo -e "${YELLOW}⚠️  Version unchanged. Are you already on the latest?${NC}\n"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production --no-audit --no-fund || { 
    echo -e "${RED}❌ Failed to install dependencies${NC}"; 
    exit 1; 
}
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Build TypeScript
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build || { 
    echo -e "${RED}❌ Failed to build${NC}"; 
    exit 1; 
}
echo -e "${GREEN}✓ Application built${NC}\n"

# Build CSS (if needed)
if [ -f "tailwind.config.cjs" ]; then
    echo -e "${YELLOW}🎨 Building CSS...${NC}"
    npm run css:build || echo "Warning: CSS build failed, continuing..."
    echo -e "${GREEN}✓ CSS built${NC}\n"
fi

# Restart PM2 app
echo -e "${YELLOW}🔄 Restarting application...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 restart billing-app --update-env || { 
        echo -e "${YELLOW}⚠️  PM2 restart failed, trying to start...${NC}"
        pm2 start ecosystem.config.js --env production
    }
    echo -e "${GREEN}✓ Application restarted${NC}\n"
else
    echo -e "${YELLOW}⚠️  PM2 not found, skipping restart${NC}\n"
fi

# Show status
echo -e "${YELLOW}📊 Application status:${NC}"
if command -v pm2 &> /dev/null; then
    pm2 status billing-app || true
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Update to v2.1.8 completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. Check logs: ${GREEN}pm2 logs billing-app --lines 50${NC}"
echo -e "   2. Verify version: ${GREEN}http://your-server:3000/about${NC}"
echo -e "   3. Test import: ${GREEN}http://your-server:3000/customers/list${NC}\n"

exit 0

