#!/bin/bash

# Remote Update Script
# Script ini dijalankan dari komputer lokal untuk update server via SSH

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Edit sesuai server Anda
SSH_USER="root"
SSH_HOST="your-server-ip"
SSH_PORT="22"
SSH_KEY="" # Optional: path to SSH key, e.g., ~/.ssh/id_rsa
APP_DIR="/opt/billing"

# Parse arguments
FORCE_UPDATE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            SSH_HOST="$2"
            shift 2
            ;;
        --user)
            SSH_USER="$2"
            shift 2
            ;;
        --port)
            SSH_PORT="$2"
            shift 2
            ;;
        --key)
            SSH_KEY="$2"
            shift 2
            ;;
        --force)
            FORCE_UPDATE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --host HOST     SSH host/IP address"
            echo "  --user USER     SSH username (default: root)"
            echo "  --port PORT     SSH port (default: 22)"
            echo "  --key PATH      Path to SSH key file"
            echo "  --force         Force update without confirmation"
            echo "  --help          Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --host 192.168.1.100 --user ubuntu --port 22"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build SSH command
SSH_CMD="ssh"
if [ ! -z "$SSH_KEY" ]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
fi
SSH_CMD="$SSH_CMD -p $SSH_PORT $SSH_USER@$SSH_HOST"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🚀 Remote Update Billing System${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Target Server:${NC}"
echo -e "  Host: ${SSH_HOST}"
echo -e "  User: ${SSH_USER}"
echo -e "  Port: ${SSH_PORT}"
echo -e "  App Dir: ${APP_DIR}\n"

# Test SSH connection
echo -e "${YELLOW}Testing SSH connection...${NC}"
if $SSH_CMD "echo 'Connection successful'" &>/dev/null; then
    echo -e "${GREEN}✓ SSH connection OK${NC}\n"
else
    echo -e "${RED}❌ Cannot connect to server${NC}"
    echo -e "${YELLOW}Please check:${NC}"
    echo "  - Server IP/hostname is correct"
    echo "  - SSH port is correct"
    echo "  - SSH key is valid (if used)"
    echo "  - User has access to the server"
    exit 1
fi

# Get current version from server
echo -e "${YELLOW}Getting current version...${NC}"
CURRENT_VERSION=$($SSH_CMD "cat ${APP_DIR}/VERSION 2>/dev/null || echo 'unknown'")
echo -e "${GREEN}Current version: ${CURRENT_VERSION}${NC}\n"

# Get latest version from GitHub
echo -e "${YELLOW}Checking latest version on GitHub...${NC}"
LATEST_VERSION=$(git ls-remote --tags https://github.com/adiprayitno160-svg/billing.git | \
    grep -o 'refs/tags/v[0-9]*\.[0-9]*\.[0-9]*$' | \
    sort -V | \
    tail -n1 | \
    sed 's/refs\/tags\/v//')

if [ -z "$LATEST_VERSION" ]; then
    echo -e "${RED}❌ Cannot fetch latest version from GitHub${NC}"
    exit 1
fi

echo -e "${GREEN}Latest version: ${LATEST_VERSION}${NC}\n"

# Check if update needed
if [ "$CURRENT_VERSION" == "$LATEST_VERSION" ] && [ "$FORCE_UPDATE" == false ]; then
    echo -e "${GREEN}✅ Server is already on the latest version!${NC}"
    exit 0
fi

# Confirm update
if [ "$FORCE_UPDATE" == false ]; then
    echo -e "${YELLOW}⚠️  This will update the server from ${CURRENT_VERSION} to ${LATEST_VERSION}${NC}"
    echo -e "${YELLOW}The application will be restarted.${NC}\n"
    read -p "Continue? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${YELLOW}Update cancelled${NC}"
        exit 0
    fi
fi

echo -e "${BLUE}Starting remote update...${NC}\n"

# Upload update script if not exists
echo -e "${YELLOW}📤 Uploading update script...${NC}"
scp -P $SSH_PORT $([ ! -z "$SSH_KEY" ] && echo "-i $SSH_KEY") update.sh $SSH_USER@$SSH_HOST:$APP_DIR/
echo -e "${GREEN}✓ Update script uploaded${NC}\n"

# Make script executable and run it
echo -e "${YELLOW}🚀 Running update on server...${NC}"
echo -e "${BLUE}----------------------------------------${NC}\n"

$SSH_CMD "cd $APP_DIR && chmod +x update.sh && ./update.sh"

echo -e "\n${BLUE}----------------------------------------${NC}"
echo -e "${GREEN}✅ Remote update completed!${NC}\n"

# Get new version
NEW_VERSION=$($SSH_CMD "cat ${APP_DIR}/VERSION 2>/dev/null || echo 'unknown'")
echo -e "${GREEN}Server updated to version: ${NEW_VERSION}${NC}\n"

# Check application status
echo -e "${YELLOW}Checking application status...${NC}"
$SSH_CMD "pm2 list | grep -E 'billing-app|App name' || pm2 list"

echo -e "\n${GREEN}✅ Update completed successfully!${NC}"

exit 0

