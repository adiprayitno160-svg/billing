#!/bin/bash

# ============================================
# Billing System - Auto Install Script
# ============================================
# One-click installation (NO CONFIRMATION)
# Usage: curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-auto.sh | bash
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="18"
APP_DIR="/var/www/billing"
DB_NAME="billing_system"
DB_USER="billing_user"
APP_PORT="3000"

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo -e "${BLUE}"
    echo "============================================"
    echo "  🚀 Billing System - Auto Installer"
    echo "============================================"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
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
    if [ "$EUID" -eq 0 ]; then 
        print_error "Please do not run this script as root"
        echo "Run as normal user with sudo privileges"
        exit 1
    fi
}

check_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        print_error "Cannot detect OS. This script supports Ubuntu/Debian only."
        exit 1
    fi

    if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
        print_error "This script only supports Ubuntu/Debian"
        exit 1
    fi
    
    print_success "Detected: $PRETTY_NAME"
}

# ============================================
# Installation Functions
# ============================================

install_dependencies() {
    print_step "Installing system dependencies..."
    sudo apt update -qq
    sudo apt install -y -qq curl wget git build-essential software-properties-common >/dev/null 2>&1
    print_success "System dependencies installed"
}

install_nodejs() {
    print_step "Installing Node.js ${NODE_VERSION}.x LTS..."
    
    # Check if Node.js already installed
    if command -v node &> /dev/null; then
        NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VER" -eq "$NODE_VERSION" ]; then
            print_success "Node.js $NODE_VERSION.x already installed"
            return
        fi
    fi
    
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - >/dev/null 2>&1
    sudo apt install -y -qq nodejs >/dev/null 2>&1
    
    print_success "Node.js $(node -v) installed successfully"
}

install_pm2() {
    print_step "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 already installed"
        return
    fi
    
    sudo npm install -g pm2 >/dev/null 2>&1
    print_success "PM2 installed successfully"
}

install_mysql() {
    print_step "Installing MySQL/MariaDB..."
    
    if command -v mysql &> /dev/null; then
        print_success "MySQL/MariaDB already installed"
        return
    fi
    
    # Install MariaDB
    export DEBIAN_FRONTEND=noninteractive
    sudo apt install -y -qq mariadb-server mariadb-client >/dev/null 2>&1
    sudo systemctl start mariadb
    sudo systemctl enable mariadb >/dev/null 2>&1
    
    print_success "MariaDB installed and started"
}

setup_database() {
    print_step "Setting up database..."
    
    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    # Create database and user
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    sudo mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || true
    sudo mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';" 2>/dev/null
    sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';" 2>/dev/null
    sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null
    
    print_success "Database created successfully"
    echo -e "${YELLOW}Database Credentials:${NC}"
    echo "  Database: ${DB_NAME}"
    echo "  User: ${DB_USER}"
    echo "  Password: ${DB_PASSWORD}"
    echo ""
    
    # Save credentials to file
    echo "DB_PASSWORD=${DB_PASSWORD}" > /tmp/billing_db_creds.txt
    chmod 600 /tmp/billing_db_creds.txt
}

clone_repository() {
    print_step "Cloning repository..."
    
    # Remove old directory if exists
    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR already exists, removing..."
        sudo rm -rf "$APP_DIR"
    fi
    
    # Clone repository
    sudo mkdir -p /var/www
    sudo git clone -q https://github.com/adiprayitno160-svg/billing.git "$APP_DIR" 2>/dev/null
    
    # Set permissions
    sudo chown -R $USER:$USER "$APP_DIR"
    
    print_success "Repository cloned successfully"
}

install_app_dependencies() {
    print_step "Installing application dependencies (this may take 5-10 minutes)..."
    
    cd "$APP_DIR"
    npm install --production --silent 2>&1 | grep -v "npm WARN" || true
    
    print_success "Dependencies installed"
}

setup_environment() {
    print_step "Setting up environment configuration..."
    
    cd "$APP_DIR"
    
    # Get database password from temp file
    if [ -f /tmp/billing_db_creds.txt ]; then
        source /tmp/billing_db_creds.txt
    else
        print_error "Database credentials not found"
        exit 1
    fi
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    
    # Create .env file
    cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# Server Configuration
PORT=${APP_PORT}
NODE_ENV=production

# Session Secret
SESSION_SECRET=${SESSION_SECRET}

# App Settings
HIDE_BILLING_CUSTOMERS_MENU=false

# Timezone
TZ=Asia/Jakarta
EOF
    
    chmod 600 .env
    print_success "Environment configured"
}

build_application() {
    print_step "Building application..."
    
    cd "$APP_DIR"
    npm run build >/dev/null 2>&1
    
    if [ ! -f "dist/server.js" ]; then
        print_error "Build failed - dist/server.js not found"
        exit 1
    fi
    
    print_success "Application built successfully"
}

start_application() {
    print_step "Starting application with PM2..."
    
    cd "$APP_DIR"
    
    # Stop if already running
    pm2 stop billing-system 2>/dev/null || true
    pm2 delete billing-system 2>/dev/null || true
    
    # Start application
    pm2 start dist/server.js --name billing-system >/dev/null 2>&1
    pm2 save >/dev/null 2>&1
    
    # Setup startup script
    STARTUP_CMD=$(pm2 startup systemd -u $USER --hp $HOME 2>&1 | grep "sudo" | tail -1)
    if [ ! -z "$STARTUP_CMD" ]; then
        eval $STARTUP_CMD >/dev/null 2>&1 || true
    fi
    
    print_success "Application started successfully"
}

setup_firewall() {
    print_step "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true
        sudo ufw allow ${APP_PORT}/tcp comment 'Billing System' >/dev/null 2>&1 || true
        echo "y" | sudo ufw enable >/dev/null 2>&1 || true
        print_success "Firewall configured"
    else
        print_warning "UFW not installed, skipping firewall setup"
    fi
}

create_management_scripts() {
    print_step "Creating management scripts..."
    
    # Backup script
    cat > "$APP_DIR/backup-db.sh" << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/www/billing/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="billing_user"
DB_NAME="billing_system"
export $(grep -v '^#' /var/www/billing/.env | xargs)
mkdir -p $BACKUP_DIR
echo "Creating database backup..."
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
echo "Backup complete: db_$DATE.sql.gz"
EOF
    
    # Update script
    cat > "$APP_DIR/update.sh" << 'EOF'
#!/bin/bash
echo "🔄 Updating Billing System..."
cd /var/www/billing
echo "📦 Creating database backup..."
./backup-db.sh
echo "📥 Pulling latest code..."
git pull origin main
echo "📦 Installing dependencies..."
npm install --production
echo "🔨 Building application..."
npm run build
echo "🚀 Restarting application..."
pm2 restart billing-system
echo "✅ Update complete!"
pm2 status
EOF
    
    chmod +x "$APP_DIR/backup-db.sh"
    chmod +x "$APP_DIR/update.sh"
    mkdir -p "$APP_DIR/backups"
    
    print_success "Management scripts created"
}

show_completion_message() {
    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo "YOUR_SERVER_IP")
    
    echo ""
    echo -e "${GREEN}============================================"
    echo "  ✅ Installation Complete!"
    echo "============================================${NC}"
    echo ""
    echo "🌐 Access your Billing System:"
    echo "   http://${SERVER_IP}:${APP_PORT}"
    echo "   http://localhost:${APP_PORT}"
    echo ""
    echo "🔐 Default Login Credentials:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "⚠️  IMPORTANT SECURITY STEPS:"
    echo "   1. Change default admin password immediately!"
    echo "   2. Database credentials saved in: /tmp/billing_db_creds.txt"
    echo "   3. Save your credentials securely and delete temp file:"
    echo "      cat /tmp/billing_db_creds.txt"
    echo "      rm /tmp/billing_db_creds.txt"
    echo ""
    echo "📋 Useful Commands:"
    echo "   pm2 status                  - Check application status"
    echo "   pm2 logs billing-system     - View application logs"
    echo "   pm2 restart billing-system  - Restart application"
    echo "   cd $APP_DIR && ./update.sh  - Update application"
    echo "   cd $APP_DIR && ./backup-db.sh - Backup database"
    echo ""
    echo -e "${YELLOW}🎉 Happy Billing!${NC}"
    echo ""
}

# ============================================
# Main Installation Flow
# ============================================

main() {
    clear
    print_header
    
    check_root
    check_os
    
    echo ""
    echo "Starting automatic installation..."
    echo ""
    
    install_dependencies
    install_nodejs
    install_pm2
    install_mysql
    setup_database
    clone_repository
    install_app_dependencies
    setup_environment
    build_application
    start_application
    setup_firewall
    create_management_scripts
    show_completion_message
}

# Run main function
main

