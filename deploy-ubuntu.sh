#!/bin/bash

# Configuration
APP_DIR="/var/www/billing"
LOG_FILE="./deploy.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting deployment process...${NC}"

# 1. Update Code from Git
echo "Pulling latest changes from Git..."
cd $APP_DIR || exit
git fetch --all
git reset --hard origin/main
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}Git pull failed! Aborting deployment.${NC}"
    exit 1
fi

# 2. Cleanup & Install Dependencies
echo "Cleaning up old build..."
rm -rf dist/

echo "Installing/Updating dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}npm install failed! Aborting deployment.${NC}"
    exit 1
fi

# 3. Build Application
echo "Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed! Aborting deployment.${NC}"
    exit 1
fi

# 4. Global Link (Optional for CLI tools)
# npm link

# 5. Restart PM2 Service
echo "Restarting application via PM2..."
# If not running, start it. If running, reload/restart.
if pm2 list | grep -q "billing-app"; then
    pm2 reload ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js --env production
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}PM2 start/reload failed! Please check manually.${NC}"
    exit 1
fi

echo -e "${GREEN}Deployment completed successfully!${NC}"
pm2 list
