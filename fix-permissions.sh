#!/bin/bash

echo "========================================================"
echo "   FIXING PERMISSIONS FOR BILLING SYSTEM"
echo "========================================================"

# Determine directory
APP_DIR="/var/www/billing"
if [ ! -d "$APP_DIR" ]; then
    echo "⚠️  Directory $APP_DIR not found. Using current directory."
    APP_DIR=$(pwd)
fi

echo "Target Directory: $APP_DIR"
cd $APP_DIR

# 1. Create auth dir if not exists
if [ ! -d ".baileys_auth" ]; then
    echo "Creating .baileys_auth directory..."
    mkdir -p .baileys_auth
fi

# 2. Fix Ownership
# Try to detect user running user
CURRENT_USER=$(whoami)
echo "Current User: $CURRENT_USER"

# Assuming standard web server setup, we want www-data
TARGET_USER="www-data"

echo "Setting ownership to $TARGET_USER:$TARGET_USER..."
sudo chown -R $TARGET_USER:$TARGET_USER .baileys_auth
sudo chown -R $TARGET_USER:$TARGET_USER dist
sudo chown -R $TARGET_USER:$TARGET_USER public/uploads

# 3. Fix Permissions
echo "Setting write permissions..."
sudo chmod -R 775 .baileys_auth
sudo chmod -R 777 public/uploads

echo "========================================================"
echo "   PERMISSIONS FIXED! 🚀"
echo "   Please restart your app: pm2 restart billing-app"
echo "========================================================"
