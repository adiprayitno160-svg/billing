# ═══════════════════════════════════════════════════════════
# 🚀 AUTO DEPLOY SCRIPT untuk Windows PowerShell
# ═══════════════════════════════════════════════════════════
# Version: 2.0.8.1
# Date: October 29, 2025
# Usage: .\auto-deploy.ps1
# ═══════════════════════════════════════════════════════════

param(
    [string]$ServerIP = "192.168.239.126",
    [string]$ServerUser = "root",
    [string]$ProjectPath = "/opt/billing"
)

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 AUTO DEPLOY v2.0.8.1 - Billing System" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Server: $ServerUser@$ServerIP" -ForegroundColor White
Write-Host "Project Path: $ProjectPath" -ForegroundColor White
Write-Host ""

# Check if ssh is available
try {
    $null = Get-Command ssh -ErrorAction Stop
} catch {
    Write-Host "❌ ERROR: SSH not found!" -ForegroundColor Red
    Write-Host "Please install OpenSSH client first." -ForegroundColor Yellow
    exit 1
}

Write-Host "🔄 Step 1: Connecting to server..." -ForegroundColor Cyan
Write-Host ""

# Build SSH command
$deployCommands = @"
echo '🔄 Starting deployment...'
echo ''

echo '📂 Step 2: Navigating to project directory...'
cd $ProjectPath || exit 1
echo '✅ Current directory: '
pwd
echo ''

echo '📥 Step 3: Fetching latest changes from GitHub...'
git fetch --tags
echo ''

echo '📦 Step 4: Pulling updates...'
git pull origin main
echo ''

echo '🔍 Step 5: Checking version...'
echo -n 'Current version: '
cat VERSION
echo ''

echo '🔄 Step 6: Restarting PM2 application...'
pm2 restart billing-app
echo ''

echo '✅ Step 7: Verifying PM2 status...'
pm2 status
echo ''

echo '📋 Step 8: Showing recent logs...'
pm2 logs billing-app --lines 10 --nostream
echo ''

echo '═══════════════════════════════════════════════════════════'
echo '✅ DEPLOYMENT COMPLETED!'
echo '═══════════════════════════════════════════════════════════'
echo ''
echo '📊 Next Steps:'
echo '1. Open browser: http://$ServerIP:3000/prepaid/dashboard'
echo '2. Hard refresh (Ctrl+F5)'
echo '3. Test Interface Traffic monitoring'
echo ''
"@

# Execute deployment via SSH
Write-Host "Executing deployment commands..." -ForegroundColor Green
Write-Host ""

ssh -o ConnectTimeout=10 "$ServerUser@$ServerIP" $deployCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "✅ DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "🧪 Testing URLs:" -ForegroundColor Yellow
    Write-Host "  Dashboard: http://$ServerIP:3000/prepaid/dashboard" -ForegroundColor White
    Write-Host "  Address List: http://$ServerIP:3000/prepaid/address-list" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Remember to:" -ForegroundColor Yellow
    Write-Host "  1. Hard refresh browser (Ctrl+F5)" -ForegroundColor White
    Write-Host "  2. Wait 15-20 seconds for smooth graph" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "❌ DEPLOYMENT FAILED!" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. SSH connection to $ServerUser@$ServerIP" -ForegroundColor White
    Write-Host "  2. Project path: $ProjectPath" -ForegroundColor White
    Write-Host "  3. PM2 configuration" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

