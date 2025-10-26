#!/bin/bash

# MySQL User Fix Script
# This script fixes the billing_user access issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== MySQL User Fix Script ===${NC}"
echo ""

# Database details
DB_NAME="billing_system"
DB_USER="billing_user"
DB_PASSWORD="Billing1026"

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASSWORD"
echo ""

# Create SQL file with correct MySQL 8.0 syntax
echo -e "${YELLOW}Creating SQL commands...${NC}"
cat > /tmp/fix_mysql_user.sql << EOF
-- Drop existing users if they exist
DROP USER IF EXISTS '${DB_USER}'@'localhost';
DROP USER IF EXISTS '${DB_USER}'@'127.0.0.1';
DROP USER IF EXISTS '${DB_USER}'@'%';

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create users with MySQL 8.0 syntax (IDENTIFIED BY instead of PASSWORD())
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';

-- Grant all privileges
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Show created users
SELECT user, host, plugin FROM mysql.user WHERE user = '${DB_USER}';
EOF

echo -e "${GREEN}SQL file created at /tmp/fix_mysql_user.sql${NC}"
echo ""

# Execute SQL file as root using sudo
echo -e "${YELLOW}Executing SQL commands (requires sudo)...${NC}"
if sudo mysql < /tmp/fix_mysql_user.sql; then
    echo -e "${GREEN}✓ Database user setup completed successfully${NC}"
else
    echo -e "${RED}✗ Failed to execute SQL commands${NC}"
    echo ""
    echo "Please check:"
    echo "  1. Is MySQL/MariaDB running? sudo systemctl status mysql"
    echo "  2. Can you access as root? sudo mysql -e \"SELECT 1;\""
    exit 1
fi

echo ""
echo -e "${YELLOW}=== Testing connections ===${NC}"

# Test localhost connection
echo -n "Testing localhost... "
if mysql -u ${DB_USER} -p${DB_PASSWORD} -h localhost ${DB_NAME} -e "SELECT 'OK' as test;" &>/dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test 127.0.0.1 connection
echo -n "Testing 127.0.0.1... "
if mysql -u ${DB_USER} -p${DB_PASSWORD} -h 127.0.0.1 ${DB_NAME} -e "SELECT 'OK' as test;" &>/dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

echo ""
echo -e "${YELLOW}=== Testing Node.js connection ===${NC}"
cd /var/www/billing
if [ -f "test-db.js" ]; then
    node test-db.js
else
    echo -e "${YELLOW}test-db.js not found, skipping Node.js test${NC}"
fi

echo ""
echo -e "${YELLOW}=== Restarting PM2 application ===${NC}"
pm2 restart billing-system 2>/dev/null || echo -e "${YELLOW}PM2 app not running yet${NC}"
sleep 3
echo ""
pm2 logs billing-system --lines 20 --nostream 2>/dev/null || echo -e "${YELLOW}No PM2 logs yet${NC}"

# Cleanup
rm -f /tmp/fix_mysql_user.sql

echo ""
echo -e "${GREEN}=== Fix completed ===${NC}"
echo ""
echo "Credentials saved to /var/www/billing/.env:"
echo "  DB_HOST=127.0.0.1"
echo "  DB_USER=${DB_USER}"
echo "  DB_PASSWORD=${DB_PASSWORD}"
echo "  DB_NAME=${DB_NAME}"

