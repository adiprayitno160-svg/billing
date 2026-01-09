#!/bin/bash

# Deployment Script for Billing System
# This script pulls latest code, builds, and restarts the application

echo "🚀 Starting deployment process..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check current branch
echo -e "${YELLOW}Step 1: Checking current branch...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Step 2: Stash any local changes
echo -e "${YELLOW}Step 2: Stashing local changes...${NC}"
git stash

# Step 3: Pull latest code from GitHub
echo -e "${YELLOW}Step 3: Pulling latest code from GitHub...${NC}"
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to pull from GitHub${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Successfully pulled latest code${NC}"

# Step 4: Show latest commits
echo -e "${YELLOW}Step 4: Latest commits:${NC}"
git log --oneline -5

# Step 5: Install dependencies (if needed)
echo -e "${YELLOW}Step 5: Checking dependencies...${NC}"
npm install

# Step 6: Build application
echo -e "${YELLOW}Step 6: Building application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Step 7: Restart PM2
echo -e "${YELLOW}Step 7: Restarting PM2...${NC}"
pm2 restart billing-app

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Trying pm2 reload instead...${NC}"
    pm2 reload billing-app
fi

# Step 8: Show PM2 status
echo -e "${YELLOW}Step 8: PM2 Status:${NC}"
pm2 list

# Step 9: Show recent logs
echo -e "${YELLOW}Step 9: Recent logs:${NC}"
pm2 logs billing-app --lines 20 --nostream

echo ""
echo -e "${GREEN}=================================="
echo -e "✅ Deployment completed!"
echo -e "🌐 Application should now be updated"
echo -e "==================================${NC}"
echo ""
echo "ℹ️  If changes still not visible:"
echo "   1. Clear browser cache (Ctrl+Shift+Delete)"
echo "   2. Hard refresh (Ctrl+F5)"
echo "   3. Check PM2 logs: pm2 logs billing-app"
