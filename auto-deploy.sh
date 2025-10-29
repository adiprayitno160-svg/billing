#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 🚀 AUTO DEPLOY SCRIPT untuk Linux/Mac
# ═══════════════════════════════════════════════════════════
# Version: 2.0.8.1
# Date: October 29, 2025
# Usage: chmod +x auto-deploy.sh && ./auto-deploy.sh
# ═══════════════════════════════════════════════════════════

# Configuration
SERVER_IP="${1:-192.168.239.126}"
SERVER_USER="${2:-root}"
PROJECT_PATH="/opt/billing"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🚀 AUTO DEPLOY v2.0.8.1 - Billing System${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Target Server: ${SERVER_USER}@${SERVER_IP}"
echo -e "Project Path: ${PROJECT_PATH}"
echo ""

# Check if ssh is available
if ! command -v ssh &> /dev/null; then
    echo -e "${RED}❌ ERROR: SSH not found!${NC}"
    echo "Please install OpenSSH client first."
    exit 1
fi

echo -e "${CYAN}🔄 Step 1: Connecting to server...${NC}"
echo ""

# Execute deployment via SSH
ssh -o ConnectTimeout=10 "${SERVER_USER}@${SERVER_IP}" << 'ENDSSH'
echo '🔄 Starting deployment...'
echo ''

echo '📂 Step 2: Navigating to project directory...'
cd /opt/billing || exit 1
echo '✅ Current directory: '
pwd
echo ''

echo '📥 Step 3: Fetching latest changes from GitHub...'
git fetch --tags
echo ''

echo '📦 Step 4: Pulling updates...'
git pull origin main
echo ''

echo '🔍 Step 5: Checking version...'
echo -n 'Current version: '
cat VERSION
echo ''

echo '🔄 Step 6: Restarting PM2 application...'
pm2 restart billing-app
echo ''

echo '✅ Step 7: Verifying PM2 status...'
pm2 status
echo ''

echo '📋 Step 8: Showing recent logs...'
pm2 logs billing-app --lines 10 --nostream
echo ''

echo '═══════════════════════════════════════════════════════════'
echo '✅ DEPLOYMENT COMPLETED!'
echo '═══════════════════════════════════════════════════════════'
echo ''
echo '📊 Next Steps:'
echo '1. Open browser: http://192.168.239.126:3000/prepaid/dashboard'
echo '2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)'
echo '3. Test Interface Traffic monitoring'
echo ''
ENDSSH

# Check deployment result
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}🧪 Testing URLs:${NC}"
    echo "  Dashboard: http://${SERVER_IP}:3000/prepaid/dashboard"
    echo "  Address List: http://${SERVER_IP}:3000/prepaid/address-list"
    echo ""
    echo -e "${YELLOW}💡 Remember to:${NC}"
    echo "  1. Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)"
    echo "  2. Wait 15-20 seconds for smooth graph"
    echo ""
else
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}❌ DEPLOYMENT FAILED!${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Please check:${NC}"
    echo "  1. SSH connection to ${SERVER_USER}@${SERVER_IP}"
    echo "  2. Project path: ${PROJECT_PATH}"
    echo "  3. PM2 configuration"
    echo ""
    exit 1
fi

