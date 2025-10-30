#!/bin/bash
#
# Diagnose Import Issue - Run on LIVE SERVER
# Usage: ./diagnose-import-issue.sh
#

echo "🔍 DIAGNOSING IMPORT ISSUE"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check if dist exists and is recent
echo "1️⃣  Checking build status..."
if [ -f "dist/server.js" ]; then
    BUILD_DATE=$(stat -c %y dist/server.js 2>/dev/null || stat -f "%Sm" dist/server.js)
    echo -e "${GREEN}✓${NC} dist/server.js exists"
    echo "   Last built: $BUILD_DATE"
else
    echo -e "${RED}✗${NC} dist/server.js NOT FOUND"
    echo "   Action: Run 'npm run build'"
fi

echo ""

# 2. Check excelController.ts vs dist/controllers/excelController.js
echo "2️⃣  Checking if excelController is up to date..."
if [ -f "dist/controllers/excelController.js" ]; then
    # Check if flexible column handling exists in dist
    if grep -q "row\['nama'\]" dist/controllers/excelController.js; then
        echo -e "${GREEN}✓${NC} Flexible column handling PRESENT in dist/"
    else
        echo -e "${RED}✗${NC} Flexible column handling MISSING in dist/"
        echo "   Action: Run 'npm run build' to rebuild"
    fi
else
    echo -e "${RED}✗${NC} dist/controllers/excelController.js NOT FOUND"
fi

echo ""

# 3. Check PM2 status
echo "3️⃣  Checking PM2 status..."
if command -v pm2 &> /dev/null; then
    pm2 list | grep billing-app
    
    # Check uptime
    UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="billing-app") | .pm2_env.pm_uptime' 2>/dev/null)
    if [ ! -z "$UPTIME" ]; then
        echo "   Uptime: $(date -d @$((UPTIME/1000)) +"%Y-%m-%d %H:%M:%S")"
    fi
else
    echo -e "${RED}✗${NC} PM2 not found"
fi

echo ""

# 4. Check recent logs for import errors
echo "4️⃣  Checking recent import errors..."
if [ -f "logs/err.log" ]; then
    echo "Recent errors from logs/err.log:"
    tail -20 logs/err.log | grep -i "import\|excel\|customer" || echo "   No import-related errors found"
else
    echo "   logs/err.log not found"
fi

echo ""

# 5. Check database connection
echo "5️⃣  Checking database connectivity..."
if [ -f ".env" ]; then
    DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2)
    DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2)
    DB_USER=$(grep DB_USER .env | cut -d '=' -f2)
    
    echo "   DB: $DB_NAME @ $DB_HOST (user: $DB_USER)"
    
    # Try to connect
    if command -v mysql &> /dev/null; then
        source .env
        CUSTOMER_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -se "SELECT COUNT(*) FROM customers" 2>/dev/null)
        if [ ! -z "$CUSTOMER_COUNT" ]; then
            echo -e "   ${GREEN}✓${NC} Database connected, $CUSTOMER_COUNT customers found"
        else
            echo -e "   ${YELLOW}?${NC} Could not query database"
        fi
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
fi

echo ""

# 6. Check Node.js version
echo "6️⃣  Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js: $NODE_VERSION"

echo ""

# 7. Check package.json version
echo "7️⃣  Checking application version..."
if [ -f "package.json" ]; then
    APP_VERSION=$(grep '"version"' package.json | head -1 | cut -d '"' -f4)
    echo "   App version: $APP_VERSION"
fi

echo ""
echo "=========================="
echo "DIAGNOSIS COMPLETE"
echo "=========================="
echo ""
echo "📋 RECOMMENDED ACTIONS:"
echo ""

# Check if rebuild needed
if [ -f "dist/controllers/excelController.js" ]; then
    if ! grep -q "row\['nama'\]" dist/controllers/excelController.js; then
        echo "⚠️  CODE OUT OF DATE - Run: npm run build && pm2 restart billing-app"
    else
        echo "✅ Code seems up to date"
        echo "   If import still fails, check:"
        echo "   - Excel file format (must have 'Nama', 'Telepon', 'Alamat' columns)"
        echo "   - PM2 logs: pm2 logs billing-app"
        echo "   - Database duplicates: SELECT phone, COUNT(*) FROM customers GROUP BY phone HAVING COUNT(*) > 1"
    fi
else
    echo "❌ BUILD MISSING - Run: npm run build"
fi

echo ""

