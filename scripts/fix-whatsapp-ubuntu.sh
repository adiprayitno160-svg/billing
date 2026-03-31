#!/bin/bash

# Quick Fix Script for WhatsApp Bot on Ubuntu Server
# Run this script on Ubuntu server to fix WhatsApp bot crash loop

echo "=================================================="
echo "🔧 WhatsApp Bot Ubuntu Server Quick Fix"
echo "=================================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Please run: sudo ./scripts/fix-whatsapp-ubuntu.sh"
    exit 1
fi

# Step 1: Install Chromium Dependencies
echo "📦 Step 1/5: Installing Chromium dependencies..."
apt-get update -qq
apt-get install -y ca-certificates fonts-liberation libappindicator3-1 \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 lsb-release wget xdg-utils chromium-browser > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Chromium dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Step 2: Install fonts
echo "🔤 Step 2/5: Installing fonts..."
apt-get install -y fonts-noto fonts-noto-cjk fonts-noto-color-emoji \
    ttf-dejavu-core fonts-liberation > /dev/null 2>&1
echo "✅ Fonts installed"

# Step 3: Verify Chromium
echo "🌐 Step 3/5: Verifying Chromium installation..."
if [ -f "/usr/bin/chromium-browser" ]; then
    CHROMIUM_VERSION=$(/usr/bin/chromium-browser --version 2>/dev/null || echo "Unknown")
    echo "✅ Chromium found: $CHROMIUM_VERSION"
else
    echo "❌ Chromium not found at /usr/bin/chromium-browser"
    exit 1
fi

# Step 4: Create WhatsApp auth directory
echo "📁 Step 4/5: Setting up WhatsApp auth directory..."
APP_DIR="/var/www/billing"
if [ -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR/.wwebjs_auth"
    chmod 755 "$APP_DIR/.wwebjs_auth"
    chown -R $SUDO_USER:$SUDO_USER "$APP_DIR/.wwebjs_auth" 2>/dev/null || true
    echo "✅ WhatsApp auth directory ready"
else
    echo "⚠️  Application directory not found at $APP_DIR"
    echo "   Creating directory..."
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/.wwebjs_auth"
    chmod 755 "$APP_DIR/.wwebjs_auth"
fi

# Step 5: Set environment variable
echo "🔧 Step 5/5: Configuring environment..."
if ! grep -q "PUPPETEER_EXECUTABLE_PATH" /etc/environment; then
    echo "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> /etc/environment
    echo "✅ Environment variable set"
else
    echo "✅ Environment variable already set"
fi

echo ""
echo "=================================================="
echo "✅ WhatsApp Bot Quick Fix Completed!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Rebuild application: npm run build"
echo "2. Restart PM2: pm2 restart billing-app"
echo "3. Monitor logs: pm2 logs billing-app"
echo ""
echo "If you see the QR code in logs, scan it with WhatsApp."
echo "The bot should then work without crash loops."
echo ""
