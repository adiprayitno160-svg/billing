#!/bin/bash

# Warna output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MEMULAI PROSES PERBAIKAN DAN DEPLOY ULANG ===${NC}"

# 1. Stop PM2
echo -e "${GREEN}[1/7] Menghentikan aplikasi billing-app...${NC}"
pm2 stop billing-app
if [ $? -ne 0 ]; then
    echo -e "${RED}Gagal menghentikan PM2 (mungkin belum jalan? Lanjut...)${NC}"
fi

# 2. Fix Permissions (Membutuhkan sudo)
echo -e "${GREEN}[2/7] Memperbaiki permission folder (Masukkan password sudo jika diminta)...${NC}"
# Ganti 'adi' dengan username user saat ini
CURRENT_USER=$(whoami)
sudo chown -R $CURRENT_USER:$CURRENT_USER .
sudo chmod -R 755 .
echo "Permission diperbaiki untuk user: $CURRENT_USER"

# 3. Clean Build
echo -e "${GREEN}[3/7] Membersihkan build lama...${NC}"
rm -rf dist/
rm -rf tsconfig.tsbuildinfo
echo "Folder dist/ dihapus."

# 4. Git Pull
echo -e "${GREEN}[4/7] Mengambil update dari GitHub...${NC}"
git reset --hard
git pull origin main

# 5. Build
echo -e "${GREEN}[5/7] Melakukan Build Ulang (npm run build)...${NC}"
export NODE_OPTIONS="--max-old-space-size=2048"
npm install # Install dependencies baru jika ada
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build BERHASIL!${NC}"
else
    echo -e "${RED}❌ Build GAGAL! Silakan cek error di atas.${NC}"
    exit 1
fi

# 6. Restart PM2
echo -e "${GREEN}[6/7] Menjalankan ulang aplikasi via PM2...${NC}"
pm2 restart billing-app --update-env

# 7. Health Check Local
echo -e "${GREEN}[7/7] Verifikasi Deployment...${NC}"
sleep 5 # Tunggu sebentar biar app up
echo "Mengecek endpoint /api/health-check..."
curl -s http://localhost:3001/api/health-check | grep "online"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ DEPLOYMENT SUKSES! App sudah online dengan kode terbaru.${NC}"
    echo -e "Silakan cek: http://192.168.239.154:3001/packages/static-ip/clients"
else
    echo -e "${RED}⚠️  App mungkin belum siap atau ada error lain. Cek 'pm2 logs'${NC}"
fi
