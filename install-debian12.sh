#!/bin/bash

# ============================================
# Quick Install Script untuk Debian 12
# ============================================

set -e

echo "╔══════════════════════════════════════════╗"
echo "║  🚀 Billing System - Debian 12 Installer ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Script ini harus dijalankan sebagai root"
    echo "Gunakan: sudo bash $0"
    exit 1
fi

# Detect Debian version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "debian" ]]; then
        echo "❌ Script ini untuk Debian only"
        echo "Detected: $PRETTY_NAME"
        exit 1
    fi
    echo "✓ Detected: $PRETTY_NAME"
else
    echo "❌ Cannot detect OS"
    exit 1
fi

echo ""
read -p "🚀 Start installation? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled"
    exit 1
fi

echo ""
echo "📥 Downloading installation script..."
wget -q https://raw.githubusercontent.com/adiprayitno160-svg/billing/main/install-fixed.sh -O /tmp/billing-install.sh

if [ ! -f /tmp/billing-install.sh ]; then
    echo "❌ Failed to download installation script"
    exit 1
fi

echo "✓ Download complete"
echo ""
echo "🚀 Starting installation..."
echo ""

# Run installation script
bash /tmp/billing-install.sh

# Cleanup
rm -f /tmp/billing-install.sh

echo ""
echo "✓ Installation script completed!"

