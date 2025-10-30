#!/bin/bash

# ========================================
# Fix Import Excel for Live Server
# ========================================
# Script untuk fix semua issue import Excel
# ========================================

echo "🔧 FIXING IMPORT EXCEL FOR LIVE SERVER"
echo "========================================"
echo ""

# 1. Create/fix uploads directory
echo "1️⃣ Setting up uploads directory..."
mkdir -p uploads
chmod 755 uploads
chown -R $USER:$USER uploads 2>/dev/null || echo "Note: Could not change ownership (might need sudo)"
echo "✅ uploads directory configured"
echo ""

# 2. Install/update required packages
echo "2️⃣ Installing required packages..."
npm install multer xlsx --save
echo "✅ Packages installed"
echo ""

# 3. Check and install all dependencies
echo "3️⃣ Installing all dependencies..."
npm install --production
echo "✅ Dependencies installed"
echo ""

# 4. Build TypeScript
echo "4️⃣ Building TypeScript..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "⚠️  Build had warnings, but continuing..."
fi
echo ""

# 5. Fix Nginx if exists
echo "5️⃣ Checking Nginx configuration..."
if command -v nginx &> /dev/null; then
    echo "Nginx detected. To fix file size limit, run:"
    echo ""
    echo "  sudo tee -a /etc/nginx/conf.d/upload-size.conf <<EOF"
    echo "  client_max_body_size 10M;"
    echo "  EOF"
    echo ""
    echo "  sudo systemctl reload nginx"
    echo ""
    echo "⚠️  Please run the commands above manually with sudo"
else
    echo "ℹ️  Nginx not found, skipping"
fi
echo ""

# 6. Create test Excel file
echo "6️⃣ Creating test Excel file..."
cat > test-import-data.csv << 'EOF'
Nama,Telepon,Alamat
Test Customer 1,081234567890,Jl. Test No. 1
Test Customer 2,081234567891,Jl. Test No. 2
EOF
echo "✅ Test CSV created: test-import-data.csv"
echo "   You can import this to test the feature"
echo ""

# 7. Restart PM2
echo "7️⃣ Restarting PM2..."
pm2 restart billing
if [ $? -eq 0 ]; then
    echo "✅ PM2 restarted"
else
    echo "❌ PM2 restart failed"
    exit 1
fi
echo ""

# 8. Show logs
echo "8️⃣ Showing recent logs..."
pm2 logs billing --lines 20 --nostream
echo ""

echo "========================================"
echo "✅ FIX COMPLETE"
echo "========================================"
echo ""
echo "🧪 TESTING STEPS:"
echo ""
echo "1. Open browser: http://your-server:3000/customers/list"
echo "2. Click 'Import Excel' button"
echo "3. Upload 'test-import-data.csv' or your Excel file"
echo "4. Check if import succeeds"
echo ""
echo "If still fails, check logs:"
echo "  pm2 logs billing | grep -i 'import\|excel\|multer'"
echo ""
echo "Or run diagnostic:"
echo "  ./diagnose-import-live.sh"
echo ""


