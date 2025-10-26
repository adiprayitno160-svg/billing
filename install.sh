#!/bin/bash

# ============================================
# Billing System - Quick Install Script
# ============================================
# One-click installation for Ubuntu/Debian
# Usage: curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash
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
    echo "  🚀 Billing System - Quick Installer"
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
    echo "Running: sudo apt update..."
    sudo apt update
    echo ""
    echo "Installing: curl wget git build-essential software-properties-common..."
    sudo apt install -y curl wget git build-essential software-properties-common
    echo ""
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
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
    
    node -v
    npm -v
    print_success "Node.js installed successfully"
}

install_pm2() {
    print_step "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 already installed"
        return
    fi
    
    sudo npm install -g pm2
    print_success "PM2 installed successfully"
}

install_mysql() {
    # Detect OS and set appropriate package
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" = "debian" ]; then
            MYSQL_PACKAGE="default-mysql-server"
            print_step "Installing MySQL/MariaDB Server..."
        else
            MYSQL_PACKAGE="mysql-server"
            print_step "Installing MySQL Server 8.0..."
        fi
    else
        MYSQL_PACKAGE="mysql-server"
        print_step "Installing MySQL Server 8.0..."
    fi
    
    # Check if MySQL already installed and working
    if command -v mysql &> /dev/null && sudo systemctl is-active --quiet mysql 2>/dev/null; then
        print_success "MySQL/MariaDB already installed and running"
        return
    fi
    
    # Check if MariaDB service exists
    if command -v mysql &> /dev/null && sudo systemctl is-active --quiet mariadb 2>/dev/null; then
        print_success "MySQL/MariaDB already installed and running"
        return
    fi
    
    # Cleanup any previous failed installations
    echo "Checking for previous failed installations..."
    sudo dpkg --configure -a 2>/dev/null || true
    sudo apt-get -f install -y 2>/dev/null || true
    
    # Install MySQL Server
    echo "Running: sudo apt update..."
    export DEBIAN_FRONTEND=noninteractive
    sudo apt update
    echo ""
    echo "Installing MySQL Server package (this may take 2-5 minutes)..."
    echo "Download size: ~25-50 MB"
    
    # Try to install, if fails, cleanup and retry
    if ! sudo apt install -y $MYSQL_PACKAGE; then
        print_warning "First install attempt failed, cleaning up and retrying..."
        
        # Cleanup
        sudo apt remove --purge -y mariadb-server mariadb-client mariadb-common mysql-server mysql-client mysql-common 2>/dev/null || true
        sudo apt autoremove -y
        sudo apt autoclean
        sudo dpkg --configure -a
        sudo apt-get -f install -y
        
        # Retry install
        echo "Retrying installation..."
        if ! sudo apt install -y $MYSQL_PACKAGE; then
            print_error "MySQL/MariaDB installation failed"
            echo "Please run manually: sudo apt install -y $MYSQL_PACKAGE"
            echo "Then check logs: sudo journalctl -xeu mariadb"
            exit 1
        fi
    fi
    echo ""
    
    # Start MySQL (try both mysql and mariadb service names)
    echo "Starting MySQL service..."
    if sudo systemctl start mysql 2>/dev/null; then
    sudo systemctl enable mysql
    elif sudo systemctl start mariadb 2>/dev/null; then
        sudo systemctl enable mariadb
    fi
    
    # Wait for MySQL to be ready
    echo "Waiting for MySQL to be ready..."
    sleep 5
    
    # Verify MySQL is running (check both service names)
    echo "Verifying MySQL status..."
    if sudo systemctl is-active --quiet mysql 2>/dev/null || sudo systemctl is-active --quiet mariadb 2>/dev/null; then
        print_success "MySQL Server installed and started"
    else
        print_error "MySQL failed to start"
        echo "Check MySQL status: sudo systemctl status mysql"
        echo "Or check MariaDB: sudo systemctl status mariadb"
        echo "Check logs: sudo tail -50 /var/log/mysql/error.log"
        exit 1
    fi
}

setup_database() {
    print_step "Setting up database..."
    
    # Check if MySQL/MariaDB is actually running (check both service names)
    if ! sudo systemctl is-active --quiet mysql 2>/dev/null && ! sudo systemctl is-active --quiet mariadb 2>/dev/null; then
        print_step "Starting MySQL/MariaDB..."
        if sudo systemctl start mysql 2>/dev/null; then
            sleep 5
        elif sudo systemctl start mariadb 2>/dev/null; then
            sleep 5
        fi
    fi
    
    # Wait for socket to be ready
    echo "Waiting for MySQL/MariaDB socket..."
    for i in {1..15}; do
        if [ -S /var/run/mysqld/mysqld.sock ] || [ -S /run/mysqld/mysqld.sock ]; then
            echo "Socket found, waiting for service to be fully ready..."
            sleep 3
            break
        fi
        sleep 2
    done
    
    # Test MySQL connection with retries (MariaDB can take time to fully initialize)
    print_step "Testing MySQL connection..."
    MYSQL_READY=false
    
    for attempt in {1..5}; do
        if timeout 10 sudo mysql -e "SELECT 1;" >/dev/null 2>&1; then
            MYSQL_READY=true
            break
        fi
        echo "Connection attempt $attempt/5 failed, waiting..."
        sleep 3
    done
    
    if [ "$MYSQL_READY" = false ]; then
        print_warning "MySQL connection test failed. Checking if service is running..."
        
        # Check if service is actually running
        if sudo systemctl is-active --quiet mysql 2>/dev/null || sudo systemctl is-active --quiet mariadb 2>/dev/null; then
            print_warning "Service is running but connection test failed. Will proceed anyway..."
            print_warning "This is normal for MariaDB with unix_socket authentication."
        else
            print_warning "Service not active. Attempting restart..."
            sudo systemctl restart mysql 2>/dev/null || sudo systemctl restart mariadb 2>/dev/null
            sleep 15
            
            # Check again
            if ! sudo systemctl is-active --quiet mysql 2>/dev/null && ! sudo systemctl is-active --quiet mariadb 2>/dev/null; then
                print_error "MySQL/MariaDB service failed to start. Debugging info:"
                echo ""
                echo "Service status:"
                sudo systemctl status mariadb 2>/dev/null || sudo systemctl status mysql
                echo ""
                echo "Recent logs:"
                sudo journalctl -xeu mariadb -n 20 2>/dev/null || sudo journalctl -xeu mysql -n 20
            exit 1
            fi
        fi
    else
        print_success "MySQL connection OK"
    fi
    
    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    print_step "Creating database and user..."
    
    # Create SQL file - use simpler CREATE USER for compatibility with both MySQL and MariaDB
    cat > /tmp/setup_db.sql << EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    # Execute SQL file with longer timeout
    if timeout 30 sudo mysql < /tmp/setup_db.sql >/dev/null 2>&1; then
        print_success "Database setup completed"
    else
        print_warning "Database setup with sudo mysql had issues. Trying without timeout..."
        if sudo mysql < /tmp/setup_db.sql 2>&1 | tee /tmp/db_setup_error.log; then
            print_success "Database setup completed (without timeout)"
        else
            print_error "Database setup failed. Error log:"
            cat /tmp/db_setup_error.log
            rm -f /tmp/setup_db.sql /tmp/db_setup_error.log
            echo ""
            print_error "Manual database setup required. Run:"
            echo "  sudo mysql < /tmp/setup_db.sql"
            exit 1
        fi
    fi
    
    # Clean up SQL file
    rm -f /tmp/setup_db.sql
    
    # Verify database created (non-critical check)
    if timeout 10 sudo mysql -e "USE ${DB_NAME};" 2>/dev/null; then
        print_success "Database verified: ${DB_NAME}"
    else
        print_warning "Database verification skipped (connection issue, but database might be OK)"
    fi
    
    # Verify user can connect
    if timeout 5 mysql -u ${DB_USER} -p${DB_PASSWORD} -e "SELECT 1;" ${DB_NAME} 2>/dev/null; then
        print_success "User verified: ${DB_USER}"
    else
        print_warning "User connection test failed (might work anyway)"
    fi
    
    echo ""
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
        print_warning "Directory $APP_DIR already exists. Backing up and removing..."
        BACKUP_DIR="/var/www/billing_backup_$(date +%Y%m%d_%H%M%S)"
        sudo mv "$APP_DIR" "$BACKUP_DIR"
        print_success "Old installation backed up to: $BACKUP_DIR"
    fi
    
    # Clone repository
    sudo mkdir -p /var/www
    sudo git clone https://github.com/adiprayitno160-svg/billing.git "$APP_DIR"
    
    # Set permissions
    sudo chown -R $USER:$USER "$APP_DIR"
    
    print_success "Repository cloned successfully"
}

install_app_dependencies() {
    print_step "Installing application dependencies (this may take 5-10 minutes)..."
    echo "Total packages: ~300-400 (including build tools)"
    echo "Download size: ~80-150 MB"
    echo "Please wait, downloading and installing..."
    echo ""
    
    cd "$APP_DIR"
    # Install ALL dependencies (including devDependencies for TypeScript build)
    npm install
    
    echo ""
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
DB_HOST=127.0.0.1
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
    print_step "Building application (compiling TypeScript to JavaScript)..."
    echo "This may take 1-2 minutes..."
    echo ""
    
    cd "$APP_DIR"
    npm run build
    
    echo ""
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
    pm2 start dist/server.js --name billing-system
    pm2 save
    
    # Setup startup script
    sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
    
    print_success "Application started successfully"
}

setup_firewall() {
    print_step "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 22/tcp comment 'SSH'
        sudo ufw allow ${APP_PORT}/tcp comment 'Billing System'
        sudo ufw --force enable
        print_success "Firewall configured"
    else
        print_warning "UFW not installed, skipping firewall setup"
    fi
}

create_backup_script() {
    print_step "Creating backup script..."
    
    cat > "$APP_DIR/backup-db.sh" << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/www/billing/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="billing_user"
DB_NAME="billing_system"

# Load DB password from .env
export $(grep -v '^#' /var/www/billing/.env | xargs)

mkdir -p $BACKUP_DIR

echo "Creating database backup..."
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 30 backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup complete: db_$DATE.sql.gz"
EOF
    
    chmod +x "$APP_DIR/backup-db.sh"
    mkdir -p "$APP_DIR/backups"
    
    print_success "Backup script created"
}

create_update_script() {
    print_step "Creating update script..."
    
    cat > "$APP_DIR/update.sh" << 'EOF'
#!/bin/bash

echo "🔄 Updating Billing System..."

cd /var/www/billing

# Backup database
echo "📦 Creating database backup..."
./backup-db.sh

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build
echo "🔨 Building application..."
npm run build

# Restart
echo "🚀 Restarting application..."
pm2 restart billing-system

echo "✅ Update complete!"
pm2 status
EOF
    
    chmod +x "$APP_DIR/update.sh"
    
    print_success "Update script created"
}

show_completion_message() {
    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
    
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
    echo "   3. Save your credentials securely and delete temp file"
    echo ""
    echo "📋 Useful Commands:"
    echo "   pm2 status              - Check application status"
    echo "   pm2 logs billing-system - View application logs"
    echo "   pm2 restart billing-system - Restart application"
    echo "   cd $APP_DIR && ./update.sh - Update application"
    echo "   cd $APP_DIR && ./backup-db.sh - Backup database"
    echo ""
    echo "📚 Documentation:"
    echo "   README: $APP_DIR/README.md"
    echo "   Installation Guide: $APP_DIR/INSTALL_NATIVE.md"
    echo ""
    echo -e "${YELLOW}🎉 Happy Billing!${NC}"
    echo ""
}

cleanup() {
    print_step "Cleaning up temporary files..."
    # Keep credentials file for now, user should delete manually after saving
    print_warning "Remember to save and delete: /tmp/billing_db_creds.txt"
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
    echo "This script will install:"
    echo "  • Node.js ${NODE_VERSION}.x LTS"
    echo "  • PM2 Process Manager"
    echo "  • MySQL Server 8.0"
    echo "  • Billing System Application"
    echo ""
    echo "Starting installation..."
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
    create_backup_script
    create_update_script
    cleanup
    show_completion_message
}

# Run main function
main

