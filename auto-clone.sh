#!/bin/bash
# Auto Clone Script - Test dan Clone Otomatis

REPO_URL="https://github.com/adiprayitno160-svg/billing"
REPO_SSH="git@github.com:adiprayitno160-svg/billing.git"
TARGET_DIR="$HOME/apps/billing"

echo "=========================================="
echo "🔍 AUTO CLONE - GitHub Repository"
echo "=========================================="
echo ""

# Clean up old directory
if [ -d "$TARGET_DIR" ]; then
    echo "🗑️  Removing old directory..."
    rm -rf "$TARGET_DIR"
fi

mkdir -p "$HOME/apps"
cd "$HOME/apps"

# Test repository status
echo "🔍 Testing repository access..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$REPO_URL")

echo "   Status Code: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Repository is PUBLIC!"
    echo "📥 Cloning with HTTPS..."
    echo ""
    
    git clone "$REPO_URL.git" 2>&1 | grep -v "Username\|Password" || {
        echo ""
        echo "❌ HTTPS clone failed!"
        echo "🔄 Trying SSH method..."
        echo ""
        
        # Check if SSH key exists
        if [ ! -f "$HOME/.ssh/id_rsa" ]; then
            echo "🔑 SSH key not found. Creating one..."
            ssh-keygen -t rsa -b 4096 -C "auto-deploy" -f "$HOME/.ssh/id_rsa" -N ""
            echo ""
            echo "✅ SSH key created!"
            echo ""
            echo "📋 Your PUBLIC KEY (add this to GitHub):"
            echo "=========================================="
            cat "$HOME/.ssh/id_rsa.pub"
            echo "=========================================="
            echo ""
            echo "📝 Steps to add SSH key to GitHub:"
            echo "1. Copy the key above"
            echo "2. Open: https://github.com/settings/keys"
            echo "3. Click 'New SSH key'"
            echo "4. Paste the key and save"
            echo ""
            echo "⏸️  After adding the key to GitHub, run this script again!"
            exit 1
        fi
        
        echo "🔑 Using existing SSH key..."
        git clone "$REPO_SSH"
    }
    
elif [ "$HTTP_STATUS" = "404" ]; then
    echo "❌ Repository is PRIVATE or NOT FOUND!"
    echo "🔄 Trying SSH method..."
    echo ""
    
    # Check if SSH key exists
    if [ ! -f "$HOME/.ssh/id_rsa" ]; then
        echo "🔑 SSH key not found. Creating one..."
        ssh-keygen -t rsa -b 4096 -C "auto-deploy" -f "$HOME/.ssh/id_rsa" -N ""
        echo ""
        echo "✅ SSH key created!"
        echo ""
        echo "📋 Your PUBLIC KEY (add this to GitHub):"
        echo "=========================================="
        cat "$HOME/.ssh/id_rsa.pub"
        echo "=========================================="
        echo ""
        echo "📝 Steps to add SSH key to GitHub:"
        echo "1. Copy the key above"
        echo "2. Open: https://github.com/settings/keys"
        echo "3. Click 'New SSH key'"
        echo "4. Paste the key and save"
        echo ""
        echo "⏸️  After adding the key to GitHub, run this script again!"
        exit 1
    fi
    
    echo "🔑 Using SSH key..."
    # Test SSH connection first
    ssh -T git@github.com 2>&1 | grep -q "successfully authenticated" && {
        echo "✅ SSH connection works!"
        echo "📥 Cloning with SSH..."
        git clone "$REPO_SSH"
    } || {
        echo "❌ SSH key not added to GitHub yet!"
        echo ""
        echo "📋 Your PUBLIC KEY:"
        echo "=========================================="
        cat "$HOME/.ssh/id_rsa.pub"
        echo "=========================================="
        echo ""
        echo "📝 Add this key to GitHub:"
        echo "https://github.com/settings/keys"
        exit 1
    }
else
    echo "⚠️  Unexpected status: $HTTP_STATUS"
    echo "Manual check required."
    exit 1
fi

# Check if clone was successful
if [ -d "$TARGET_DIR" ] && [ -f "$TARGET_DIR/package.json" ]; then
    echo ""
    echo "=========================================="
    echo "✅ CLONE SUCCESSFUL!"
    echo "=========================================="
    echo ""
    echo "📁 Location: $TARGET_DIR"
    echo ""
    echo "📋 Next steps:"
    echo "   cd $TARGET_DIR"
    echo "   npm install"
    echo "   npm run build"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "❌ CLONE FAILED!"
    echo "=========================================="
    echo ""
    echo "Please check the errors above and try again."
    exit 1
fi


