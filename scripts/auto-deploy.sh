#!/bin/bash

# ===============================================
# AUTO DEPLOY & RESTORE (ZERO INTERACTION SETUP)
# ===============================================

APP_DIR="/var/www/billing"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/storage/backups"

echo "=========================================="
echo "   🚀 STARTING AUTO DEPLOYMENT..."
echo "=========================================="

# 1. Ensure MySQL is Installed
if ! command -v mysql &> /dev/null; then
    echo "📦 Installing MySQL..."
    sudo apt update -qq
    sudo apt install -y mysql-server
    sudo systemctl start mysql
    sudo systemctl enable mysql
else
    echo "✅ MySQL is already installed."
fi

# 2. Generate Random Credentials
DB_NAME="billing"
DB_USER="billing_user"
DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')

echo "🔑 Generated DB Password: $DB_PASS"

# 3. Setup Database (Force Reset)
echo "🔧 Configuring Database..."
sudo mysql <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME};
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

# 4. Find Latest Backup File
echo "🔍 Searching for latest backup..."
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -n 1)

if [ -f "$LATEST_BACKUP" ]; then
    echo "📂 Found backup: $LATEST_BACKUP"
    echo "⏳ Restoring database (this may take a while)..."
    sudo mysql "$DB_NAME" < "$LATEST_BACKUP"
    if [ $? -eq 0 ]; then
        echo "✅ Database restored successfully!"
    else
        echo "❌ Database restore failed!"
    fi
else
    echo "⚠️  No backup file found in $BACKUP_DIR. Skipping restore."
fi

# 5. Update .env File automatically
echo "📝 Updating .env configuration..."
if [ -f "$ENV_FILE" ]; then
    # Backup .env first
    cp "$ENV_FILE" "$ENV_FILE.bak"
    
    # Replace DB params using sed
    sed -i "s/^DB_HOST=.*/DB_HOST=localhost/" "$ENV_FILE"
    sed -i "s/^DB_USER=.*/DB_USER=$DB_USER/" "$ENV_FILE"
    sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASS/" "$ENV_FILE"
    sed -i "s/^DB_NAME=.*/DB_NAME=$DB_NAME/" "$ENV_FILE"
    
    echo "✅ .env updated with new credentials."
else
    echo "❌ .env file not found! Please create it first."
fi

# 6. Build and Reload App
echo "🔨 Building application..."
cd "$APP_DIR"
npm install
npm run build

echo "🔄 Reloading PM2..."
pm2 reload billing-app || pm2 start ecosystem.config.js --env production

echo "=========================================="
echo "   🎉 DEPLOYMENT FINISHED!"
echo "=========================================="
