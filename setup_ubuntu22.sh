#!/bin/bash
set -e

# Password sudo (hardcoded for automation based on user request)
PASS="adi"

echo "=== 1. System Update & Install Dependencies ==="
echo $PASS | sudo -S apt update
echo $PASS | sudo -S apt upgrade -y
echo $PASS | sudo -S apt install -y curl git build-essential unzip wget

# Install Libraries for Puppeteer/PDFKit (Chrome Dependencies)
echo $PASS | sudo -S apt install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

echo "=== 2. Install Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | echo $PASS | sudo -S bash -
echo $PASS | sudo -S apt install -y nodejs

echo "=== 3. Install & Configure MySQL ==="
echo $PASS | sudo -S apt install -y mysql-server
echo $PASS | sudo -S systemctl start mysql
echo $PASS | sudo -S systemctl enable mysql

# Create DB & User safely
echo $PASS | sudo -S mysql -e "CREATE DATABASE IF NOT EXISTS billing;"
echo $PASS | sudo -S mysql -e "CREATE USER IF NOT EXISTS 'billing_user'@'localhost' IDENTIFIED BY 'vSn8nNVVle6WEfvP2P35LA';"
echo $PASS | sudo -S mysql -e "ALTER USER 'billing_user'@'localhost' IDENTIFIED BY 'vSn8nNVVle6WEfvP2P35LA';"
echo $PASS | sudo -S mysql -e "GRANT ALL PRIVILEGES ON billing.* TO 'billing_user'@'localhost';"
echo $PASS | sudo -S mysql -e "FLUSH PRIVILEGES;"

echo "=== 4. Setup Directory & Clone GitHub ==="
echo $PASS | sudo -S mkdir -p /var/www/billing
echo $PASS | sudo -S chown -R $USER:$USER /var/www
rm -rf /var/www/billing/*
git clone https://github.com/adiprayitno160-svg/billing.git /var/www/billing

echo "=== 5. Setup Environment (.env) ==="
cd /var/www/billing
cat > .env <<EOF
PORT=3002
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=billing_user
DB_PASSWORD=vSn8nNVVle6WEfvP2P35LA
DB_NAME=billing
JWT_SECRET=secret-key-adi-billing
DISABLE_WHATSAPP=false
EOF

echo "=== 6. Install Node Modules & Build ==="
npm install
npm install -g pm2 typescript ts-node
npm run build

echo "=== 7. Start Application ==="
pm2 delete billing 2>/dev/null || true
pm2 start dist/server.js --name billing --update-env
pm2 save
echo $PASS | sudo -S env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

echo "=== 8. Firewall Setup ==="
echo $PASS | sudo -S ufw allow 3002
echo $PASS | sudo -S ufw allow OpenSSH
echo $PASS | sudo -S ufw --force enable

echo "=== DEPLOYMENT COMPLETE! ==="
