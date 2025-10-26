#!/bin/bash

# ============================================
# 🚀 Auto Deploy Billing System ke aaPanel
# Native Deployment (No Docker)
# ============================================

set -e  # Exit on error

echo "============================================"
echo "🚀 AUTO DEPLOY BILLING SYSTEM"
echo "============================================"
echo ""

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfigurasi - EDIT INI!
GITHUB_REPO="${GITHUB_REPO:-https://github.com/adiprayitno160-svg/billing_system.git}"
APP_DIR="${APP_DIR:-/www/wwwroot/billing}"
DB_NAME="${DB_NAME:-billing_system}"
APP_PORT="${APP_PORT:-3000}"

# Konfigurasi sudah di-set ke repository yang benar
# Jika ingin menggunakan fork/repo lain, bisa override via environment variable:
# export GITHUB_REPO="https://github.com/username/billing.git"

echo -e "${BLUE}📋 Konfigurasi:${NC}"
echo "   Repository: $GITHUB_REPO"
echo "   Install ke: $APP_DIR"
echo "   Database  : $DB_NAME"
echo "   Port      : $APP_PORT"
echo ""
read -p "Lanjutkan? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Dibatalkan."
    exit 1
fi

# ============================================
# 1. Cek Prerequisites
# ============================================
echo ""
echo -e "${YELLOW}[1/8] 🔍 Cek Prerequisites...${NC}"

# Cek apakah running sebagai root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Script ini harus dijalankan sebagai root!${NC}"
   echo "   Gunakan: sudo bash aapanel-deploy.sh"
   exit 1
fi

# Cek aaPanel
if [ ! -f "/etc/init.d/bt" ]; then
    echo -e "${RED}❌ aaPanel tidak terdeteksi!${NC}"
    echo "   Install aaPanel terlebih dahulu dari: https://www.aapanel.com/install.html"
    exit 1
fi

echo -e "${GREEN}✅ Running sebagai root${NC}"
echo -e "${GREEN}✅ aaPanel terdeteksi${NC}"

# ============================================
# 2. Install Dependencies
# ============================================
echo ""
echo -e "${YELLOW}[2/8] 📦 Install Dependencies...${NC}"

# Update system
echo "   Updating system packages..."
yum update -y > /dev/null 2>&1 || apt-get update -y > /dev/null 2>&1

# Install git
if ! command -v git &> /dev/null; then
    echo "   Installing git..."
    yum install -y git > /dev/null 2>&1 || apt-get install -y git > /dev/null 2>&1
fi

# Install Node.js (versi 18.x)
if ! command -v node &> /dev/null; then
    echo "   Installing Node.js 18..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - > /dev/null 2>&1 || \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
    yum install -y nodejs > /dev/null 2>&1 || apt-get install -y nodejs > /dev/null 2>&1
else
    echo "   Node.js sudah terinstall: $(node -v)"
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "   Installing PM2..."
    npm install -g pm2 > /dev/null 2>&1
fi

echo -e "${GREEN}✅ Git: $(git --version)${NC}"
echo -e "${GREEN}✅ Node: $(node -v)${NC}"
echo -e "${GREEN}✅ NPM: $(npm -v)${NC}"
echo -e "${GREEN}✅ PM2: $(pm2 -v)${NC}"

# ============================================
# 3. Clone Repository dari GitHub
# ============================================
echo ""
echo -e "${YELLOW}[3/8] 📥 Clone dari GitHub...${NC}"

# Hapus folder lama jika ada
if [ -d "$APP_DIR" ]; then
    echo "   Backup folder lama..."
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
fi

# Clone repository
echo "   Cloning $GITHUB_REPO..."
git clone "$GITHUB_REPO" "$APP_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Repository berhasil di-clone${NC}"
else
    echo -e "${RED}❌ Gagal clone repository!${NC}"
    echo ""
    echo "Pastikan:"
    echo "1. URL GitHub benar"
    echo "2. Repository bersifat public ATAU"
    echo "3. SSH key sudah ditambahkan ke GitHub"
    echo ""
    echo "Untuk repository private, jalankan:"
    echo "   ssh-keygen -t rsa -b 4096 -C 'deploy' -f ~/.ssh/id_rsa -N ''"
    echo "   cat ~/.ssh/id_rsa.pub"
    echo "   # Copy key tersebut ke GitHub Settings > SSH Keys"
    exit 1
fi

cd "$APP_DIR"

# ============================================
# 4. Setup Database
# ============================================
echo ""
echo -e "${YELLOW}[4/8] 🗄️  Setup Database...${NC}"

# Ambil MySQL root password dari aaPanel
MYSQL_ROOT_PASS=$(cat /www/server/panel/default.pl | grep password | awk -F"'" '{print $2}')

if [ -z "$MYSQL_ROOT_PASS" ]; then
    # Jika tidak ketemu, minta input manual
    echo "   MySQL root password tidak ditemukan otomatis."
    read -sp "   Masukkan MySQL root password: " MYSQL_ROOT_PASS
    echo ""
fi

# Buat database
echo "   Membuat database $DB_NAME..."
mysql -uroot -p"$MYSQL_ROOT_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

# Buat user database
DB_USER="billing_user"
DB_PASS=$(openssl rand -base64 16)
echo "   Membuat user database..."
mysql -uroot -p"$MYSQL_ROOT_PASS" -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" 2>/dev/null
mysql -uroot -p"$MYSQL_ROOT_PASS" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';" 2>/dev/null
mysql -uroot -p"$MYSQL_ROOT_PASS" -e "FLUSH PRIVILEGES;" 2>/dev/null

echo -e "${GREEN}✅ Database $DB_NAME berhasil dibuat${NC}"

# ============================================
# 5. Konfigurasi Environment
# ============================================
echo ""
echo -e "${YELLOW}[5/8] ⚙️  Konfigurasi Environment...${NC}"

# Buat file .env
cat > "$APP_DIR/.env" << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME

# Server Configuration
PORT=$APP_PORT
NODE_ENV=production

# Session Secret
SESSION_SECRET=$(openssl rand -base64 32)

# App Configuration
HIDE_BILLING_CUSTOMERS_MENU=false
EOF

echo -e "${GREEN}✅ File .env berhasil dibuat${NC}"

# ============================================
# 6. Install NPM Packages
# ============================================
echo ""
echo -e "${YELLOW}[6/8] 📦 Install NPM Packages...${NC}"
echo "   (Ini mungkin memakan waktu beberapa menit...)"

cd "$APP_DIR"
npm install --production

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ NPM packages berhasil diinstall${NC}"
else
    echo -e "${RED}❌ Gagal install NPM packages!${NC}"
    exit 1
fi

# ============================================
# 7. Build Application
# ============================================
echo ""
echo -e "${YELLOW}[7/8] 🔨 Build Application...${NC}"

npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build berhasil${NC}"
else
    echo -e "${RED}❌ Build gagal!${NC}"
    exit 1
fi

# ============================================
# 8. Setup PM2 & Start Application
# ============================================
echo ""
echo -e "${YELLOW}[8/8] 🚀 Start Application dengan PM2...${NC}"

# Stop aplikasi jika sudah running
pm2 delete billing-system 2>/dev/null || true

# Start dengan PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup systemd -u root --hp /root

echo -e "${GREEN}✅ Aplikasi berhasil dijalankan${NC}"

# ============================================
# 9. Setup Nginx Reverse Proxy (Opsional)
# ============================================
echo ""
echo -e "${YELLOW}[OPSIONAL] Setup Nginx Reverse Proxy?${NC}"
read -p "Setup Nginx untuk domain? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Masukkan domain (contoh: billing.domain.com): " DOMAIN
    
    NGINX_CONF="/www/server/panel/vhost/nginx/$DOMAIN.conf"
    
    cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Restart Nginx
    /etc/init.d/nginx reload
    
    echo -e "${GREEN}✅ Nginx reverse proxy berhasil dikonfigurasi${NC}"
    echo -e "   Akses aplikasi di: ${BLUE}http://$DOMAIN${NC}"
fi

# ============================================
# Informasi Selesai
# ============================================
echo ""
echo "============================================"
echo -e "${GREEN}✅ DEPLOYMENT SELESAI!${NC}"
echo "============================================"
echo ""
echo -e "${BLUE}📋 Informasi Aplikasi:${NC}"
echo "   Lokasi   : $APP_DIR"
echo "   Port     : $APP_PORT"
echo "   Database : $DB_NAME"
echo "   User DB  : $DB_USER"
echo ""
echo -e "${BLUE}🌐 Akses Aplikasi:${NC}"
echo "   Local    : http://localhost:$APP_PORT"
echo "   IP Server: http://$(hostname -I | awk '{print $1}'):$APP_PORT"
echo ""
echo -e "${BLUE}🔑 Credentials Default:${NC}"
echo "   Username : admin"
echo "   Password : admin123"
echo ""
echo -e "${BLUE}📝 Perintah PM2:${NC}"
echo "   Status   : pm2 status"
echo "   Logs     : pm2 logs billing-system"
echo "   Restart  : pm2 restart billing-system"
echo "   Stop     : pm2 stop billing-system"
echo ""
echo -e "${YELLOW}⚠️  PENTING:${NC}"
echo "   1. Ganti password default setelah login!"
echo "   2. Backup credentials database di tempat aman"
echo "   3. Pastikan firewall membuka port $APP_PORT"
echo ""
echo -e "${GREEN}Selamat menggunakan Billing System! 🎉${NC}"
echo ""

# Simpan credentials
cat > "$APP_DIR/CREDENTIALS.txt" << EOF
===========================================
BILLING SYSTEM - DATABASE CREDENTIALS
===========================================
Date     : $(date)
Database : $DB_NAME
User     : $DB_USER
Password : $DB_PASS
Host     : localhost
Port     : 3306

MySQL Root Password: $MYSQL_ROOT_PASS

===========================================
DEFAULT LOGIN
===========================================
Username: admin
Password: admin123

⚠️ GANTI PASSWORD SETELAH LOGIN PERTAMA!
⚠️ SIMPAN FILE INI DI TEMPAT AMAN!
===========================================
EOF

echo -e "${GREEN}📄 Credentials tersimpan di: $APP_DIR/CREDENTIALS.txt${NC}"

