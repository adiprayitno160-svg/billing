#!/bin/bash

# ============================================
# 🗑️  UNINSTALL Billing System dari Server
# ============================================

set -e

echo "============================================"
echo "🗑️  UNINSTALL BILLING SYSTEM"
echo "============================================"
echo ""

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfigurasi default
APP_DIR="${APP_DIR:-/www/wwwroot/billing}"
DB_NAME="${DB_NAME:-billing_system}"
PM2_APP_NAME="${PM2_APP_NAME:-billing-system}"

echo -e "${YELLOW}⚠️  WARNING: Ini akan menghapus semua data!${NC}"
echo ""
echo -e "${BLUE}Yang akan dihapus:${NC}"
echo "   • Aplikasi di: $APP_DIR"
echo "   • Database: $DB_NAME"
echo "   • PM2 process: $PM2_APP_NAME"
echo "   • Nginx config (jika ada)"
echo ""
echo -e "${RED}Data yang dihapus TIDAK BISA dikembalikan!${NC}"
echo ""
read -p "Apakah Anda yakin? Ketik 'YES' untuk melanjutkan: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo "Dibatalkan."
    exit 0
fi

echo ""
echo -e "${YELLOW}Apakah Anda ingin backup data sebelum dihapus?${NC}"
read -p "Backup database & files? (y/n) " -n 1 -r
echo
BACKUP=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    BACKUP=true
fi

# ============================================
# 1. Backup (Optional)
# ============================================
if [ "$BACKUP" = true ]; then
    echo ""
    echo -e "${YELLOW}[1/6] 💾 Backup Data...${NC}"
    
    BACKUP_DIR="$HOME/billing_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if command -v mysql &> /dev/null; then
        echo "   Backup database..."
        read -sp "   Masukkan MySQL root password: " MYSQL_PASS
        echo ""
        
        mysqldump -u root -p"$MYSQL_PASS" "$DB_NAME" > "$BACKUP_DIR/database.sql" 2>/dev/null || {
            echo -e "${YELLOW}   ⚠️  Gagal backup database (mungkin sudah terhapus)${NC}"
        }
    fi
    
    # Backup files
    if [ -d "$APP_DIR" ]; then
        echo "   Backup application files..."
        tar -czf "$BACKUP_DIR/app_files.tar.gz" -C "$(dirname $APP_DIR)" "$(basename $APP_DIR)" 2>/dev/null || {
            echo -e "${YELLOW}   ⚠️  Gagal backup files${NC}"
        }
        
        # Backup .env dan credentials
        if [ -f "$APP_DIR/.env" ]; then
            cp "$APP_DIR/.env" "$BACKUP_DIR/.env.backup"
        fi
        if [ -f "$APP_DIR/CREDENTIALS.txt" ]; then
            cp "$APP_DIR/CREDENTIALS.txt" "$BACKUP_DIR/CREDENTIALS.txt.backup"
        fi
    fi
    
    echo -e "${GREEN}✅ Backup tersimpan di: $BACKUP_DIR${NC}"
else
    echo ""
    echo -e "${YELLOW}[1/6] ⏭️  Skip Backup${NC}"
fi

# ============================================
# 2. Stop PM2 Process
# ============================================
echo ""
echo -e "${YELLOW}[2/6] 🛑 Stop PM2 Process...${NC}"

if command -v pm2 &> /dev/null; then
    # Stop application
    pm2 stop "$PM2_APP_NAME" 2>/dev/null && echo "   PM2 process stopped" || echo "   PM2 process not found"
    
    # Delete from PM2
    pm2 delete "$PM2_APP_NAME" 2>/dev/null && echo "   PM2 process deleted" || true
    
    # Save PM2 list
    pm2 save --force 2>/dev/null || true
    
    echo -e "${GREEN}✅ PM2 process dihapus${NC}"
else
    echo -e "${YELLOW}   PM2 tidak terinstall, skip${NC}"
fi

# ============================================
# 3. Remove Application Directory
# ============================================
echo ""
echo -e "${YELLOW}[3/6] 📁 Hapus Application Directory...${NC}"

if [ -d "$APP_DIR" ]; then
    echo "   Menghapus: $APP_DIR"
    rm -rf "$APP_DIR"
    echo -e "${GREEN}✅ Directory dihapus${NC}"
else
    echo -e "${YELLOW}   Directory tidak ditemukan, skip${NC}"
fi

# ============================================
# 4. Drop Database
# ============================================
echo ""
echo -e "${YELLOW}[4/6] 🗄️  Drop Database...${NC}"

if command -v mysql &> /dev/null; then
    if [ -z "$MYSQL_PASS" ]; then
        read -sp "   Masukkan MySQL root password: " MYSQL_PASS
        echo ""
    fi
    
    # Drop database
    mysql -u root -p"$MYSQL_PASS" -e "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null && {
        echo "   Database $DB_NAME dihapus"
    } || {
        echo -e "${YELLOW}   ⚠️  Gagal hapus database (mungkin sudah terhapus)${NC}"
    }
    
    # Drop user (optional)
    echo ""
    read -p "   Hapus database user 'billing_user'? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mysql -u root -p"$MYSQL_PASS" -e "DROP USER IF EXISTS 'billing_user'@'localhost';" 2>/dev/null && {
            echo "   User billing_user dihapus"
        } || true
    fi
    
    echo -e "${GREEN}✅ Database dihapus${NC}"
else
    echo -e "${YELLOW}   MySQL tidak ditemukan, skip${NC}"
fi

# ============================================
# 5. Remove Nginx Config (Optional)
# ============================================
echo ""
echo -e "${YELLOW}[5/6] 🌐 Hapus Nginx Config...${NC}"

NGINX_CONFIGS_FOUND=false

# Cek aaPanel nginx config
if [ -d "/www/server/panel/vhost/nginx" ]; then
    echo "   Mencari config Nginx di aaPanel..."
    NGINX_CONFIGS=$(find /www/server/panel/vhost/nginx -name "*billing*" 2>/dev/null || true)
    if [ ! -z "$NGINX_CONFIGS" ]; then
        echo "   Config ditemukan:"
        echo "$NGINX_CONFIGS"
        read -p "   Hapus config ini? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$NGINX_CONFIGS" | while read config; do
                rm -f "$config"
                echo "   Dihapus: $config"
            done
            NGINX_CONFIGS_FOUND=true
        fi
    fi
fi

# Cek standard nginx config
if [ -d "/etc/nginx/sites-available" ]; then
    echo "   Mencari config Nginx standard..."
    NGINX_CONFIGS=$(find /etc/nginx/sites-available -name "*billing*" 2>/dev/null || true)
    if [ ! -z "$NGINX_CONFIGS" ]; then
        echo "   Config ditemukan:"
        echo "$NGINX_CONFIGS"
        read -p "   Hapus config ini? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$NGINX_CONFIGS" | while read config; do
                # Remove from sites-enabled
                ENABLED_LINK="/etc/nginx/sites-enabled/$(basename $config)"
                [ -L "$ENABLED_LINK" ] && rm -f "$ENABLED_LINK"
                # Remove from sites-available
                rm -f "$config"
                echo "   Dihapus: $config"
            done
            NGINX_CONFIGS_FOUND=true
        fi
    fi
fi

if [ "$NGINX_CONFIGS_FOUND" = true ]; then
    echo "   Reload Nginx..."
    /etc/init.d/nginx reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true
    echo -e "${GREEN}✅ Nginx config dihapus${NC}"
else
    echo -e "${YELLOW}   Tidak ada config Nginx ditemukan${NC}"
fi

# ============================================
# 6. Clean Up (Optional)
# ============================================
echo ""
echo -e "${YELLOW}[6/6] 🧹 Clean Up...${NC}"

echo ""
read -p "Hapus Node.js & PM2 juga? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Uninstall PM2
    if command -v pm2 &> /dev/null; then
        echo "   Uninstall PM2..."
        npm uninstall -g pm2 2>/dev/null || true
    fi
    
    # Uninstall Node.js
    if command -v node &> /dev/null; then
        echo "   Uninstall Node.js..."
        # Debian/Ubuntu
        apt-get remove -y nodejs 2>/dev/null || \
        # CentOS/RHEL
        yum remove -y nodejs 2>/dev/null || true
        
        # Clean up npm
        rm -rf /usr/local/lib/node_modules 2>/dev/null || true
        rm -rf ~/.npm 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Node.js & PM2 dihapus${NC}"
else
    echo -e "${YELLOW}   Node.js & PM2 tetap ada${NC}"
fi

# Remove PM2 startup script
if [ -f "/etc/systemd/system/pm2-root.service" ]; then
    echo "   Hapus PM2 startup service..."
    systemctl disable pm2-root.service 2>/dev/null || true
    rm -f /etc/systemd/system/pm2-root.service
    systemctl daemon-reload 2>/dev/null || true
fi

# Clean up logs
if [ -d "$APP_DIR/logs" ]; then
    rm -rf "$APP_DIR/logs" 2>/dev/null || true
fi

echo -e "${GREEN}✅ Clean up selesai${NC}"

# ============================================
# Selesai
# ============================================
echo ""
echo "============================================"
echo -e "${GREEN}✅ UNINSTALL SELESAI!${NC}"
echo "============================================"
echo ""

if [ "$BACKUP" = true ]; then
    echo -e "${BLUE}💾 Backup Location:${NC}"
    echo "   $BACKUP_DIR"
    echo ""
    echo "   Files:"
    ls -lh "$BACKUP_DIR" 2>/dev/null || true
    echo ""
fi

echo -e "${BLUE}📋 Summary:${NC}"
echo "   • Application directory: REMOVED"
echo "   • Database: REMOVED"
echo "   • PM2 process: REMOVED"
echo "   • Nginx config: CHECKED"
echo ""

# Verifikasi
echo -e "${BLUE}🔍 Verification:${NC}"

# Check directory
if [ -d "$APP_DIR" ]; then
    echo -e "   ${RED}✗${NC} Directory masih ada: $APP_DIR"
else
    echo -e "   ${GREEN}✓${NC} Directory dihapus"
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        echo -e "   ${RED}✗${NC} PM2 process masih ada"
    else
        echo -e "   ${GREEN}✓${NC} PM2 process dihapus"
    fi
fi

# Check database
if command -v mysql &> /dev/null; then
    if mysql -u root -p"$MYSQL_PASS" -e "USE $DB_NAME;" 2>/dev/null; then
        echo -e "   ${RED}✗${NC} Database masih ada"
    else
        echo -e "   ${GREEN}✓${NC} Database dihapus"
    fi
fi

echo ""
echo -e "${GREEN}System sudah bersih! Siap untuk fresh install. 🎉${NC}"
echo ""

if [ "$BACKUP" = true ]; then
    echo -e "${YELLOW}⚠️  JANGAN LUPA:${NC}"
    echo "   Backup ada di: $BACKUP_DIR"
    echo "   Simpan di tempat aman jika diperlukan!"
    echo ""
fi


