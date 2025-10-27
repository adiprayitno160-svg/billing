# Direct Deploy Script - Windows to Debian Server
# Usage: .\deploy.ps1

param(
    [string]$ServerIP = "192.168.239.126",
    [string]$ServerUser = "root",
    [string]$ServerPath = "/opt/billing"
)

$ErrorActionPreference = 'Stop'

Write-Host "`n🚀 Starting Direct Deploy to Server..." -ForegroundColor Green
Write-Host "Server: $ServerUser@$ServerIP" -ForegroundColor Cyan
Write-Host "Path: $ServerPath`n" -ForegroundColor Cyan

# Check if changes are committed
Write-Host "📋 Checking git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain

if ($gitStatus) {
    Write-Host "⚠️  You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host $gitStatus
    $continue = Read-Host "`nDo you want to continue anyway? (y/N)"
    if ($continue -ne 'y') {
        Write-Host "❌ Deploy cancelled" -ForegroundColor Red
        exit 1
    }
}

# Push to GitHub (optional but recommended)
Write-Host "`n📤 Pushing to GitHub..." -ForegroundColor Yellow
try {
    git push origin main
    Write-Host "✓ Pushed to GitHub" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Push failed (continuing anyway)" -ForegroundColor Yellow
}

# Deploy to server via SSH
Write-Host "`n🔄 Deploying to server..." -ForegroundColor Yellow

$deployCommands = @"
cd $ServerPath && \
echo '📥 Pulling latest code...' && \
git pull origin main && \
echo '📦 Installing dependencies...' && \
npm install --production && \
echo '🔨 Building project...' && \
npm run build && \
echo '🎨 Building CSS...' && \
npx tailwindcss -i src/styles/tailwind.css -o public/assets/styles.css --minify && \
echo '🔄 Restarting PM2...' && \
pm2 restart billing-app && \
echo '✅ Deploy complete!' && \
pm2 status
"@

Write-Host "Executing on server..." -ForegroundColor Cyan

# Execute via SSH
ssh ${ServerUser}@${ServerIP} $deployCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deploy Successful!" -ForegroundColor Green
    Write-Host "`n🌐 Application URL: http://$ServerIP:3000" -ForegroundColor Cyan
    Write-Host "📊 Check logs: ssh $ServerUser@$ServerIP 'pm2 logs billing-app --lines 20'" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Deploy Failed!" -ForegroundColor Red
    Write-Host "Check logs on server: ssh $ServerUser@$ServerIP 'pm2 logs billing-app'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✨ Done!`n" -ForegroundColor Green

