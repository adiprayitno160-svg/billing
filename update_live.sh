#!/bin/bash
cd /var/www/billing || exit
git pull origin main
npm install
npm run build
pm2 restart billing-app
echo "Update Selesai! 🚀"
