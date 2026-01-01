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

echo "[4/4] Merestart layanan PM2..."
npm run pm2:restart

echo "=========================================="
echo "   UPDATE SELESAI"
echo "=========================================="
