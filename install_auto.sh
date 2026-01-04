#!/bin/bash

# ==========================================
# BILLING SYSTEM AUTO INSTALLER for UBUNTU
# Version: 1.0 (Auto-Config with phpMyAdmin)
# ==========================================

# Warna untuk output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}    STARTING AUTOMATED BILLING INSTALLATION      ${NC}"
echo -e "${GREEN}==================================================${NC}"
sleep 2

# 1. Update System
echo -e "${GREEN}[1/8] Updating System Repositories...${NC}"
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential nginx

# 2. Install Node.js v20
echo -e "${GREEN}[2/8] Installing Node.js v20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo "Node Version: $(node -v)"
echo "NPM Version: $(npm -v)"

# 3. Install MariaDB & phpMyAdmin
echo -e "${GREEN}[3/8] Installing MariaDB & phpMyAdmin...${NC}"
# Pre-configure phpMyAdmin selections to avoid prompts
echo "phpmyadmin phpmyadmin/dbconfig-install boolean true" | sudo debconf-set-selections
echo "phpmyadmin phpmyadmin/app-password-confirm password root" | sudo debconf-set-selections
echo "phpmyadmin phpmyadmin/mysql/admin-pass password root" | sudo debconf-set-selections
echo "phpmyadmin phpmyadmin/mysql/app-pass password root" | sudo debconf-set-selections
echo "phpmyadmin phpmyadmin/reconfigure-webserver multiselect nginx" | sudo debconf-set-selections
sudo apt install -y mariadb-server phpmyadmin

# 4. Configure Database
echo -e "${GREEN}[4/8] Configuring Database...${NC}"

# Minta input password baru untuk user billing
read -sp "Masukkan Password Baru untuk Database User 'billing': " DB_PASS
echo
read -p "Masukkan Domain Anda (contoh: billing.warnet.id atau IP): " APP_DOMAIN

# Setup DB commands
sudo mysql -e "CREATE DATABASE IF NOT EXISTS billing_db;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'billing'@'localhost' IDENTIFIED BY '$DB_PASS';"
sudo mysql -e "GRANT ALL PRIVILEGES ON billing_db.* TO 'billing'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

echo -e "${GREEN}Database 'billing_db' created. User 'billing' created.${NC}"

# 5. Setup Project
echo -e "${GREEN}[5/8] Cloning & Setting up Application...${NC}"
cd /var/www
# Hapus folder lama jika ada (hati-hati)
if [ -d "billing" ]; then
    echo "Folder 'billing' already exists. Backing up..."
    sudo mv billing "billing_backup_$(date +%s)"
fi

sudo git clone https://github.com/adiprayitno160-svg/billing.git billing
cd billing

# Change ownership
sudo chown -R $USER:$USER /var/www/billing

# Install Node Modules
npm install
npm install -g pm2 ts-node typescript

# Setup .env
cp .env.example .env
# Replace config in .env using sed
sed -i "s/DB_USER=.*/DB_USER=billing/" .env
sed -i "s/DB_PASS=.*/DB_PASS=$DB_PASS/" .env
sed -i "s/DB_NAME=.*/DB_NAME=billing_db/" .env
sed -i "s|APP_URL=.*|APP_URL=http://$APP_DOMAIN|" .env

# Build
npm run build

# 6. Setup Nginx
echo -e "${GREEN}[6/8] Configuring Nginx...${NC}"
cat > billing_nginx <<EOF
server {
    listen 80;
    server_name $APP_DOMAIN;

    # Aplikasi Billing (Node.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # phpMyAdmin
    location /phpmyadmin {
        root /usr/share/;
        index index.php index.html index.htm;
        location ~ ^/phpmyadmin/(.+\.php)$ {
            try_files \$uri =404;
            root /usr/share/;
            fastcgi_pass unix:/run/php/php-fpm.sock; # Adjust version if needed
            fastcgi_index index.php;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
            include fastcgi_params;
        }
        location ~* ^/phpmyadmin/(.+\.(jpg|jpeg|gif|css|png|js|ico|html|xml|txt))$ {
            root /usr/share/;
        }
    }
}
EOF

# Install PHP FPM for phpMyAdmin (detect version automatically)
sudo apt install -y php-fpm php-mysql
PHP_VER=$(ls /run/php/php*-fpm.sock | head -n 1 | grep -oP 'php\d\.\d')
# Update path in nginx config
sed -i "s|unix:/run/php/php-fpm.sock|unix:/run/php/$PHP_VER-fpm.sock|" billing_nginx

sudo mv billing_nginx /etc/nginx/sites-available/billing
sudo ln -s /etc/nginx/sites-available/billing /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 7. Start App
echo -e "${GREEN}[7/8] Starting Application...${NC}"
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup | tail -n 1 > startup_cmd.sh && chmod +x startup_cmd.sh && ./startup_cmd.sh

# 8. Selesai
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}       INSTALLATION COMPLETED SUCCESSFULLY!      ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo -e "1. Akses Billing: http://$APP_DOMAIN"
echo -e "2. Akses Database: http://$APP_DOMAIN/phpmyadmin"
echo -e "   - User: billing"
echo -e "   - Pass: $DB_PASS"
echo -e ""
echo -e "${RED}PENTING: Database masih KOSONG.${NC}"
echo -e "Silakan export database dari PC lokal Anda dan import melalui phpMyAdmin."
