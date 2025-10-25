#!/bin/bash

################################################################################
# Billing System - Auto Installer Script
# Version: 1.0.0
# Description: Automated installation script for Billing System
# Usage: sudo bash install.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display functions
print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         Billing System - Auto Installer                   ║"
    echo "║         Version 1.1.0                                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Please run as root (use sudo)"
        exit 1
    fi
}

# Detect OS
detect_os() {
    print_step "Detecting operating system..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
        print_success "Detected: $PRETTY_NAME"
    else
        print_error "Cannot detect OS"
        exit 1
    fi
}

# Install Node.js
install_nodejs() {
    print_step "Installing Node.js 18.x LTS..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_warning "Node.js already installed: $NODE_VERSION"
        read -p "Do you want to reinstall? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi
    
    # Install Node.js based on OS
    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
            apt-get install -y nodejs
            ;;
        centos|rhel|fedora)
            curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
            yum install -y nodejs
            ;;
        *)
            print_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    
    # Verify installation
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NPM_VERSION=$(npm --version)
        print_success "Node.js installed: $NODE_VERSION"
        print_success "NPM installed: $NPM_VERSION"
    else
        print_error "Node.js installation failed"
        exit 1
    fi
}

# Install PM2
install_pm2() {
    print_step "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 --version)
        print_warning "PM2 already installed: $PM2_VERSION"
    else
        npm install -g pm2
        print_success "PM2 installed successfully"
    fi
}

# Install MySQL/MariaDB
install_database() {
    print_step "Checking database installation..."
    
    if command -v mysql &> /dev/null; then
        MYSQL_VERSION=$(mysql --version)
        print_success "MySQL/MariaDB already installed: $MYSQL_VERSION"
        return 0
    fi
    
    print_warning "MySQL/MariaDB not found"
    read -p "Do you want to install MariaDB? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        case $OS in
            ubuntu|debian)
                apt-get update
                apt-get install -y mariadb-server mariadb-client
                systemctl start mariadb
                systemctl enable mariadb
                ;;
            centos|rhel|fedora)
                yum install -y mariadb-server mariadb
                systemctl start mariadb
                systemctl enable mariadb
                ;;
        esac
        
        print_success "MariaDB installed successfully"
        print_warning "Please run: mysql_secure_installation"
    fi
}

# Clone repository
clone_repository() {
    print_step "Cloning Billing System repository..."
    
    # Determine installation directory
    if [ -d "/www/wwwroot" ]; then
        INSTALL_DIR="/www/wwwroot"
    elif [ -d "/var/www" ]; then
        INSTALL_DIR="/var/www"
    else
        INSTALL_DIR="/opt"
    fi
    
    cd "$INSTALL_DIR" || exit 1
    
    # Check if directory exists
    if [ -d "billing_system" ]; then
        print_warning "Directory billing_system already exists"
        read -p "Do you want to remove and reinstall? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf billing_system
        else
            cd billing_system
            return 0
        fi
    fi
    
    # Clone repository
    git clone https://github.com/adiprayitno160-svg/billing_system.git
    cd billing_system || exit 1
    
    print_success "Repository cloned to: $INSTALL_DIR/billing_system"
    
    # Save install directory for later use
    echo "$INSTALL_DIR/billing_system" > /tmp/billing_install_dir
}

# Install dependencies
install_dependencies() {
    print_step "Installing Node.js dependencies..."
    
    INSTALL_DIR=$(cat /tmp/billing_install_dir)
    cd "$INSTALL_DIR" || exit 1
    
    npm install
    
    print_success "Dependencies installed successfully"
}

# Build application
build_application() {
    print_step "Building TypeScript application..."
    
    INSTALL_DIR=$(cat /tmp/billing_install_dir)
    cd "$INSTALL_DIR" || exit 1
    
    npm run build
    
    if [ -d "dist" ]; then
        print_success "Application built successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Setup database
setup_database() {
    print_step "Setting up database..."
    
    echo ""
    echo "Database Configuration"
    echo "======================"
    read -p "MySQL root password: " -s MYSQL_ROOT_PASS
    echo ""
    read -p "Database name [billing_database]: " DB_NAME
    DB_NAME=${DB_NAME:-billing_database}
    
    read -p "Database user [billing_user]: " DB_USER
    DB_USER=${DB_USER:-billing_user}
    
    read -p "Database password: " -s DB_PASS
    echo ""
    
    # Create database
    print_step "Creating database..."
    mysql -u root -p"$MYSQL_ROOT_PASS" <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    if [ $? -eq 0 ]; then
        print_success "Database created successfully"
    else
        print_error "Database creation failed"
        exit 1
    fi
    
    # Import migrations
    INSTALL_DIR=$(cat /tmp/billing_install_dir)
    if [ -f "$INSTALL_DIR/migrations/create_system_settings.sql" ]; then
        print_step "Importing database migrations..."
        mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$INSTALL_DIR/migrations/create_system_settings.sql"
        print_success "Migrations imported successfully"
    fi
    
    # Save database config for .env
    echo "$DB_NAME" > /tmp/billing_db_name
    echo "$DB_USER" > /tmp/billing_db_user
    echo "$DB_PASS" > /tmp/billing_db_pass
}

# Create .env configuration
create_env_config() {
    print_step "Creating .env configuration..."
    
    INSTALL_DIR=$(cat /tmp/billing_install_dir)
    cd "$INSTALL_DIR" || exit 1
    
    DB_NAME=$(cat /tmp/billing_db_name)
    DB_USER=$(cat /tmp/billing_db_user)
    DB_PASS=$(cat /tmp/billing_db_pass)
    
    # Generate random session secret
    SESSION_SECRET=$(openssl rand -hex 32)
    
    cat > .env << EOF
# =============================================
# Billing System Configuration
# Generated: $(date)
# =============================================

# Application
NODE_ENV=production
PORT=3000
APP_VERSION=1.1.0

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME

# Session
SESSION_SECRET=$SESSION_SECRET

# GitHub Auto-Update
GITHUB_REPO_OWNER=adiprayitno160-svg
GITHUB_REPO_NAME=billing_system

# Payment Gateways (configure later if needed)
XENDIT_API_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
TRIPAY_API_KEY=
TRIPAY_PRIVATE_KEY=

# WhatsApp (configure later if needed)
WHATSAPP_ENABLED=false

# Telegram (configure later if needed)
TELEGRAM_BOT_TOKEN=
TELEGRAM_ENABLED=false

# Email (configure later if needed)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EOF
    
    chmod 600 .env
    
    print_success ".env file created successfully"
    print_warning "Remember to configure payment gateways and other services later"
}

# Start application with PM2
start_application() {
    print_step "Starting application with PM2..."
    
    INSTALL_DIR=$(cat /tmp/billing_install_dir)
    cd "$INSTALL_DIR" || exit 1
    
    # Stop if already running
    pm2 delete billing 2>/dev/null || true
    
    # Start application
    pm2 start ecosystem.config.js --name billing --env production
    
    # Save PM2 config
    pm2 save
    
    # Setup auto-start on boot
    pm2 startup | grep -E '^sudo' | bash
    
    print_success "Application started successfully"
    
    # Show status
    pm2 status
}

# Configure firewall
configure_firewall() {
    print_step "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 3000/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        print_success "UFW firewall configured"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=3000/tcp
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=443/tcp
        firewall-cmd --reload
        print_success "Firewalld configured"
    else
        print_warning "No firewall detected. Please configure manually."
    fi
}

# Display completion message
display_completion() {
    INSTALL_DIR=$(cat /tmp/billing_install_dir)
    SERVER_IP=$(curl -s ifconfig.me || echo "YOUR_SERVER_IP")
    
    echo ""
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                 Installation Complete!                     ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "Installation Directory: $INSTALL_DIR"
    echo ""
    echo -e "${BLUE}Access your application:${NC}"
    echo "  → http://$SERVER_IP:3000"
    echo "  → http://localhost:3000 (if local)"
    echo ""
    echo -e "${BLUE}Default Login Credentials:${NC}"
    echo "  Admin Login: http://$SERVER_IP:3000/login"
    echo "    Username: admin"
    echo "    Password: admin"
    echo ""
    echo "  Kasir Login: http://$SERVER_IP:3000/kasir/login"
    echo "    Username: kasir"
    echo "    Password: kasir"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Change default passwords after first login!${NC}"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  View logs:      pm2 logs billing"
    echo "  Restart:        pm2 restart billing"
    echo "  Stop:           pm2 stop billing"
    echo "  Status:         pm2 status"
    echo "  Monitor:        pm2 monit"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Change default passwords"
    echo "  2. Configure payment gateways (.env file)"
    echo "  3. Setup Nginx reverse proxy (optional)"
    echo "  4. Setup SSL certificate (optional)"
    echo "  5. Configure WhatsApp/Telegram bots (optional)"
    echo ""
    echo -e "${GREEN}Documentation:${NC}"
    echo "  → $INSTALL_DIR/README.md"
    echo "  → $INSTALL_DIR/AUTO_UPDATE_SETUP_GUIDE.md"
    echo ""
    echo -e "${GREEN}Support:${NC}"
    echo "  → GitHub: https://github.com/adiprayitno160-svg/billing_system"
    echo ""
    
    # Clean up temp files
    rm -f /tmp/billing_install_dir /tmp/billing_db_*
}

# Main installation process
main() {
    print_header
    
    echo ""
    echo "This script will install:"
    echo "  • Node.js 18.x LTS"
    echo "  • PM2 Process Manager"
    echo "  • Billing System Application"
    echo "  • Database (optional)"
    echo ""
    read -p "Continue with installation? (y/n): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    echo ""
    print_step "Starting installation process..."
    echo ""
    
    # Run installation steps
    check_root
    detect_os
    install_nodejs
    install_pm2
    install_database
    clone_repository
    install_dependencies
    build_application
    setup_database
    create_env_config
    start_application
    configure_firewall
    display_completion
}

# Run main function
main "$@"

