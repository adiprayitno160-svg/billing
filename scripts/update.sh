#!/bin/bash

# Configuration
APP_DIR="/var/www/billing"
PM2_APP_NAME="billing-app"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   🚀 Billing App Updater System        ${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Date: $(date)"

# Check which user is running
echo -e "${YELLOW}Running as user: $(whoami)${NC}"

# 1. Go to App Directory
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    echo -e "${GREEN}✅ Active directory: $APP_DIR${NC}"
else
    echo -e "${RED}❌ Error: Directory $APP_DIR not found!${NC}"
    echo "Please edit APP_DIR in this script if your path is different."
    # Try current directory as fallback
    echo -e "${YELLOW}Trying current directory...${NC}"
    APP_DIR=$(pwd)
fi

# 2. Git Operations
echo -e "\n${YELLOW}📥 Fetching latest updates...${NC}"

# Check for local changes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Local changes detected. Stashing them to 'autoupdate_stash'...${NC}"
    git stash save "autoupdate_stash_$(date +%s)"
fi

git fetch origin main
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git pull failed! Please check your git configuration.${NC}"
    exit 1
fi

# 3. Dependencies
echo -e "\n${YELLOW}📦 Updating dependencies...${NC}"
npm install

# 4. Build
echo -e "\n${YELLOW}🔨 Building project...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed! Aborting restart.${NC}"
    exit 1
fi

# 5. Fix Permissions (Optional but often needed on basic VPS)
# chmod -R 755 dist

# 6. Process Management
echo -e "\n${YELLOW}🔄 Restarting application...${NC}"
pm2 reload $PM2_APP_NAME || pm2 start dist/server.js --name $PM2_APP_NAME

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}   ✅ Update Completed Successfully!    ${NC}"
    echo -e "${GREEN}========================================${NC}"
    pm2 status $PM2_APP_NAME
    
    # Show logs briefly to confirm startup
    echo -e "\n${YELLOW}Recent Logs:${NC}"
    pm2 logs $PM2_APP_NAME --lines 10 --nostream
else
    echo -e "${RED}❌ Failed to restart PM2 process.${NC}"
    exit 1
fi
