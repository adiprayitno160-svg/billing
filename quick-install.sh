#!/bin/bash

################################################################################
# 🚀 Quick Install - Billing System
# One-liner installer untuk aaPanel
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/billing/main/quick-install.sh | bash
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║   🚀 Billing System - Quick Install      ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root: sudo bash quick-install.sh${NC}"
    exit 1
fi

# Download main installer
echo -e "${YELLOW}📥 Downloading installer...${NC}"

GITHUB_USER="adiprayitno160-svg"
GITHUB_REPO="billing_system"

# Try to auto-detect from git remote if in git directory
if [ -d ".git" ]; then
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ $REMOTE_URL =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
        GITHUB_USER="${BASH_REMATCH[1]}"
        GITHUB_REPO="${BASH_REMATCH[2]}"
    fi
fi

# User can override via environment variable if needed
# Default is already set to adiprayitno160-svg/billing_system

INSTALLER_URL="https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/main/aapanel-manager.sh"

# Download installer
if wget -q --spider "$INSTALLER_URL"; then
    wget -O /tmp/aapanel-manager.sh "$INSTALLER_URL" 2>/dev/null
    chmod +x /tmp/aapanel-manager.sh
    
    echo -e "${GREEN}✅ Installer downloaded${NC}"
    echo ""
    
    # Set GitHub repo for installer
    export GITHUB_REPO="https://github.com/$GITHUB_USER/$GITHUB_REPO.git"
    
    # Run installer
    bash /tmp/aapanel-manager.sh
else
    echo -e "${RED}❌ Cannot download installer from: $INSTALLER_URL${NC}"
    echo ""
    echo "Alternative: Clone repository manually"
    echo "  git clone https://github.com/$GITHUB_USER/$GITHUB_REPO.git"
    echo "  cd $GITHUB_REPO"
    echo "  bash aapanel-manager.sh"
    exit 1
fi

