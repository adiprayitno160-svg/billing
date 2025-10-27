#!/bin/bash

# ============================================
# Billing System - Fixed Install Script
# ============================================
# Fixed version dengan perbaikan:
# 1. DB_NAME = billing (bukan billing_system)
# 2. Node.js v20 (bukan v18)
# 3. Library WhatsApp/Puppeteer
# 4. Proper error handling
# ============================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NODE_VERSION="20"
APP_DIR="/opt/billing"
DB_NAME="billing"  # FIXED: billing bukan billing_system
DB_USER="billing_user"
APP_PORT="3000"

# ============================================
# Helper Functions
# ============================================

print_header() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════╗"
    echo "║  🚀 Billing System - Installer v2.0     ║"
    echo "║     Fixed & Tested Version               ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "This script must be run as root"
        echo "Please run: sudo bash $0"
        exit 1
    fi
}

check_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        print_error "Cannot detect OS"
        exit 1
    fi

    if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
        print_error "This script only supports Ubuntu/Debian"
        print_warning "Detected: $OS"
        exit 1
    fi
    
    print_success "Detected: $PRETTY_NAME"
}

# ============================================
# Installation Functions
# ============================================

install_dependencies() {
    print_step "Installing system dependencies..."
    
    apt update
    apt install -y curl wget git build-essential software-properties-common
    
    # Library untuk WhatsApp-web.js (Puppeteer/Chromium)
    print_step "Installing Chromium dependencies for WhatsApp..."
    apt install -y \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdbus-1-3 \
        libgbm1 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        xdg-utils \
        libxss1 \
        lsb-release
    
    print_success "Dependencies installed"
}

install_nodejs() {
    print_step "Installing Node.js ${NODE_VERSION}.x LTS..."
    
    if command -v node &> /dev/null; then
        NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VER" -ge "$NODE_VERSION" ]; then
            print_success "Node.js v$(node -v) already installed"
            return
        else
            print_warning "Upgrading Node.js from v$NODE_VER to v$NODE_VERSION"
        fi
    fi
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
    
    # Verify
    node -v
    npm -v
    
    print_success "Node.js $(node -v) installed"
}

install_pm2() {
    print_step "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 already installed"
        return
    fi
    
    npm install -g pm2
    pm2 completion install
    
    print_success "PM2 $(pm2 -v) installed"
}

install_mysql() {
    print_step "Installing MySQL Server..."
    
    if command -v mysql &> /dev/null; then
        print_success "MySQL already installed"
        return
    fi
    
    # Set non-interactive installation
    export DEBIAN_FRONTEND=noninteractive
    
    # Install MySQL
    apt install -y mysql-server
    
    # Start MySQL
    systemctl start mysql
    systemctl enable mysql
    
    print_success "MySQL installed"
}

setup_database() {
    print_step "Setting up database..."
    
    # Generate random password
    DB_PASS=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    # Create database and user
    mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
    mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
    mysql -e "FLUSH PRIVILEGES;"
    
    # Save credentials
    cat > /root/.billing-db-credentials << EOF
Database Name: ${DB_NAME}
Database User: ${DB_USER}
Database Password: ${DB_PASS}
EOF
    
    chmod 600 /root/.billing-db-credentials
    
    print_success "Database created: ${DB_NAME}"
    print_success "User created: ${DB_USER}"
    print_warning "Password saved to: /root/.billing-db-credentials"
}

clone_repository() {
    print_step "Cloning application repository..."
    
    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR already exists"
        read -p "Remove and clone fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf $APP_DIR
        else
            print_error "Aborted"
            exit 1
        fi
    fi
    
    # Create parent directory
    mkdir -p $(dirname $APP_DIR)
    
    # Clone repository
    git clone https://github.com/adiprayitno160-svg/billing.git $APP_DIR
    
    cd $APP_DIR
    
    print_success "Repository cloned to $APP_DIR"
}

install_app_dependencies() {
    print_step "Installing application dependencies..."
    
    cd $APP_DIR
    
    # Install dependencies (ini bisa lama, 5-10 menit)
    npm install
    
    print_success "Dependencies installed"
}

configure_environment() {
    print_step "Configuring environment..."
    
    cd $APP_DIR
    
    # Read database password
    DB_PASS=$(grep "Database Password:" /root/.billing-db-credentials | cut -d':' -f2 | xargs)
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    
    # Create .env file
    cat > .env << EOF
# ===================================
# BILLING SYSTEM - Configuration
# ===================================

# DATABASE
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

# SERVER
PORT=${APP_PORT}
NODE_ENV=production

# SESSION
SESSION_SECRET=${SESSION_SECRET}

# MIKROTIK (Configure via dashboard)
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=
MIKROTIK_PORT=8728

# PAYMENT GATEWAY (Optional)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

XENDIT_API_KEY=
XENDIT_WEBHOOK_TOKEN=

TRIPAY_API_KEY=
TRIPAY_PRIVATE_KEY=
TRIPAY_MERCHANT_CODE=
TRIPAY_IS_PRODUCTION=false

# TELEGRAM (Optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# WHATSAPP (Optional)
WA_SESSION_PATH=./whatsapp-session

# EMAIL (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EOF
    
    chmod 600 .env
    
    print_success "Environment configured"
}

import_database() {
    print_step "Importing database..."
    
    cd $APP_DIR
    
    # Read database password
    DB_PASS=$(grep "Database Password:" /root/.billing-db-credentials | cut -d':' -f2 | xargs)
    
    # Import SQL
    mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < billing.sql
    
    # Verify
    TABLE_COUNT=$(mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${DB_NAME}';")
    
    print_success "Database imported (${TABLE_COUNT} tables created)"
}

build_application() {
    print_step "Building application..."
    
    cd $APP_DIR
    
    # Build TypeScript
    npm run build
    
    # Verify dist folder
    if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
        print_error "Build failed - dist/server.js not found"
        exit 1
    fi
    
    print_success "Application built successfully"
}

start_application() {
    print_step "Starting application with PM2..."
    
    cd $APP_DIR
    
    # Stop if already running
    pm2 delete billing-system 2>/dev/null || true
    
    # Start with PM2
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 process list
    pm2 save
    
    # Setup PM2 startup
    env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
    
    print_success "Application started"
}

configure_firewall() {
    print_step "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow ${APP_PORT}/tcp
        echo "y" | ufw enable || true
        print_success "Firewall configured (UFW)"
    else
        print_warning "UFW not found, skipping firewall configuration"
    fi
}

print_completion() {
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗"
    echo "║     🎉 Installation Complete!           ║"
    echo "╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📱 Access your application:${NC}"
    echo -e "   ${GREEN}http://${SERVER_IP}:${APP_PORT}${NC}"
    echo ""
    echo -e "${BLUE}🔐 Default Login Credentials:${NC}"
    echo -e "   Admin:"
    echo -e "   Username: ${GREEN}admin${NC}"
    echo -e "   Password: ${GREEN}admin123${NC}"
    echo ""
    echo -e "   Kasir:"
    echo -e "   Username: ${GREEN}kasir${NC}"
    echo -e "   Password: ${GREEN}kasir123${NC}"
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Change default passwords after first login!${NC}"
    echo ""
    echo -e "${BLUE}📊 PM2 Commands:${NC}"
    echo "   pm2 status              - Check application status"
    echo "   pm2 logs billing-system - View logs"
    echo "   pm2 restart billing-system - Restart application"
    echo "   pm2 monit               - Monitor resources"
    echo ""
    echo -e "${BLUE}🔑 Database Credentials:${NC}"
    echo "   File: /root/.billing-db-credentials"
    echo "   View: cat /root/.billing-db-credentials"
    echo ""
    echo -e "${BLUE}📁 Application Directory:${NC}"
    echo "   ${APP_DIR}"
    echo ""
    echo -e "${GREEN}✓ Installation completed successfully!${NC}"
    echo ""
}

# ============================================
# Main Installation Flow
# ============================================

main() {
    print_header
    
    check_root
    check_os
    
    echo ""
    read -p "🚀 Start installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Installation cancelled"
        exit 1
    fi
    
    install_dependencies
    install_nodejs
    install_pm2
    install_mysql
    setup_database
    clone_repository
    install_app_dependencies
    configure_environment
    import_database
    build_application
    start_application
    configure_firewall
    
    print_completion
}

# Run installation
main

exit 0

