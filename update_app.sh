#!/bin/bash

echo "=========================================="
echo "   UPDATE BILLING SYSTEM"
echo "=========================================="

echo "[1/4] Mengambil update dari GitHub..."
git pull origin main

echo "[2/4] Menginstall dependencies..."
npm install

echo "[3/4] Membangun aplikasi (Build)..."
npm run build

echo "[4/4] Merestart/Start layanan PM2..."
# Coba restart, jika gagal (belum jalan) maka start baru
pm2 restart billing-app 2>/dev/null || npm run pm2:start

echo "=========================================="
echo "   UPDATE SELESAI"
echo "=========================================="
