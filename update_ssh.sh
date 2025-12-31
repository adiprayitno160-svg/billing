#!/bin/bash

# --- CONFIGURATION ---
APP_NAME="billing-app"
BRANCH="main"
# ---------------------

echo "------------------------------------------"
echo "🚀 BILLING SYSTEM AUTO-UPDATE (v2.4.3)"
echo "------------------------------------------"

# 1. Pull Latest Code
echo "📥 [1/5] Menarik kode terbaru dari GitHub..."
git fetch origin $BRANCH
git reset --hard origin/$BRANCH

# 2. Install Dependencies
echo "📦 [2/5] Menginstall dependensi (npm install)..."
npm install --production=false

# 3. Database Migration
echo "🗄️ [3/5] Menjalankan migrasi database..."
# Run deferment migration
npx ts-node src/scripts/migrate_deferments.ts

# 4. Build Application
echo "🔨 [4/5] Membangun aplikasi & compiling CSS..."
# Compile CSS (Tailwind)
npm run css:build
# Compile TypeScript
npm run build

# 5. Restart Application
echo "🔄 [5/5] Merestart aplikasi di PM2..."
pm2 restart $APP_NAME || pm2 start ecosystem.config.js --env production

# 6. Save PM2 state
pm2 save

echo "------------------------------------------"
echo "✅ UPDATE BERHASIL! (v2.4.3)"
echo "------------------------------------------"
echo "Aplikasi sekarang berjalan di versi terbaru."
echo "Silakan cek dashboard untuk fitur baru:"
echo "• Deferment System (Penundaan Bayar)"
echo "• Server Health Monitoring"
echo "• Premium Monitoring UI"
echo "------------------------------------------"
