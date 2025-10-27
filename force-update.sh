#!/bin/bash

# Force Update Script - Use when normal update fails
# This script will force reset local changes and pull from GitHub

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  FORCE UPDATE - This will discard all local changes!${NC}\n"

cd /opt/billing || exit 1

# Backup current state
echo -e "${YELLOW}📦 Creating emergency backup...${NC}"
BACKUP_FILE="/opt/billing-backups/emergency-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
mkdir -p /opt/billing-backups
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    . 2>/dev/null || true
echo -e "${GREEN}✓ Backup saved: $BACKUP_FILE${NC}\n"

# Show modified files
echo -e "${YELLOW}Modified files that will be discarded:${NC}"
git status --short
echo ""

read -p "Continue with force update? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Aborted"
    exit 0
fi

# Reset everything
echo -e "${YELLOW}🔄 Resetting local changes...${NC}"
git reset --hard HEAD
git clean -fd
echo -e "${GREEN}✓ Local changes discarded${NC}\n"

# Fetch and reset to remote
echo -e "${YELLOW}📥 Fetching from GitHub...${NC}"
git fetch origin --tags
echo -e "${GREEN}✓ Fetched${NC}\n"

# Force reset to origin/main
echo -e "${YELLOW}⬇️  Force updating to latest...${NC}"
git reset --hard origin/main
echo -e "${GREEN}✓ Updated to latest${NC}\n"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Build
echo -e "${YELLOW}🔨 Building...${NC}"
npm run build
npm run css:build 2>/dev/null || true
echo -e "${GREEN}✓ Built${NC}\n"

# Restart
echo -e "${YELLOW}🔄 Restarting...${NC}"
pm2 restart billing-app || pm2 start ecosystem.config.js --env production
echo -e "${GREEN}✓ Restarted${NC}\n"

NEW_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
echo -e "${GREEN}✅ Force update completed!${NC}"
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

exit 0

