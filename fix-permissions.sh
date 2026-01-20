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
# Target user is 'adi' as seen in PM2 logs
REAL_USER="adi"
if ! id "$REAL_USER" &>/dev/null; then
    REAL_USER=${SUDO_USER:-$(whoami)}
fi

TARGET_GROUP="www-data"

echo "Using Owner User: $REAL_USER"
echo "Target Web Group: $TARGET_GROUP"

# Add user to group
sudo usermod -a -G $TARGET_GROUP $REAL_USER

# FORCE CLEANUP: Delete problematic folders that are stuck with root permissions
echo "Force cleaning sticky runtime folders..."
sudo rm -rf .baileys_auth
sudo rm -rf logs
mkdir -p .baileys_auth logs

echo "Resetting ownership to $REAL_USER:$TARGET_GROUP..."
sudo chown -R $REAL_USER:$TARGET_GROUP $APP_DIR

# 3. Fix Permissions
echo "Setting permissions (775: Full access for user and group)..."
sudo chmod -R 775 $APP_DIR
sudo chmod -R 777 .baileys_auth logs public/uploads dist # Full open on runtimes

echo "========================================================"
echo "   PERMISSIONS FIXED! 🚀"
echo "   Next steps: git pull && npm run build && pm2 restart billing-app"
echo "========================================================"
