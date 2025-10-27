#!/bin/bash

# ============================================
# Billing System - Debian 12 Installer
# ============================================
# Tested & Working Version
# Database: billing (bukan billing_system)
# Node.js: v20 LTS
# Fixed: MariaDB auth, collation, dependencies
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NODE_VERSION="20"
APP_DIR="/opt/billing"
DB_NAME="billing"
DB_USER="billing_user"
DB_PASS="Billing123!"
APP_PORT="3000"

# ============================================
# Helper Functions
# ============================================

print_header() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════╗"
    echo "║  🚀 Billing System Installer v2.0       ║"
    echo "║     Tested for Debian 12                 ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
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
        if [[ "$ID" != "debian" ]]; then
            print_error "This script is designed for Debian 12"
            print_warning "Detected: $PRETTY_NAME"
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
        print_success "Detected: $PRETTY_NAME"
    fi
}

# ============================================
# Installation Functions
# ============================================

install_dependencies() {
    print_step "Installing system dependencies..."
    
    apt update
    apt install -y curl wget git build-essential ca-certificates gnupg lsb-release
    
    # WhatsApp/Chromium dependencies
    print_step "Installing WhatsApp/Chromium dependencies..."
    apt install -y \
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
        libxss1 \
        xdg-utils
    
    print_success "Dependencies installed"
}

install_nodejs() {
    print_step "Installing Node.js ${NODE_VERSION}.x LTS..."
    
    if command -v node &> /dev/null; then
        NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VER" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) already installed"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
    
    print_success "Node.js $(node -v) installed"
}

install_pm2() {
    print_step "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 already installed"
        return
    fi
    
    npm install -g pm2
    print_success "PM2 installed"
}

install_mariadb() {
    print_step "Installing MariaDB..."
    
    # Remove old installations
    systemctl stop mariadb 2>/dev/null || true
    systemctl stop mysql 2>/dev/null || true
    pkill -9 mysqld 2>/dev/null || true
    pkill -9 mariadbd 2>/dev/null || true
    
    apt-get remove --purge -y mariadb-* mysql-* default-mysql-* 2>/dev/null || true
    apt-get autoremove -y
    rm -rf /var/lib/mysql* /etc/mysql /var/log/mysql* /run/mysqld
    
    # Install fresh
    export DEBIAN_FRONTEND=noninteractive
    apt update
    apt install -y mariadb-server mariadb-client
    
    systemctl start mariadb
    systemctl enable mariadb
    
    sleep 3
    
    print_success "MariaDB installed"
}

setup_database() {
    print_step "Setting up database..."
    
    # Try direct connection first
    mariadb -u root << EOF 2>/dev/null || SETUP_FAILED=1
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

    # If failed, try with skip-grant-tables
    if [ "$SETUP_FAILED" = "1" ]; then
        print_warning "Direct setup failed, using skip-grant-tables method..."
        
        systemctl stop mariadb
        echo "[mysqld]
skip-grant-tables
skip-networking" > /etc/mysql/mariadb.conf.d/99-skip-grants.cnf
        
        systemctl start mariadb
        sleep 3
        
        mysql -u root << EOF
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY 'RootPass123!';
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
        
        rm /etc/mysql/mariadb.conf.d/99-skip-grants.cnf
        systemctl restart mariadb
        sleep 3
    fi
    
    # Test connection
    mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "SELECT 'OK';" >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "Database setup complete"
        
        # Save credentials
        cat > /root/.billing-db-credentials << EOC
Database Name: ${DB_NAME}
Database User: ${DB_USER}
Database Password: ${DB_PASS}
EOC
        chmod 600 /root/.billing-db-credentials
        print_success "Credentials saved to /root/.billing-db-credentials"
    else
        print_error "Database setup failed"
        exit 1
    fi
}

clone_repository() {
    print_step "Cloning repository from GitHub..."
    
    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR exists"
        read -p "Remove and clone fresh? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            rm -rf $APP_DIR
        else
            print_error "Aborted"
            exit 1
        fi
    fi
    
    git clone https://github.com/adiprayitno160-svg/billing.git $APP_DIR
    cd $APP_DIR
    
    print_success "Repository cloned"
}

install_app_dependencies() {
    print_step "Installing application dependencies..."
    
    cd $APP_DIR
    npm install
    
    print_success "Dependencies installed"
}

configure_environment() {
    print_step "Configuring environment..."
    
    cd $APP_DIR
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    
    cat > .env << EOE
# DATABASE CONFIGURATION
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

# SERVER CONFIGURATION
PORT=${APP_PORT}
NODE_ENV=production

# SESSION CONFIGURATION
SESSION_SECRET=${SESSION_SECRET}

# MIKROTIK CONFIGURATION (Optional - configure via dashboard)
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

# TELEGRAM BOT (Optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# WHATSAPP (Optional)
WA_SESSION_PATH=./whatsapp-session

# EMAIL/SMTP (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EOE
    
    chmod 600 .env
    
    print_success "Environment configured"
}

import_database() {
    print_step "Importing database..."
    
    cd $APP_DIR
    
    # Check if billing.sql exists in root, if not use docs/billing.sql
    if [ -f "billing.sql" ]; then
        SQL_FILE="billing.sql"
    elif [ -f "docs/billing.sql" ]; then
        SQL_FILE="docs/billing.sql"
    else
        print_error "SQL file not found!"
        exit 1
    fi
    
    mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < $SQL_FILE
    
    # Run migrations if they exist
    if [ -f "migrations/fix_missing_columns.sql" ]; then
        print_step "Running database migrations..."
        mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < migrations/fix_missing_columns.sql
        print_success "Migrations applied"
    fi
    
    # Verify
    TABLE_COUNT=$(mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null | tail -1)
    
    print_success "Database imported (${TABLE_COUNT} tables)"
}

build_application() {
    print_step "Building application..."
    
    cd $APP_DIR
    npm run build
    
    if [ ! -f "dist/server.js" ]; then
        print_error "Build failed"
        exit 1
    fi
    
    print_success "Application built"
}

start_application() {
    print_step "Starting application with PM2..."
    
    cd $APP_DIR
    
    pm2 delete billing-system 2>/dev/null || true
    pm2 start ecosystem.config.js --env production
    pm2 save
    
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
        print_success "Firewall configured"
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
    echo -e "${BLUE}🌐 Access your application:${NC}"
    echo -e "   ${GREEN}http://${SERVER_IP}:${APP_PORT}${NC}"
    echo ""
    echo -e "${BLUE}🔐 Default Login:${NC}"
    echo -e "   Admin:"
    echo -e "   Username: ${GREEN}admin${NC}"
    echo -e "   Password: ${GREEN}admin123${NC}"
    echo ""
    echo -e "   Kasir:"
    echo -e "   Username: ${GREEN}kasir${NC}"
    echo -e "   Password: ${GREEN}kasir123${NC}"
    echo ""
    echo -e "${YELLOW}⚠  IMPORTANT: Change default passwords after first login!${NC}"
    echo ""
    echo -e "${BLUE}📊 Management Commands:${NC}"
    echo "   pm2 status              - Check status"
    echo "   pm2 logs billing-system - View logs"
    echo "   pm2 restart billing-system - Restart app"
    echo ""
    echo -e "${BLUE}🔑 Database Credentials:${NC}"
    echo "   Saved at: /root/.billing-db-credentials"
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
    install_mariadb
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


