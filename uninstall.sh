#!/bin/bash

# ============================================
# Billing System - Uninstall Script
# ============================================
# Removes Billing System and optionally all dependencies
# Usage: bash uninstall.sh
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/billing"
DB_NAME="billing_system"
DB_USER="billing_user"

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo -e "${RED}"
    echo "============================================"
    echo "  🗑️  Billing System - Uninstaller"
    echo "============================================"
    echo -e "${NC}"
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
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

confirm() {
    read -p "$1 (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# ============================================
# Backup Functions
# ============================================

backup_database() {
    print_step "Creating final database backup..."
    
    local backup_dir="$HOME/billing_uninstall_backup"
    mkdir -p "$backup_dir"
    
    if command -v mysql &> /dev/null; then
        if sudo mysql -e "USE $DB_NAME" 2>/dev/null; then
            local backup_file="$backup_dir/billing_final_backup_$(date +%Y%m%d_%H%M%S).sql"
            
            # Try to load password from .env
            if [ -f "$APP_DIR/.env" ]; then
                export $(grep -v '^#' "$APP_DIR/.env" | xargs)
                mysqldump -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$backup_file" 2>/dev/null || \
                sudo mysqldump "$DB_NAME" > "$backup_file"
            else
                sudo mysqldump "$DB_NAME" > "$backup_file"
            fi
            
            gzip "$backup_file"
            print_success "Backup saved to: ${backup_file}.gz"
        else
            print_warning "Database not found, skipping backup"
        fi
    else
        print_warning "MySQL not found, skipping backup"
    fi
}

backup_config() {
    print_step "Backing up configuration files..."
    
    local backup_dir="$HOME/billing_uninstall_backup"
    mkdir -p "$backup_dir"
    
    if [ -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env" "$backup_dir/.env.backup"
        print_success "Configuration backed up"
    fi
}

# ============================================
# Uninstall Functions
# ============================================

stop_application() {
    print_step "Stopping application..."
    
    if command -v pm2 &> /dev/null; then
        pm2 stop billing-system 2>/dev/null || true
        pm2 delete billing-system 2>/dev/null || true
        pm2 save --force 2>/dev/null || true
        print_success "Application stopped"
    else
        print_warning "PM2 not found, skipping"
    fi
}

remove_application_files() {
    print_step "Removing application files..."
    
    if [ -d "$APP_DIR" ]; then
        sudo rm -rf "$APP_DIR"
        print_success "Application files removed"
    else
        print_warning "Application directory not found"
    fi
}

remove_nginx_config() {
    print_step "Removing Nginx configuration..."
    
    if [ -f /etc/nginx/sites-enabled/billing ]; then
        sudo rm -f /etc/nginx/sites-enabled/billing
        sudo rm -f /etc/nginx/sites-available/billing
        
        if command -v nginx &> /dev/null; then
            sudo systemctl reload nginx 2>/dev/null || true
        fi
        
        print_success "Nginx configuration removed"
    else
        print_warning "Nginx configuration not found"
    fi
}

remove_ssl_certificate() {
    print_step "Checking SSL certificates..."
    
    if command -v certbot &> /dev/null; then
        local certs=$(sudo certbot certificates 2>/dev/null | grep "billing" || true)
        
        if [ -n "$certs" ]; then
            echo "Found SSL certificates for billing domain"
            if confirm "Remove SSL certificates?"; then
                sudo certbot delete --cert-name billing 2>/dev/null || true
                print_success "SSL certificates removed"
            else
                print_warning "Keeping SSL certificates"
            fi
        fi
    fi
}

remove_database() {
    print_step "Removing database..."
    
    if command -v mysql &> /dev/null; then
        if confirm "Remove database '$DB_NAME' and user '$DB_USER'? THIS CANNOT BE UNDONE!"; then
            sudo mysql -e "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
            sudo mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || true
            sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
            print_success "Database and user removed"
        else
            print_warning "Keeping database and user"
        fi
    fi
}

remove_cron_jobs() {
    print_step "Removing cron jobs..."
    
    (crontab -l 2>/dev/null | grep -v "billing" || true) | crontab -
    print_success "Cron jobs removed"
}

remove_firewall_rules() {
    print_step "Checking firewall rules..."
    
    if command -v ufw &> /dev/null; then
        if confirm "Remove firewall rules for billing (port 3000)?"; then
            sudo ufw delete allow 3000/tcp 2>/dev/null || true
            print_success "Firewall rules removed"
        fi
    fi
}

remove_dependencies() {
    print_step "Checking system dependencies..."
    
    echo ""
    echo "The following packages were installed:"
    echo "  - Node.js"
    echo "  - PM2"
    echo "  - MySQL/MariaDB"
    echo "  - Nginx"
    echo "  - Certbot"
    echo ""
    
    if confirm "Do you want to remove these packages? (Not recommended if used by other apps)"; then
        
        if confirm "Remove PM2?"; then
            sudo npm uninstall -g pm2 2>/dev/null || true
            print_success "PM2 removed"
        fi
        
        if confirm "Remove Node.js?"; then
            sudo apt remove -y nodejs 2>/dev/null || true
            sudo apt autoremove -y 2>/dev/null || true
            print_success "Node.js removed"
        fi
        
        if confirm "Remove MySQL/MariaDB?"; then
            sudo apt remove -y mariadb-server mariadb-client mysql-server 2>/dev/null || true
            sudo apt autoremove -y 2>/dev/null || true
            print_success "Database server removed"
        fi
        
        if confirm "Remove Nginx?"; then
            sudo apt remove -y nginx 2>/dev/null || true
            sudo apt autoremove -y 2>/dev/null || true
            print_success "Nginx removed"
        fi
        
        if confirm "Remove Certbot?"; then
            sudo apt remove -y certbot python3-certbot-nginx 2>/dev/null || true
            sudo apt autoremove -y 2>/dev/null || true
            print_success "Certbot removed"
        fi
    else
        print_warning "Keeping system dependencies"
    fi
}

show_summary() {
    echo ""
    echo -e "${GREEN}============================================"
    echo "  ✅ Uninstall Complete"
    echo "============================================${NC}"
    echo ""
    echo "📦 Backup Location:"
    echo "   $HOME/billing_uninstall_backup/"
    echo ""
    echo "Files backed up:"
    echo "   - Database dump (if created)"
    echo "   - .env configuration"
    echo ""
    echo "🗑️  Removed:"
    echo "   - Application files"
    echo "   - PM2 processes"
    echo "   - Nginx configuration"
    echo "   - Firewall rules (if confirmed)"
    echo "   - Database (if confirmed)"
    echo ""
    echo "⚠️  Keep backup files safe if you plan to reinstall!"
    echo ""
}

# ============================================
# Main Uninstall Flow
# ============================================

main() {
    clear
    print_header
    
    echo ""
    echo "This script will uninstall Billing System from your server."
    echo ""
    print_warning "WARNING: This action may be irreversible!"
    echo ""
    
    if ! confirm "Continue with uninstallation?"; then
        print_error "Uninstall cancelled"
        exit 1
    fi
    
    echo ""
    
    # Always backup first
    backup_database
    backup_config
    
    echo ""
    
    # Stop and remove application
    stop_application
    remove_application_files
    remove_nginx_config
    remove_ssl_certificate
    remove_cron_jobs
    remove_firewall_rules
    
    echo ""
    
    # Ask about database
    remove_database
    
    echo ""
    
    # Ask about dependencies
    remove_dependencies
    
    # Show summary
    show_summary
}

# Run main function
main

