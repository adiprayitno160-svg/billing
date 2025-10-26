#!/bin/bash

# ============================================
# Billing System - Complete Setup Script
# ============================================
# Complete installation with Nginx + SSL
# Usage: curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/setup-complete.sh | bash
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
# Source Quick Install Script
# ============================================

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================
# Run Quick Install First
# ============================================

print_step "Running quick install first..."

# Download and run quick install
curl -fsSL https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install.sh | bash

if [ $? -ne 0 ]; then
    print_error "Quick install failed"
    exit 1
fi

print_success "Quick install completed"

# ============================================
# Additional Setup Functions
# ============================================

install_nginx() {
    print_step "Installing Nginx..."
    
    if command -v nginx &> /dev/null; then
        print_success "Nginx already installed"
        return
    fi
    
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_success "Nginx installed and started"
}

get_domain_name() {
    echo ""
    echo "================================"
    echo "  Domain Configuration"
    echo "================================"
    echo ""
    echo "Enter your domain name (e.g., billing.example.com)"
    echo "Or press Enter to skip (use IP address only)"
    read -p "Domain name: " DOMAIN_NAME
    
    if [ -z "$DOMAIN_NAME" ]; then
        print_warning "Skipping domain configuration"
        return 1
    fi
    
    # Verify domain points to this server
    SERVER_IP=$(curl -s ifconfig.me)
    DOMAIN_IP=$(dig +short "$DOMAIN_NAME" | tail -n1)
    
    if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
        print_warning "Domain $DOMAIN_NAME does not point to this server ($SERVER_IP)"
        print_warning "Please update your DNS records first"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    return 0
}

setup_nginx_config() {
    print_step "Configuring Nginx..."
    
    local config_file="/etc/nginx/sites-available/billing"
    
    if [ -n "$DOMAIN_NAME" ]; then
        local server_name="$DOMAIN_NAME"
    else
        local server_name="_"
    fi
    
    sudo tee "$config_file" > /dev/null << EOF
server {
    listen 80;
    server_name ${server_name};

    # Logging
    access_log /var/log/nginx/billing_access.log;
    error_log /var/log/nginx/billing_error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size
    client_max_body_size 100M;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        proxy_pass http://localhost:${APP_PORT};
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site
    sudo ln -sf "$config_file" /etc/nginx/sites-enabled/billing
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    sudo nginx -t
    
    # Reload Nginx
    sudo systemctl reload nginx
    
    print_success "Nginx configured successfully"
}

install_certbot() {
    print_step "Installing Certbot for SSL..."
    
    if command -v certbot &> /dev/null; then
        print_success "Certbot already installed"
        return
    fi
    
    sudo apt install -y certbot python3-certbot-nginx
    print_success "Certbot installed"
}

setup_ssl() {
    if [ -z "$DOMAIN_NAME" ]; then
        print_warning "Skipping SSL setup (no domain configured)"
        return
    fi
    
    print_step "Setting up SSL certificate..."
    
    echo ""
    echo "We will now obtain a free SSL certificate from Let's Encrypt"
    read -p "Enter your email address: " EMAIL
    
    if [ -z "$EMAIL" ]; then
        print_error "Email is required for SSL certificate"
        return
    fi
    
    # Obtain certificate
    sudo certbot --nginx \
        -d "$DOMAIN_NAME" \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --redirect
    
    if [ $? -eq 0 ]; then
        print_success "SSL certificate installed successfully"
        
        # Setup auto-renewal
        sudo systemctl enable certbot.timer
        sudo systemctl start certbot.timer
        
        print_success "SSL auto-renewal configured"
    else
        print_error "SSL certificate installation failed"
        print_warning "You can try again manually with: sudo certbot --nginx"
    fi
}

configure_firewall_complete() {
    print_step "Updating firewall configuration..."
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 80/tcp comment 'HTTP'
        sudo ufw allow 443/tcp comment 'HTTPS'
        
        # Remove direct app port access if using Nginx
        if [ -n "$DOMAIN_NAME" ]; then
            sudo ufw delete allow ${APP_PORT}/tcp 2>/dev/null || true
        fi
        
        sudo ufw --force enable
        print_success "Firewall updated"
    fi
}

setup_monitoring() {
    print_step "Setting up monitoring tools..."
    
    read -p "Install monitoring tools (htop, netdata)? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Skipping monitoring tools"
        return
    fi
    
    sudo apt install -y htop
    print_success "htop installed"
    
    # Install netdata
    bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait
    
    if [ $? -eq 0 ]; then
        print_success "Netdata installed"
        SERVER_IP=$(curl -s ifconfig.me)
        echo "Access Netdata dashboard at: http://${SERVER_IP}:19999"
    fi
}

setup_auto_backup() {
    print_step "Setting up automatic daily backups..."
    
    # Create cron job for daily backup at 2 AM
    (crontab -l 2>/dev/null | grep -v "backup-db.sh"; echo "0 2 * * * $APP_DIR/backup-db.sh >> /var/log/billing-backup.log 2>&1") | crontab -
    
    print_success "Daily backup scheduled at 2:00 AM"
}

show_complete_message() {
    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
    
    echo ""
    echo -e "${GREEN}============================================"
    echo "  ✅ Complete Setup Finished!"
    echo "============================================${NC}"
    echo ""
    echo "🌐 Access your Billing System:"
    
    if [ -n "$DOMAIN_NAME" ]; then
        echo "   https://${DOMAIN_NAME} (with SSL)"
        echo "   http://${DOMAIN_NAME} (redirects to HTTPS)"
    else
        echo "   http://${SERVER_IP}"
    fi
    echo ""
    echo "🔐 Default Login Credentials:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "🛡️  Security Features Enabled:"
    echo "   ✓ Nginx reverse proxy"
    if [ -n "$DOMAIN_NAME" ]; then
        echo "   ✓ SSL/HTTPS encryption"
        echo "   ✓ Auto SSL renewal"
    fi
    echo "   ✓ Firewall configured"
    echo "   ✓ Daily database backup (2:00 AM)"
    echo ""
    echo "⚠️  IMPORTANT:"
    echo "   1. Change default admin password NOW!"
    echo "   2. Save database credentials from: /tmp/billing_db_creds.txt"
    echo "   3. Then delete the temp file"
    echo ""
    echo "📋 Management Commands:"
    echo "   sudo systemctl status nginx    - Check Nginx status"
    echo "   pm2 status                     - Check app status"
    echo "   pm2 logs billing-system        - View app logs"
    echo "   sudo tail -f /var/log/nginx/billing_error.log - Nginx logs"
    if [ -n "$DOMAIN_NAME" ]; then
        echo "   sudo certbot renew --dry-run   - Test SSL renewal"
    fi
    echo ""
    echo -e "${YELLOW}🎉 Your production-ready Billing System is live!${NC}"
    echo ""
}

# ============================================
# Main Complete Setup Flow
# ============================================

main_complete() {
    echo ""
    echo -e "${BLUE}============================================"
    echo "  🚀 Complete Setup - Additional Configuration"
    echo "============================================${NC}"
    echo ""
    
    install_nginx
    
    if get_domain_name; then
        setup_nginx_config
        install_certbot
        setup_ssl
        configure_firewall_complete
    else
        setup_nginx_config
        configure_firewall_complete
    fi
    
    setup_auto_backup
    setup_monitoring
    show_complete_message
}

# Run complete setup
main_complete

