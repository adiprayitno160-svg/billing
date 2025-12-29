#!/bin/bash

# Install Chromium Dependencies for Ubuntu Server
# This script installs all required dependencies for Puppeteer/Chromium to run on headless Ubuntu

echo "🔧 Installing Chromium dependencies for Ubuntu server..."

# Update package list
sudo apt-get update

# Install required dependencies for Chromium
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    chromium-browser

echo "✅ Chromium dependencies installed successfully!"

# Install fonts for better OCR/text recognition
sudo apt-get install -y \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ttf-dejavu-core \
    fonts-liberation

echo "✅ Fonts installed successfully!"

# Create .wwebjs_auth directory if not exists
mkdir -p /var/www/billing/.wwebjs_auth
chmod 755 /var/www/billing/.wwebjs_auth

echo "✅ WhatsApp auth directory created!"

echo "🎉 All dependencies installed! You can now run the application."
