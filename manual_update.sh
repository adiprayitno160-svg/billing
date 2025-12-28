#!/bin/bash

# Script Update Manual Billing System
# Jalankan script ini via SSH di folder aplikasi

echo "=========================================="
echo "   MANUAL UPDATE BILLING SYSTEM"
echo "=========================================="

# 1. Reset permission git (optional, safe fix)
git config core.fileMode false

# 2. Fetch latest updates from GitHub
echo "[1/5] Mengambil data terbaru dari GitHub..."
git fetch --all
git fetch --tags --force

# 3. Get Latest Tag
LATEST_TAG=$(git describe --tags `git rev-list --tags --max-count=1`)
CURRENT_TAG=$(git describe --tags)

echo "Versi saat ini: $CURRENT_TAG"
echo "Versi terbaru : $LATEST_TAG"

if [ "$CURRENT_TAG" == "$LATEST_TAG" ]; then
    echo "Aplikasi sudah dalam versi terbaru."
    read -p "Force update ulang? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 4. Checkout Latest Version
echo "[2/5] Menginstall versi $LATEST_TAG..."
git checkout main
git pull origin main
git checkout $LATEST_TAG

# 5. Install Dependencies
echo "[3/5] Mengupdate dependencies..."
npm install

# 6. Build Application
echo "[4/5] Membangun ulang aplikasi (Build)..."
npm run build

# 7. Restart Service
echo "[5/5] Merestart layanan..."
pm2 restart billing-app || pm2 restart all

echo "=========================================="
echo "   UPDATE SELESAI: $LATEST_TAG"
echo "=========================================="
