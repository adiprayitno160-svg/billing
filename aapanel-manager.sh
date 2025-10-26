#!/bin/bash

################################################################################
# 🚀 aaPanel Billing System Manager
# Version: 2.0.0
# Description: All-in-one management script untuk Billing System di aaPanel
# Usage: sudo bash aapanel-manager.sh
################################################################################

set -e

# ============================================
# KONFIGURASI
# ============================================
APP_NAME="Billing System"
APP_DIR="${APP_DIR:-/www/wwwroot/billing}"
DB_NAME="${DB_NAME:-billing_system}"
APP_PORT="${APP_PORT:-3000}"
PM2_APP_NAME="billing-system"
BACKUP_DIR="/www/backup/billing"

# GitHub Configuration
GITHUB_REPO="${GITHUB_REPO:-https://github.com/adiprayitno160-svg/billing_system.git}"

# ============================================
# WARNA & STYLING
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ============================================
# FUNGSI HELPER
# ============================================

print_banner() {
    clear
    echo -e "${BLUE}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║           🚀 aaPanel Billing System Manager            ║"
    echo "║                    Version 2.0.0                        ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${PURPLE}▶ $1${NC}"
}

loading_animation() {
    local pid=$1
    local message=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %10 ))
        printf "\r${CYAN}${spin:$i:1} $message${NC}"
        sleep 0.1
    done
    printf "\r"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Script harus dijalankan sebagai root!"
        echo "Gunakan: sudo bash aapanel-manager.sh"
        exit 1
    fi
}

check_aapanel() {
    if [ ! -f "/etc/init.d/bt" ] && [ ! -d "/www/server/panel" ]; then
        print_error "aaPanel tidak terdeteksi!"
        echo ""
        echo "Install aaPanel terlebih dahulu:"
        echo "  Ubuntu/Debian: wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && bash install.sh"
        echo "  CentOS: wget -O install.sh http://www.aapanel.com/script/install_6.0_en.sh && bash install.sh"
        exit 1
    fi
    print_success "aaPanel terdeteksi"
}

detect_environment() {
    if [ -f "/.dockerenv" ]; then
        print_info "Environment: Docker Container"
        ENV_TYPE="docker"
    else
        print_info "Environment: Native Server"
        ENV_TYPE="native"
    fi
}

get_mysql_password() {
    # Try to get MySQL password from aaPanel config
    local mysql_pass=""
    
    if [ -f "/www/server/panel/default.pl" ]; then
        mysql_pass=$(cat /www/server/panel/default.pl | grep password | awk -F"'" '{print $2}' 2>/dev/null)
    fi
    
    if [ -z "$mysql_pass" ]; then
        print_warning "MySQL password tidak ditemukan otomatis"
        read -sp "Masukkan MySQL root password: " mysql_pass
        echo ""
    fi
    
    echo "$mysql_pass"
}

# ============================================
# FUNGSI INSTALASI
# ============================================

install_dependencies() {
    print_step "Menginstall dependencies..."
    
    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    fi
    
    # Update system
    print_info "Updating system packages..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get update -qq > /dev/null 2>&1
        apt-get install -y git curl wget > /dev/null 2>&1
    else
        yum update -y -q > /dev/null 2>&1
        yum install -y git curl wget > /dev/null 2>&1
    fi
    
    print_success "Dependencies installed"
}

install_nodejs() {
    print_step "Checking Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_success "Node.js sudah terinstall: $NODE_VERSION"
        
        # Check if version is 16+
        NODE_MAJOR=$(node -v | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 16 ]; then
            print_warning "Node.js versi terlalu lama, mengupgrade..."
            install_nodejs_fresh
        fi
    else
        print_info "Installing Node.js 18.x LTS..."
        install_nodejs_fresh
    fi
}

install_nodejs_fresh() {
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
        apt-get install -y nodejs > /dev/null 2>&1
    else
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
        yum install -y nodejs > /dev/null 2>&1
    fi
    
    print_success "Node.js installed: $(node -v)"
}

install_pm2() {
    print_step "Checking PM2..."
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 sudah terinstall: $(pm2 -v)"
    else
        print_info "Installing PM2..."
        npm install -g pm2 > /dev/null 2>&1
        print_success "PM2 installed: $(pm2 -v)"
    fi
}

clone_or_update_repository() {
    print_step "Setting up repository..."
    
    # Validasi URL GitHub
    if [[ "$GITHUB_REPO" == *"YOUR-USERNAME"* ]]; then
        print_warning "URL GitHub belum dikonfigurasi!"
        echo ""
        read -p "Masukkan URL GitHub repository: " GITHUB_REPO
        
        if [ -z "$GITHUB_REPO" ]; then
            print_error "URL GitHub harus diisi!"
            return 1
        fi
    fi
    
    if [ -d "$APP_DIR/.git" ]; then
        print_info "Repository sudah ada, melakukan git pull..."
        cd "$APP_DIR"
        git pull origin main > /dev/null 2>&1
        print_success "Repository updated"
    elif [ -d "$APP_DIR" ]; then
        print_warning "Direktori $APP_DIR sudah ada tapi bukan git repository"
        read -p "Backup dan clone ulang? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mv "$APP_DIR" "${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
            git clone "$GITHUB_REPO" "$APP_DIR" > /dev/null 2>&1
            print_success "Repository cloned"
        else
            return 1
        fi
    else
        print_info "Cloning repository..."
        mkdir -p "$(dirname "$APP_DIR")"
        git clone "$GITHUB_REPO" "$APP_DIR" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            print_success "Repository cloned"
        else
            print_error "Gagal clone repository!"
            echo ""
            echo "Tips untuk repository private:"
            echo "1. Generate SSH key: ssh-keygen -t rsa -b 4096 -C 'deploy' -f ~/.ssh/id_rsa -N ''"
            echo "2. Copy key: cat ~/.ssh/id_rsa.pub"
            echo "3. Tambahkan ke GitHub: Settings > SSH Keys"
            return 1
        fi
    fi
}

setup_database() {
    print_step "Setting up database..."
    
    MYSQL_ROOT_PASS=$(get_mysql_password)
    
    # Create database
    mysql -uroot -p"$MYSQL_ROOT_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_success "Database '$DB_NAME' created"
    else
        print_error "Gagal membuat database"
        return 1
    fi
    
    # Create user
    DB_USER="billing_user"
    DB_PASS=$(openssl rand -base64 16)
    
    mysql -uroot -p"$MYSQL_ROOT_PASS" <<EOF 2>/dev/null
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    print_success "Database user created"
    
    # Save credentials
    echo "$DB_USER" > /tmp/billing_db_user
    echo "$DB_PASS" > /tmp/billing_db_pass
    chmod 600 /tmp/billing_db_*
}

create_env_file() {
    print_step "Creating .env configuration..."
    
    cd "$APP_DIR"
    
    # Get saved credentials
    DB_USER=$(cat /tmp/billing_db_user 2>/dev/null || echo "billing_user")
    DB_PASS=$(cat /tmp/billing_db_pass 2>/dev/null || openssl rand -base64 16)
    SESSION_SECRET=$(openssl rand -base64 32)
    
    cat > .env << EOF
# =============================================
# Billing System Configuration
# Generated: $(date)
# =============================================

# Application
NODE_ENV=production
PORT=$APP_PORT
APP_NAME=Billing System

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME

# Session
SESSION_SECRET=$SESSION_SECRET

# App Configuration
HIDE_BILLING_CUSTOMERS_MENU=false

# Telegram Bot (optional - configure via Settings)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# WhatsApp
WA_SESSION_PATH=./whatsapp-session

# Payment Gateways (optional - configure via Settings)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

XENDIT_API_KEY=
TRIPAY_API_KEY=
TRIPAY_PRIVATE_KEY=

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# MikroTik (optional)
MIKROTIK_HOST=
MIKROTIK_USER=
MIKROTIK_PASSWORD=
EOF
    
    chmod 600 .env
    print_success ".env file created"
    
    # Save credentials to file
    cat > "$APP_DIR/CREDENTIALS.txt" << EOF
===========================================
BILLING SYSTEM - CREDENTIALS
===========================================
Generated: $(date)

DATABASE
--------
Host     : localhost
Port     : 3306
Database : $DB_NAME
User     : $DB_USER
Password : $DB_PASS

DEFAULT LOGIN
-------------
Admin    : admin / admin123
Kasir    : kasir / kasir123

⚠️ PENTING:
1. GANTI PASSWORD DEFAULT setelah login!
2. SIMPAN FILE INI DI TEMPAT AMAN!
3. JANGAN commit file ini ke Git!

===========================================
EOF
    
    chmod 600 "$APP_DIR/CREDENTIALS.txt"
    print_info "Credentials saved to: $APP_DIR/CREDENTIALS.txt"
}

build_application() {
    print_step "Building application..."
    
    cd "$APP_DIR"
    
    # Install dependencies
    print_info "Installing npm packages (ini mungkin memakan waktu beberapa menit)..."
    npm install --production > /tmp/npm_install.log 2>&1 &
    loading_animation $! "Installing packages"
    wait $!
    
    if [ $? -eq 0 ]; then
        print_success "NPM packages installed"
    else
        print_error "NPM install gagal! Cek /tmp/npm_install.log"
        return 1
    fi
    
    # Build TypeScript
    print_info "Building TypeScript..."
    npm run build > /tmp/npm_build.log 2>&1 &
    loading_animation $! "Building application"
    wait $!
    
    if [ $? -eq 0 ] && [ -d "dist" ]; then
        print_success "Build successful"
    else
        print_error "Build gagal! Cek /tmp/npm_build.log"
        return 1
    fi
}

start_with_pm2() {
    print_step "Starting application with PM2..."
    
    cd "$APP_DIR"
    
    # Stop if running
    pm2 delete $PM2_APP_NAME 2>/dev/null || true
    
    # Start application
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start dist/server.js --name $PM2_APP_NAME
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Application started"
        
        # Save PM2 config
        pm2 save > /dev/null 2>&1
        
        # Setup startup script
        pm2 startup systemd -u root --hp /root > /dev/null 2>&1
        
        print_success "PM2 configured for auto-start"
    else
        print_error "Gagal start application"
        return 1
    fi
}

setup_nginx() {
    print_step "Setting up Nginx reverse proxy..."
    
    read -p "Masukkan domain (atau tekan Enter untuk skip): " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        print_info "Nginx setup skipped"
        return 0
    fi
    
    NGINX_CONF="/www/server/panel/vhost/nginx/$DOMAIN.conf"
    
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    
    # Logging
    access_log /www/wwwlogs/DOMAIN_PLACEHOLDER.log;
    error_log /www/wwwlogs/DOMAIN_PLACEHOLDER.error.log;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:APP_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
    
    # Static files
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        proxy_pass http://localhost:APP_PORT_PLACEHOLDER;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Replace placeholders
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_CONF"
    sed -i "s/APP_PORT_PLACEHOLDER/$APP_PORT/g" "$NGINX_CONF"
    
    # Test Nginx config
    /www/server/nginx/sbin/nginx -t > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        # Reload Nginx
        /etc/init.d/nginx reload > /dev/null 2>&1
        print_success "Nginx configured for domain: $DOMAIN"
        
        echo ""
        print_info "Untuk setup SSL:"
        echo "1. Login ke aaPanel"
        echo "2. Website > $DOMAIN > SSL"
        echo "3. Pilih Let's Encrypt"
        echo "4. Klik Apply"
    else
        print_error "Nginx configuration error"
        rm "$NGINX_CONF"
    fi
}

# ============================================
# FUNGSI UPDATE
# ============================================

update_application() {
    print_banner
    echo -e "${YELLOW}🔄 UPDATE APPLICATION${NC}"
    echo "======================================"
    echo ""
    
    if [ ! -d "$APP_DIR" ]; then
        print_error "Aplikasi belum terinstall!"
        return 1
    fi
    
    cd "$APP_DIR"
    
    # Backup current version
    print_step "Creating backup..."
    create_backup_internal
    
    # Pull latest changes
    print_step "Pulling latest changes from GitHub..."
    git pull origin main
    
    if [ $? -ne 0 ]; then
        print_error "Git pull gagal!"
        return 1
    fi
    
    # Install dependencies
    print_step "Installing dependencies..."
    npm install --production > /dev/null 2>&1
    
    # Build
    print_step "Building application..."
    npm run build > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        print_error "Build gagal!"
        return 1
    fi
    
    # Restart PM2
    print_step "Restarting application..."
    pm2 restart $PM2_APP_NAME
    
    print_success "Update completed successfully!"
    
    # Show logs
    echo ""
    print_info "Checking application status..."
    sleep 2
    pm2 logs $PM2_APP_NAME --lines 20 --nostream
}

# ============================================
# FUNGSI BACKUP & RESTORE
# ============================================

create_backup() {
    print_banner
    echo -e "${YELLOW}💾 CREATE BACKUP${NC}"
    echo "======================================"
    echo ""
    
    create_backup_internal
    
    echo ""
    read -p "Tekan Enter untuk kembali ke menu..."
}

create_backup_internal() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/billing_backup_$TIMESTAMP.tar.gz"
    
    mkdir -p "$BACKUP_DIR"
    
    print_step "Creating backup..."
    
    # Backup application files
    cd "$(dirname "$APP_DIR")"
    tar -czf "$BACKUP_FILE" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='logs' \
        "$(basename "$APP_DIR")" > /dev/null 2>&1
    
    # Backup database
    if [ -f "$APP_DIR/.env" ]; then
        DB_USER=$(grep DB_USER "$APP_DIR/.env" | cut -d'=' -f2)
        DB_PASS=$(grep DB_PASSWORD "$APP_DIR/.env" | cut -d'=' -f2)
        
        MYSQL_ROOT_PASS=$(get_mysql_password)
        
        mysqldump -uroot -p"$MYSQL_ROOT_PASS" "$DB_NAME" > "$BACKUP_DIR/billing_db_$TIMESTAMP.sql" 2>/dev/null
        
        # Compress database
        gzip "$BACKUP_DIR/billing_db_$TIMESTAMP.sql"
    fi
    
    print_success "Backup created: $BACKUP_FILE"
    print_info "Database backup: $BACKUP_DIR/billing_db_$TIMESTAMP.sql.gz"
    
    # Keep only last 10 backups
    cd "$BACKUP_DIR"
    ls -t billing_backup_*.tar.gz | tail -n +11 | xargs -r rm
    ls -t billing_db_*.sql.gz | tail -n +11 | xargs -r rm
    
    print_info "Old backups cleaned (keeping last 10)"
}

restore_backup() {
    print_banner
    echo -e "${YELLOW}♻️  RESTORE BACKUP${NC}"
    echo "======================================"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_error "Tidak ada backup ditemukan!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    print_step "Available backups:"
    echo ""
    
    # List backups
    backups=($(ls -t "$BACKUP_DIR"/billing_backup_*.tar.gz 2>/dev/null))
    
    if [ ${#backups[@]} -eq 0 ]; then
        print_error "Tidak ada backup ditemukan!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    for i in "${!backups[@]}"; do
        filename=$(basename "${backups[$i]}")
        size=$(du -h "${backups[$i]}" | cut -f1)
        echo "  $((i+1)). $filename ($size)"
    done
    
    echo ""
    read -p "Pilih backup untuk restore (1-${#backups[@]}): " choice
    
    if [[ ! "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#backups[@]} ]; then
        print_error "Pilihan tidak valid!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    BACKUP_FILE="${backups[$((choice-1))]}"
    
    print_warning "PERINGATAN: Ini akan menimpa instalasi saat ini!"
    read -p "Lanjutkan? (y/n): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Restore dibatalkan"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    # Stop application
    print_step "Stopping application..."
    pm2 stop $PM2_APP_NAME > /dev/null 2>&1 || true
    
    # Backup current version
    if [ -d "$APP_DIR" ]; then
        mv "$APP_DIR" "${APP_DIR}_before_restore_$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Restore files
    print_step "Restoring files..."
    cd "$(dirname "$APP_DIR")"
    tar -xzf "$BACKUP_FILE" > /dev/null 2>&1
    
    # Restore database
    DB_BACKUP="${BACKUP_FILE/.tar.gz/_db.sql.gz}"
    DB_BACKUP="${DB_BACKUP/billing_backup/billing_db}"
    
    if [ -f "$DB_BACKUP" ]; then
        print_step "Restoring database..."
        MYSQL_ROOT_PASS=$(get_mysql_password)
        gunzip < "$DB_BACKUP" | mysql -uroot -p"$MYSQL_ROOT_PASS" "$DB_NAME" 2>/dev/null
        print_success "Database restored"
    fi
    
    # Restart application
    print_step "Restarting application..."
    cd "$APP_DIR"
    pm2 restart $PM2_APP_NAME
    
    print_success "Restore completed successfully!"
    
    echo ""
    read -p "Tekan Enter untuk kembali ke menu..."
}

# ============================================
# FUNGSI MONITORING
# ============================================

show_status() {
    print_banner
    echo -e "${YELLOW}📊 APPLICATION STATUS${NC}"
    echo "======================================"
    echo ""
    
    print_step "PM2 Status:"
    pm2 status $PM2_APP_NAME
    
    echo ""
    print_step "Application Info:"
    echo "  📁 Directory  : $APP_DIR"
    echo "  🌐 Port       : $APP_PORT"
    echo "  🗄️  Database   : $DB_NAME"
    
    if [ -f "$APP_DIR/.env" ]; then
        NODE_ENV=$(grep NODE_ENV "$APP_DIR/.env" | cut -d'=' -f2)
        echo "  🔧 Environment: $NODE_ENV"
    fi
    
    echo ""
    print_step "System Resources:"
    echo "  💻 CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "  🧠 RAM: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
    echo "  💾 Disk: $(df -h "$APP_DIR" | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
    
    if command -v pm2 &> /dev/null; then
        echo ""
        print_step "Recent Logs (last 20 lines):"
        echo ""
        pm2 logs $PM2_APP_NAME --lines 20 --nostream 2>/dev/null || echo "  No logs available"
    fi
    
    echo ""
    read -p "Tekan Enter untuk kembali ke menu..."
}

view_logs() {
    print_banner
    echo -e "${YELLOW}📜 APPLICATION LOGS${NC}"
    echo "======================================"
    echo ""
    
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 tidak terinstall!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    echo "1. Real-time logs"
    echo "2. Error logs only"
    echo "3. Last 50 lines"
    echo "4. Last 100 lines"
    echo "5. Kembali"
    echo ""
    read -p "Pilih opsi (1-5): " choice
    
    case $choice in
        1)
            print_info "Tekan Ctrl+C untuk keluar"
            sleep 2
            pm2 logs $PM2_APP_NAME
            ;;
        2)
            pm2 logs $PM2_APP_NAME --err --lines 50
            ;;
        3)
            pm2 logs $PM2_APP_NAME --lines 50 --nostream
            ;;
        4)
            pm2 logs $PM2_APP_NAME --lines 100 --nostream
            ;;
        5)
            return
            ;;
        *)
            print_error "Pilihan tidak valid!"
            ;;
    esac
    
    echo ""
    read -p "Tekan Enter untuk kembali ke menu..."
}

# ============================================
# FUNGSI MANAJEMEN
# ============================================

restart_app() {
    print_step "Restarting application..."
    pm2 restart $PM2_APP_NAME
    print_success "Application restarted"
    sleep 2
}

stop_app() {
    print_step "Stopping application..."
    pm2 stop $PM2_APP_NAME
    print_success "Application stopped"
    sleep 2
}

start_app() {
    print_step "Starting application..."
    cd "$APP_DIR"
    
    if pm2 list | grep -q $PM2_APP_NAME; then
        pm2 start $PM2_APP_NAME
    else
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js --env production
        else
            pm2 start dist/server.js --name $PM2_APP_NAME
        fi
    fi
    
    print_success "Application started"
    sleep 2
}

manage_application() {
    while true; do
        print_banner
        echo -e "${YELLOW}⚙️  MANAGE APPLICATION${NC}"
        echo "======================================"
        echo ""
        echo "1. Restart application"
        echo "2. Stop application"
        echo "3. Start application"
        echo "4. Rebuild application"
        echo "5. Clear cache & restart"
        echo "6. Reset to default"
        echo "7. Kembali"
        echo ""
        read -p "Pilih opsi (1-7): " choice
        
        case $choice in
            1)
                restart_app
                ;;
            2)
                stop_app
                ;;
            3)
                start_app
                ;;
            4)
                cd "$APP_DIR"
                print_step "Rebuilding..."
                npm run build > /dev/null 2>&1
                restart_app
                ;;
            5)
                cd "$APP_DIR"
                print_step "Clearing cache..."
                rm -rf node_modules/.cache dist
                npm run build > /dev/null 2>&1
                restart_app
                ;;
            6)
                print_warning "Ini akan reset aplikasi ke default!"
                read -p "Lanjutkan? (y/n): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    cd "$APP_DIR"
                    git reset --hard origin/main
                    npm run build > /dev/null 2>&1
                    restart_app
                fi
                ;;
            7)
                break
                ;;
            *)
                print_error "Pilihan tidak valid!"
                sleep 1
                ;;
        esac
    done
}

# ============================================
# FUNGSI UNINSTALL
# ============================================

uninstall_application() {
    print_banner
    echo -e "${RED}🗑️  UNINSTALL APPLICATION${NC}"
    echo "======================================"
    echo ""
    
    print_warning "PERINGATAN: Ini akan menghapus semua data aplikasi!"
    echo ""
    echo "Yang akan dihapus:"
    echo "  • Aplikasi di $APP_DIR"
    echo "  • Database $DB_NAME"
    echo "  • PM2 configuration"
    echo ""
    
    read -p "Ketik 'UNINSTALL' untuk konfirmasi: " confirm
    
    if [ "$confirm" != "UNINSTALL" ]; then
        print_info "Uninstall dibatalkan"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    print_step "Creating final backup..."
    create_backup_internal
    
    # Stop PM2
    print_step "Stopping PM2 process..."
    pm2 delete $PM2_APP_NAME 2>/dev/null || true
    pm2 save > /dev/null 2>&1
    
    # Remove application directory
    print_step "Removing application files..."
    rm -rf "$APP_DIR"
    
    # Drop database
    print_step "Removing database..."
    MYSQL_ROOT_PASS=$(get_mysql_password)
    mysql -uroot -p"$MYSQL_ROOT_PASS" -e "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
    
    print_success "Application uninstalled successfully!"
    print_info "Backup tersimpan di: $BACKUP_DIR"
    
    echo ""
    read -p "Tekan Enter untuk keluar..."
    exit 0
}

# ============================================
# FUNGSI INSTALASI LENGKAP
# ============================================

full_installation() {
    print_banner
    echo -e "${YELLOW}🚀 FULL INSTALLATION${NC}"
    echo "======================================"
    echo ""
    
    print_info "Instalasi akan dimulai dengan langkah-langkah berikut:"
    echo "  1. Check prerequisites"
    echo "  2. Install dependencies"
    echo "  3. Clone repository"
    echo "  4. Setup database"
    echo "  5. Configure application"
    echo "  6. Build & start"
    echo "  7. Setup Nginx (optional)"
    echo ""
    
    read -p "Lanjutkan? (y/n): " -n 1 -r
    echo ""
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    # Check prerequisites
    check_aapanel
    detect_environment
    
    # Install dependencies
    install_dependencies
    install_nodejs
    install_pm2
    
    # Clone repository
    if ! clone_or_update_repository; then
        print_error "Instalasi gagal!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    # Setup database
    if ! setup_database; then
        print_error "Setup database gagal!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    # Create .env
    create_env_file
    
    # Build application
    if ! build_application; then
        print_error "Build gagal!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    # Start with PM2
    if ! start_with_pm2; then
        print_error "Start aplikasi gagal!"
        read -p "Tekan Enter untuk kembali ke menu..."
        return
    fi
    
    # Setup Nginx (optional)
    echo ""
    print_info "Setup Nginx reverse proxy (recommended untuk production)"
    setup_nginx
    
    # Display success message
    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║            ✅ INSTALLATION COMPLETED!                   ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo -e "${BLUE}📋 Application Information:${NC}"
    echo "  🌐 URL        : http://$SERVER_IP:$APP_PORT"
    echo "  📁 Directory  : $APP_DIR"
    echo "  🗄️  Database   : $DB_NAME"
    echo ""
    
    echo -e "${BLUE}🔑 Default Login:${NC}"
    echo "  Admin: admin / admin123"
    echo "  Kasir: kasir / kasir123"
    echo ""
    
    echo -e "${YELLOW}⚠️  PENTING:${NC}"
    echo "  1. GANTI password default setelah login!"
    echo "  2. Simpan credentials di: $APP_DIR/CREDENTIALS.txt"
    echo "  3. Konfigurasi payment gateway via Settings"
    echo ""
    
    echo -e "${BLUE}📝 Useful Commands:${NC}"
    echo "  Status  : pm2 status"
    echo "  Logs    : pm2 logs $PM2_APP_NAME"
    echo "  Restart : pm2 restart $PM2_APP_NAME"
    echo ""
    
    # Clean up temp files
    rm -f /tmp/billing_db_*
    
    read -p "Tekan Enter untuk kembali ke menu..."
}

# ============================================
# MENU UTAMA
# ============================================

main_menu() {
    while true; do
        print_banner
        
        echo -e "${WHITE}MAIN MENU${NC}"
        echo "======================================"
        echo ""
        echo "  ${CYAN}INSTALASI & UPDATE${NC}"
        echo "  1. 🚀 Full Installation"
        echo "  2. 🔄 Update Application"
        echo ""
        echo "  ${CYAN}MONITORING${NC}"
        echo "  3. 📊 Show Status"
        echo "  4. 📜 View Logs"
        echo ""
        echo "  ${CYAN}MANAGEMENT${NC}"
        echo "  5. ⚙️  Manage Application"
        echo "  6. 💾 Create Backup"
        echo "  7. ♻️  Restore Backup"
        echo ""
        echo "  ${CYAN}KONFIGURASI${NC}"
        echo "  8. 🌐 Setup Nginx"
        echo "  9. 🔧 Edit .env"
        echo ""
        echo "  ${CYAN}LAINNYA${NC}"
        echo "  10. 🗑️  Uninstall"
        echo "  11. ❌ Exit"
        echo ""
        echo "======================================"
        read -p "Pilih menu (1-11): " choice
        
        case $choice in
            1)
                full_installation
                ;;
            2)
                update_application
                read -p "Tekan Enter untuk kembali ke menu..."
                ;;
            3)
                show_status
                ;;
            4)
                view_logs
                ;;
            5)
                manage_application
                ;;
            6)
                create_backup
                ;;
            7)
                restore_backup
                ;;
            8)
                setup_nginx
                read -p "Tekan Enter untuk kembali ke menu..."
                ;;
            9)
                if [ -f "$APP_DIR/.env" ]; then
                    nano "$APP_DIR/.env"
                    print_info "Restart aplikasi untuk apply perubahan"
                    read -p "Restart sekarang? (y/n): " -n 1 -r
                    echo
                    if [[ $REPLY =~ ^[Yy]$ ]]; then
                        restart_app
                    fi
                else
                    print_error "File .env tidak ditemukan!"
                    read -p "Tekan Enter untuk kembali ke menu..."
                fi
                ;;
            10)
                uninstall_application
                ;;
            11)
                echo ""
                print_info "Terima kasih telah menggunakan aaPanel Manager!"
                echo ""
                exit 0
                ;;
            *)
                print_error "Pilihan tidak valid!"
                sleep 1
                ;;
        esac
    done
}

# ============================================
# MAIN SCRIPT
# ============================================

# Check if running as root
check_root

# Start main menu
main_menu

