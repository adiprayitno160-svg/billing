#!/bin/bash

# ========================================
# BILLING SYSTEM - AUTO SETUP SCRIPT
# For aaPanel Docker Container
# ========================================

echo "🚀 BILLING SYSTEM - AUTOMATED SETUP"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
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
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use: sudo bash server-setup.sh)"
    exit 1
fi

# Step 1: Update & Install Git
echo ""
echo "📦 Step 1: Installing dependencies..."
apt-get update -qq
apt-get install -y git curl wget &> /dev/null
print_success "Git and curl installed"

# Step 2: Clone Repository
echo ""
echo "📥 Step 2: Cloning repository..."
read -p "Enter GitHub repository URL: " REPO_URL
read -p "Enter installation directory [/www/wwwroot/billing]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/www/wwwroot/billing}

if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Remove and re-clone? (y/n): " CONFIRM
    if [ "$CONFIRM" = "y" ]; then
        rm -rf "$INSTALL_DIR"
        print_success "Old directory removed"
    else
        print_error "Installation cancelled"
        exit 1
    fi
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
git clone "$REPO_URL" "$INSTALL_DIR" &> /dev/null
if [ $? -eq 0 ]; then
    print_success "Repository cloned to $INSTALL_DIR"
else
    print_error "Failed to clone repository"
    exit 1
fi

cd "$INSTALL_DIR"

# Step 3: Setup Environment Variables
echo ""
echo "⚙️  Step 3: Setting up environment variables..."
read -p "MySQL Root Password: " MYSQL_PASS
read -p "Database Name [billing_system]: " DB_NAME
DB_NAME=${DB_NAME:-billing_system}
read -p "App Port [3000]: " APP_PORT
APP_PORT=${APP_PORT:-3000}
read -p "Company Name: " COMPANY_NAME
read -p "Session Secret (min 32 chars): " SESSION_SECRET

cat > .env << EOF
# Server Configuration
NODE_ENV=production
PORT=$APP_PORT
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=$MYSQL_PASS
DB_NAME=$DB_NAME

# Session Secret
SESSION_SECRET=$SESSION_SECRET

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# App Configuration
APP_NAME=Billing System
COMPANY_NAME=$COMPANY_NAME

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# WhatsApp
WA_SESSION_PATH=./whatsapp-session

# Payment Gateway (optional)
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

# MikroTik (optional)
MIKROTIK_HOST=
MIKROTIK_USER=
MIKROTIK_PASSWORD=
EOF

print_success ".env file created"

# Step 4: Setup Database
echo ""
echo "🗄️  Step 4: Setting up database..."
mysql -u root -p"$MYSQL_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Database '$DB_NAME' created"
else
    print_warning "Database creation failed or already exists"
fi

# Import schema if exists
if [ -f "database/schema.sql" ]; then
    mysql -u root -p"$MYSQL_PASS" "$DB_NAME" < database/schema.sql 2>/dev/null
    print_success "Database schema imported"
fi

# Step 5: Check Node.js
echo ""
echo "📦 Step 5: Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION found"
else
    print_warning "Node.js not found. Installing Node.js v16..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - &> /dev/null
    apt-get install -y nodejs &> /dev/null
    print_success "Node.js installed"
fi

# Step 6: Install Dependencies
echo ""
echo "📦 Step 6: Installing npm packages..."
print_info "This may take 5-10 minutes..."
npm install --silent &> /tmp/npm-install.log
if [ $? -eq 0 ]; then
    print_success "npm packages installed"
else
    print_error "npm install failed. Check /tmp/npm-install.log"
    exit 1
fi

# Step 7: Build Application
echo ""
echo "🏗️  Step 7: Building application..."
npm run build &> /tmp/npm-build.log
if [ $? -eq 0 ]; then
    print_success "Application built successfully"
else
    print_error "Build failed. Check /tmp/npm-build.log"
    exit 1
fi

# Step 8: Setup PM2
echo ""
echo "🚀 Step 8: Setting up PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 &> /dev/null
    print_success "PM2 installed"
fi

# Stop existing instance if running
pm2 delete billing &> /dev/null

# Start application
pm2 start dist/server.js --name billing
if [ $? -eq 0 ]; then
    print_success "Application started with PM2"
else
    print_error "Failed to start application"
    exit 1
fi

# Save PM2 configuration
pm2 save &> /dev/null
print_success "PM2 configuration saved"

# Setup PM2 startup
pm2 startup systemd -u root --hp /root &> /dev/null
print_success "PM2 startup configured"

# Step 9: Display Status
echo ""
echo "=========================================="
echo "✅ INSTALLATION COMPLETE!"
echo "=========================================="
echo ""
print_info "Application Details:"
echo "  📁 Location: $INSTALL_DIR"
echo "  🌐 Port: $APP_PORT"
echo "  🗄️  Database: $DB_NAME"
echo ""
print_info "PM2 Status:"
pm2 status
echo ""
print_info "Application Logs:"
pm2 logs billing --lines 10 --nostream
echo ""
print_warning "NEXT STEPS:"
echo "1. Configure Nginx reverse proxy in aaPanel"
echo "2. Point domain to port $APP_PORT"
echo "3. Setup SSL certificate"
echo "4. Access: http://your-server-ip:$APP_PORT"
echo "5. Login: admin/admin or kasir/kasir"
echo "6. CHANGE DEFAULT PASSWORDS!"
echo ""
print_success "Setup script completed successfully! 🎉"
echo ""


