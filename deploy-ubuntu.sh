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
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}Git pull failed! Aborting deployment.${NC}"
    exit 1
fi

# 2. Install Dependencies
echo "Installing/Updating dependencies..."
npm install

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

# 4. Migrate Database (Optional but recommended)
echo "Running database migrations (if any)..."
# npx sequelize-cli db:migrate # Uncomment if using Sequelize
# npm run migrate # Or your custom migration command

# 5. Restart PM2 Service
echo "Restarting application via PM2..."
pm2 restart all

if [ $? -ne 0 ]; then
    echo -e "${RED}PM2 restart failed! Please check manually.${NC}"
    exit 1
fi

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo "Checked status:"
pm2 status
