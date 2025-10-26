#!/bin/bash
# Script untuk cek apakah repository GitHub sudah public

echo "🔍 Checking GitHub Repository Status..."
echo "Repository: https://github.com/adiprayitno160-svg/billing"
echo ""

# Test dengan curl
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://github.com/adiprayitno160-svg/billing)

if [ "$STATUS" = "200" ]; then
    echo "✅ Repository is PUBLIC!"
    echo "You can clone without authentication."
    echo ""
    echo "Run this command:"
    echo "git clone https://github.com/adiprayitno160-svg/billing.git"
elif [ "$STATUS" = "404" ]; then
    echo "❌ Repository is PRIVATE or NOT FOUND!"
    echo ""
    echo "Solutions:"
    echo "1. Make repository public on GitHub"
    echo "2. Use SSH clone (need SSH key setup)"
    echo "3. Upload files directly via SCP/WinSCP"
else
    echo "⚠️  Unknown status: $STATUS"
    echo "Please check manually at:"
    echo "https://github.com/adiprayitno160-svg/billing"
fi


