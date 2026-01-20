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

# 1. Create necessary dirs if not exists
DOCS_DIRS=".baileys_auth dist public/uploads logs"
for dir in $DOCS_DIRS; do
    if [ ! -d "$dir" ]; then
        echo "Creating $dir directory..."
        mkdir -p "$dir"
    fi
done

# 2. Fix Ownership
# Detect the real user (who should own the files)
REAL_USER=${SUDO_USER:-$(whoami)}
# Fallback: If running in /var/www/billing, we likely want the 'adi' user
if [ "$REAL_USER" == "root" ] && id "adi" &>/dev/null; then
    REAL_USER="adi"
fi

TARGET_GROUP="www-data"

echo "Detected Owner User: $REAL_USER"
echo "Target Web Group: $TARGET_GROUP"

# Ensure group exists
if ! getent group $TARGET_GROUP > /dev/null; then
    sudo groupadd $TARGET_GROUP
fi

# Add user to group
sudo usermod -a -G $TARGET_GROUP $REAL_USER

echo "Resetting ownership to $REAL_USER:$TARGET_GROUP (Deep Clean)..."
# Use -h to affect symlinks too, and be very aggressive
sudo chown -R $REAL_USER:$TARGET_GROUP $APP_DIR

# 3. Fix Permissions
echo "Setting permissions (Full control for $REAL_USER)..."
sudo chmod -R 755 $APP_DIR

# Specific runtime directories need group write access for www-data and full access for $REAL_USER
echo "Unlocking runtime directories..."
RUNTIME_DIRS=".baileys_auth logs dist public/uploads"
for dir in $RUNTIME_DIRS; do
    if [ -d "$dir" ]; then
        sudo chown -R $REAL_USER:$TARGET_GROUP "$dir"
        sudo chmod -R 777 "$dir" # Open fully for now to stop the EACCES bleeding
    fi
done

echo "========================================================"
echo "   PERMISSIONS FIXED! 🚀"
echo "   Running: pm2 restart billing-app"
echo "========================================================"
pm2 restart billing-app
