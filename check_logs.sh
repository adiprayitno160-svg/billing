#!/bin/bash

# ========================================================
# SERVER LOG CHECKER & DIAGNOSTIC SCRIPT
# ========================================================

echo "========================================================"
echo "   SERVER DIAGNOSTIC TOOL - BILLING APP"
echo "========================================================"
echo "   Time: $(date)"
echo "--------------------------------------------------------"

# 1. System Resources
echo ""
echo "[1/4] Checking System Resources..."
echo "RAM Usage:"
free -h | grep Mem | awk '{print "Used: "$3" / Total: "$2}'
echo "Disk Usage:"
df -h / | awk 'NR==2 {print "Used: "$3" / Total: "$2" ("$5")"}'
echo "CPU Load:"
uptime | awk -F'load average:' '{ print $2 }'

# 2. PM2 Status
echo ""
echo "[2/4] Checking PM2 Status..."
if command -v pm2 &> /dev/null; then
    pm2 list | grep billing-app
    if [ $? -eq 0 ]; then
        echo "✅ Billing App is running in PM2."
    else
        echo "❌ Billing App is NOT running in PM2!"
    fi
else
    echo "⚠️ PM2 not installed or not found in PATH."
fi

# 3. Database Connection Check (Simple Port Check)
echo ""
echo "[3/4] Checking Database Connectivity (MySQL Port 3306)..."
if command -v nc &> /dev/null; then
    if nc -z localhost 3306; then
        echo "✅ MySQL Port 3306 is OPEN."
    else
        echo "❌ MySQL Port 3306 is CLOSED or Unreachable."
    fi
else
    echo "⚠️ 'nc' (netcat) not installed, skipping port check."
fi
# Optional: Try a simple query if mysql client exists
if command -v mysql &> /dev/null; then
    # Assumes .env parsing or default user, skipping for safety to avoid exposing pass
    echo "   (MySQL client available)"
fi


# 4. Recent Application Logs (Last 50 lines)
echo ""
echo "[4/4] Fetching Recent Application Logs (Last 50 lines)..."
echo "--------------------------------------------------------"
if command -v pm2 &> /dev/null; then
    # Capture logs and show errors/warnings colored if possible
    pm2 logs billing-app --lines 50 --nostream --raw
else
    echo "⚠️ Unable to fetch PM2 logs."
fi

echo ""
echo "========================================================"
echo "   DIAGNOSTIC COMPLETE"
echo "========================================================"
