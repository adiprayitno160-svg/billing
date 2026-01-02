#!/bin/bash

#################################################
# Billing App v2.4.9 - Ubuntu Server Deploy Script
# Usage: sudo bash deploy.sh
#################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_DIR="/var/www/billing"
REPO_URL="https://github.com/adiprayitno160-svg/billing.git"
BRANCH="main"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║     Billing App - Ubuntu Deployment v2.4.9   ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Function: Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function: Print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Check prerequisites
echo -e "\n${BLUE}[1/7] Checking prerequisites...${NC}"

if ! command_exists node; then
    print_error "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node -v)
    print_status "Node.js installed: $NODE_VERSION"
fi

if ! command_exists npm; then
    print_error "npm not found!"
    exit 1
else
    print_status "npm installed: $(npm -v)"
fi

if ! command_exists pm2; then
    print_warning "PM2 not found. Installing globally..."
    sudo npm install -g pm2
else
    print_status "PM2 installed: $(pm2 -v)"
fi

if ! command_exists git; then
    print_warning "Git not found. Installing..."
    sudo apt-get install -y git
else
    print_status "Git installed"
fi

# Step 2: Clone or update repository
echo -e "\n${BLUE}[2/7] Fetching latest code...${NC}"

if [ -d "$APP_DIR" ]; then
    print_status "App directory exists, pulling latest changes..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    git pull origin $BRANCH
else
    print_status "Cloning repository..."
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Step 3: Check .env file
echo -e "\n${BLUE}[3/7] Checking configuration...${NC}"

if [ ! -f "$APP_DIR/.env" ]; then
    print_warning ".env file not found! Creating from template..."
    if [ -f "$APP_DIR/.env.example" ]; then
        cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        print_warning "Please edit .env file with your configuration!"
    else
        cat > "$APP_DIR/.env" << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=billing

# Server Port
PORT=3001

# Session Secret (change this!)
SESSION_SECRET=your-super-secret-key-change-this

# GenieACS Configuration (optional)
GENIEACS_URL=http://192.168.1.1:7557
GENIEACS_USERNAME=admin
GENIEACS_PASSWORD=admin

# MikroTik Configuration (optional)
MIKROTIK_HOST=192.168.1.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=
MIKROTIK_PORT=8728
EOF
        print_warning "Created default .env file. Please configure it!"
    fi
fi

print_status ".env file exists"

# Step 4: Install dependencies
echo -e "\n${BLUE}[4/7] Installing dependencies...${NC}"
cd "$APP_DIR"
npm install --production=false
print_status "Dependencies installed"

# Step 5: Build application
echo -e "\n${BLUE}[5/7] Building application...${NC}"
npm run build
print_status "Build completed"

# Step 6: Setup PM2
echo -e "\n${BLUE}[6/7] Setting up PM2...${NC}"

# Stop existing app if running
pm2 stop billing-app 2>/dev/null || true
pm2 delete billing-app 2>/dev/null || true

# Start with ecosystem config
pm2 start ecosystem.config.js --env production
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u $USER --hp /home/$USER 2>/dev/null || true

print_status "PM2 configured"

# Step 7: Show status
echo -e "\n${BLUE}[7/7] Deployment complete!${NC}"
echo ""
pm2 list

echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Deployment Successful! ✓            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "App URL: ${BLUE}http://$(hostname -I | awk '{print $1}'):3001${NC}"
echo -e "Logs:    ${YELLOW}pm2 logs billing-app${NC}"
echo -e "Status:  ${YELLOW}pm2 status${NC}"
echo -e "Restart: ${YELLOW}pm2 restart billing-app${NC}"
echo ""
