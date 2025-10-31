# Hotfix Auto-Update Script (PowerShell)
# Checks for new hotfix updates and applies them automatically

Write-Host ""
Write-Host "🔍 Checking for hotfix updates..." -ForegroundColor Cyan
Write-Host ""

# Get current hotfix version
$CurrentVersion = "2.1.0"
if (Test-Path "VERSION_HOTFIX") {
    $CurrentVersion = Get-Content "VERSION_HOTFIX" -Raw
    $CurrentVersion = $CurrentVersion.Trim()
    Write-Host "📦 Current version: $CurrentVersion" -ForegroundColor White
} else {
    Write-Host "⚠️  No VERSION_HOTFIX file found, assuming: $CurrentVersion" -ForegroundColor Yellow
}

# Fetch latest from remote
Write-Host "🌐 Fetching latest changes from GitHub..." -ForegroundColor Cyan
git fetch origin main --quiet 2>$null

# Check if VERSION_HOTFIX changed
try {
    $RemoteVersion = git show origin/main:VERSION_HOTFIX 2>$null
    $RemoteVersion = $RemoteVersion.Trim()
} catch {
    $RemoteVersion = $CurrentVersion
}

Write-Host "📦 Remote version: $RemoteVersion" -ForegroundColor White
Write-Host ""

if ($CurrentVersion -eq $RemoteVersion) {
    Write-Host "✅ No hotfix updates available" -ForegroundColor Green
    Write-Host "   You are running the latest version!" -ForegroundColor Gray
    exit 0
}

# Hotfix update available!
Write-Host "🔧 Hotfix update available!" -ForegroundColor Yellow
Write-Host "   Current: $CurrentVersion" -ForegroundColor Gray
Write-Host "   Latest:  $RemoteVersion" -ForegroundColor Green
Write-Host ""

# Ask for confirmation
$Response = Read-Host "Do you want to apply this hotfix? (y/n)"

if ($Response -ne "y" -and $Response -ne "Y") {
    Write-Host "❌ Hotfix update cancelled" -ForegroundColor Red
    exit 0
}

# Pull latest changes
Write-Host ""
Write-Host "📥 Pulling latest changes..." -ForegroundColor Cyan
git pull origin main

# Check if there's a hotfix script
$HotfixScript = "hotfix\$RemoteVersion-fix.js"

if (Test-Path $HotfixScript) {
    Write-Host "🔧 Running hotfix script..." -ForegroundColor Cyan
    
    # Use Laragon Node.js path
    $NodePath = "C:\laragon\bin\nodejs\node-v22\node.exe"
    if (Test-Path $NodePath) {
        & $NodePath $HotfixScript
    } else {
        node $HotfixScript
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Hotfix script executed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Hotfix script failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  No automated fix script found for this hotfix" -ForegroundColor Yellow
    Write-Host "   Please check hotfix\$RemoteVersion.md for manual instructions" -ForegroundColor Gray
}

# Restart PM2
Write-Host ""
Write-Host "🔄 Restarting application..." -ForegroundColor Cyan

# Try using restart-pm2.bat if it exists
if (Test-Path "restart-pm2.bat") {
    & .\restart-pm2.bat
} else {
    pm2 restart billing-app
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Application restarted successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to restart application" -ForegroundColor Red
    exit 1
}

# Show new version
$NewVersion = Get-Content "VERSION_HOTFIX" -Raw
$NewVersion = $NewVersion.Trim()

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Hotfix update complete!" -ForegroundColor Green
Write-Host "   Version: $NewVersion" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Changelog: hotfix\$NewVersion.md" -ForegroundColor Cyan
Write-Host ""



