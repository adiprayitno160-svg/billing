#!/bin/bash

# Hotfix Auto-Update Script
# Checks for new hotfix updates and applies them automatically

echo "🔍 Checking for hotfix updates..."
echo ""

# Get current hotfix version
if [ -f "VERSION_HOTFIX" ]; then
    CURRENT_VERSION=$(cat VERSION_HOTFIX)
    echo "📦 Current version: $CURRENT_VERSION"
else
    CURRENT_VERSION="2.1.0"
    echo "⚠️  No VERSION_HOTFIX file found, assuming: $CURRENT_VERSION"
fi

# Fetch latest from remote
echo "🌐 Fetching latest changes from GitHub..."
git fetch origin main --quiet

# Check if VERSION_HOTFIX changed
REMOTE_VERSION=$(git show origin/main:VERSION_HOTFIX 2>/dev/null || echo "$CURRENT_VERSION")

echo "📦 Remote version: $REMOTE_VERSION"
echo ""

if [ "$CURRENT_VERSION" == "$REMOTE_VERSION" ]; then
    echo "✅ No hotfix updates available"
    echo "   You are running the latest version!"
    exit 0
fi

# Hotfix update available!
echo "🔧 Hotfix update available!"
echo "   Current: $CURRENT_VERSION"
echo "   Latest:  $REMOTE_VERSION"
echo ""

# Ask for confirmation
read -p "Do you want to apply this hotfix? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Hotfix update cancelled"
    exit 0
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Check if there's a hotfix script
HOTFIX_SCRIPT="hotfix/${REMOTE_VERSION}-fix.js"

if [ -f "$HOTFIX_SCRIPT" ]; then
    echo "🔧 Running hotfix script..."
    node "$HOTFIX_SCRIPT"
    
    if [ $? -eq 0 ]; then
        echo "✅ Hotfix script executed successfully"
    else
        echo "❌ Hotfix script failed"
        exit 1
    fi
else
    echo "⚠️  No automated fix script found for this hotfix"
    echo "   Please check hotfix/${REMOTE_VERSION}.md for manual instructions"
fi

# Restart PM2
echo ""
echo "🔄 Restarting application..."
pm2 restart billing-app

if [ $? -eq 0 ]; then
    echo "✅ Application restarted successfully"
else
    echo "❌ Failed to restart application"
    exit 1
fi

# Show new version
NEW_VERSION=$(cat VERSION_HOTFIX)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Hotfix update complete!"
echo "   Version: $NEW_VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Changelog: hotfix/${NEW_VERSION}.md"
echo ""


