#!/bin/bash

# ========================================
# Import Excel Diagnostic Tool
# ========================================
# Script untuk diagnose kenapa import Excel
# gagal di live server tapi sukses di local
# ========================================

echo "🔍 DIAGNOSTIC IMPORT EXCEL - LIVE SERVER"
echo "========================================"
echo ""

# 1. Check Node.js version
echo "1️⃣ Checking Node.js version..."
node --version
npm --version
echo ""

# 2. Check uploads directory
echo "2️⃣ Checking uploads directory..."
if [ -d "uploads" ]; then
    echo "✅ uploads directory exists"
    ls -la uploads/
    echo ""
    echo "Permissions:"
    stat -c "%a %U:%G %n" uploads/
else
    echo "❌ uploads directory NOT found"
    echo "Creating uploads directory..."
    mkdir -p uploads
    chmod 755 uploads
    echo "✅ uploads directory created"
fi
echo ""

# 3. Check required npm packages
echo "3️⃣ Checking required packages..."
packages=("multer" "xlsx")
for pkg in "${packages[@]}"; do
    if npm list $pkg >/dev/null 2>&1; then
        version=$(npm list $pkg | grep $pkg | awk '{print $2}')
        echo "✅ $pkg@$version installed"
    else
        echo "❌ $pkg NOT installed"
    fi
done
echo ""

# 4. Check file size limits (nginx)
echo "4️⃣ Checking Nginx configuration..."
if command -v nginx &> /dev/null; then
    echo "Nginx version:"
    nginx -v
    echo ""
    echo "Checking client_max_body_size..."
    grep -r "client_max_body_size" /etc/nginx/ 2>/dev/null || echo "⚠️  client_max_body_size not set (using default 1MB)"
else
    echo "⚠️  Nginx not found"
fi
echo ""

# 5. Check PM2 logs for import errors
echo "5️⃣ Checking PM2 logs for import errors..."
if command -v pm2 &> /dev/null; then
    echo "Recent import-related logs:"
    pm2 logs billing --lines 50 --nostream | grep -i "import\|excel\|multer" || echo "No import errors in recent logs"
else
    echo "⚠️  PM2 not found"
fi
echo ""

# 6. Check disk space
echo "6️⃣ Checking disk space..."
df -h . | tail -1
echo ""

# 7. Check memory
echo "7️⃣ Checking memory..."
free -h | head -2
echo ""

# 8. Check file permissions for src
echo "8️⃣ Checking source file permissions..."
if [ -f "src/routes/index.ts" ]; then
    echo "✅ src/routes/index.ts exists"
    stat -c "%a %U:%G %n" src/routes/index.ts
else
    echo "❌ src/routes/index.ts NOT found"
fi

if [ -f "src/controllers/customerController.ts" ]; then
    echo "✅ src/controllers/customerController.ts exists"
    stat -c "%a %U:%G %n" src/controllers/customerController.ts
else
    echo "❌ src/controllers/customerController.ts NOT found"
fi
echo ""

# 9. Test file upload endpoint
echo "9️⃣ Testing /customers/import endpoint..."
if command -v curl &> /dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/customers/list)
    if [ "$response" == "200" ]; then
        echo "✅ Application is running (HTTP $response)"
    else
        echo "⚠️  Application returned HTTP $response"
    fi
else
    echo "⚠️  curl not found, skipping endpoint test"
fi
echo ""

# 10. Check environment variables
echo "🔟 Checking environment variables..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    echo "NODE_ENV: ${NODE_ENV:-not set}"
else
    echo "⚠️  .env file not found"
fi
echo ""

echo "========================================"
echo "✅ DIAGNOSTIC COMPLETE"
echo "========================================"
echo ""
echo "📋 RECOMMENDATIONS:"
echo ""
echo "If uploads directory had wrong permissions:"
echo "  sudo chmod 755 uploads"
echo "  sudo chown -R \$USER:\$USER uploads"
echo ""
echo "If Nginx client_max_body_size too small:"
echo "  Edit: /etc/nginx/nginx.conf"
echo "  Add: client_max_body_size 10M;"
echo "  Run: sudo systemctl reload nginx"
echo ""
echo "If packages missing:"
echo "  npm install"
echo ""
echo "If PM2 needs restart:"
echo "  pm2 restart billing"
echo ""

