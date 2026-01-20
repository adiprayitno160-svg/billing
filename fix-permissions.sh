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
# Detect the real user if running via sudo
REAL_USER=${SUDO_USER:-$(whoami)}
TARGET_GROUP="www-data"

echo "Current Build User: $REAL_USER"
echo "Target Web Group: $TARGET_GROUP"

# Ensure group exists
if ! getent group $TARGET_GROUP > /dev/null; then
    echo "⚠️  Group $TARGET_GROUP not found. Creating it..."
    sudo groupadd $TARGET_GROUP
fi

# Add user to group if not already in it
if ! groups $REAL_USER | grep -q $TARGET_GROUP; then
    echo "Adding $REAL_USER to $TARGET_GROUP group..."
    sudo usermod -a -G $TARGET_GROUP $REAL_USER
fi

echo "Setting ownership to $REAL_USER:$TARGET_GROUP..."
sudo chown -R $REAL_USER:$TARGET_GROUP .
sudo chown -R $REAL_USER:$TARGET_GROUP .baileys_auth dist public/uploads

# 3. Fix Permissions
echo "Setting permissions (775: User/Group can write)..."
# Make the whole project readable, but specific dirs writable by group
sudo chmod -R 755 .
sudo chmod -R 775 .baileys_auth
sudo chmod -R 775 dist
sudo chmod -R 777 public/uploads

echo "========================================================"
echo "   PERMISSIONS FIXED! 🚀"
echo "   1. You can now run: npm run build"
echo "   2. Then restart: pm2 restart billing-app"
echo "========================================================"
