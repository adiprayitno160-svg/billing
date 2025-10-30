# ═══════════════════════════════════════════════════════════════════════════
# 🚀 AUTO DEPLOY - SIMPLE IMPORT EXCEL (3 KOLOM)
# ═══════════════════════════════════════════════════════════════════════════

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ServerIP = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectPath = "/opt/billing"
)

# Colors
$Host.UI.RawUI.ForegroundColor = "Green"

Write-Host "╔═══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🚀 AUTO DEPLOY - SIMPLE IMPORT EXCEL (3 KOLOM)                          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Get server details if not provided
if ([string]::IsNullOrWhiteSpace($ServerUser)) {
    $ServerUser = Read-Host "👤 Server username (contoh: root)"
}

if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    $ServerIP = Read-Host "🌐 Server IP (contoh: 103.xxx.xxx.xxx)"
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "📋 Deployment Info:" -ForegroundColor Yellow
Write-Host "   - Server: $ServerUser@$ServerIP" -ForegroundColor White
Write-Host "   - Path: $ProjectPath" -ForegroundColor White
Write-Host "   - Changes: Simple Import Excel (Nama, Telepon, Alamat)" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Lanjutkan deployment? (Y/n)"
if ($confirm -eq "n" -or $confirm -eq "N") {
    Write-Host "❌ Deployment dibatalkan" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔄 Connecting to server and deploying..." -ForegroundColor Cyan
Write-Host ""

# Deployment commands
$deployScript = @"
cd $ProjectPath && \
echo '════════════════════════════════════════════════════════════' && \
echo '1️⃣  Pulling latest changes from GitHub...' && \
git pull origin main && \
echo '' && \
echo '2️⃣  Installing dependencies (if needed)...' && \
npm install && \
echo '' && \
echo '3️⃣  Building TypeScript...' && \
npm run build && \
echo '' && \
echo '4️⃣  Restarting PM2...' && \
(pm2 restart billing-app 2>/dev/null || pm2 restart billing-system 2>/dev/null || pm2 restart billing 2>/dev/null) && \
echo '' && \
echo '5️⃣  Checking status...' && \
pm2 list && \
echo '' && \
echo '════════════════════════════════════════════════════════════' && \
echo '✅ DEPLOYMENT COMPLETED!' && \
echo '════════════════════════════════════════════════════════════' && \
echo '' && \
echo '📦 New Version:' && \
cat VERSION && \
echo '' && \
echo '🌐 Application URL: http://$ServerIP' && \
echo '📖 Check logs: pm2 logs billing-app --lines 20'
"@

# Execute deployment via SSH
$result = ssh "$ServerUser@$ServerIP" $deployScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ DEPLOYMENT SUCCESS!                                                   ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Simple Import Excel (3 kolom) sudah aktif!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Cara Test Import:" -ForegroundColor Yellow
    Write-Host "   1. Buat Excel dengan 3 kolom: Nama | Telepon | Alamat" -ForegroundColor White
    Write-Host "   2. Buka: http://$ServerIP/customers/list" -ForegroundColor White
    Write-Host "   3. Klik: '📥 Import Excel'" -ForegroundColor White
    Write-Host "   4. Upload file Excel Anda" -ForegroundColor White
    Write-Host "   5. Monitor log: ssh $ServerUser@$ServerIP 'pm2 logs billing-app --lines 0'" -ForegroundColor White
    Write-Host ""
    Write-Host "📄 Template Excel:" -ForegroundColor Yellow
    Write-Host "   Baris 1: Nama | Telepon | Alamat" -ForegroundColor White
    Write-Host "   Baris 2: John Doe | 08123456789 | Jl. Merdeka No. 123" -ForegroundColor White
    Write-Host "   Baris 3: Jane Smith | 08234567890 | Jl. Sudirman No. 456" -ForegroundColor White
    Write-Host ""
    
    # Open browser
    $openBrowser = Read-Host "Buka browser untuk test? (Y/n)"
    if ($openBrowser -ne "n" -and $openBrowser -ne "N") {
        Start-Process "http://$ServerIP/customers/list"
    }
} else {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║  ❌ DEPLOYMENT FAILED!                                                    ║" -ForegroundColor Red
    Write-Host "╚═══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Cek koneksi SSH: ssh $ServerUser@$ServerIP" -ForegroundColor White
    Write-Host "   2. Cek path project: ssh $ServerUser@$ServerIP 'ls $ProjectPath'" -ForegroundColor White
    Write-Host "   3. Manual deploy:" -ForegroundColor White
    Write-Host "      ssh $ServerUser@$ServerIP" -ForegroundColor Gray
    Write-Host "      cd $ProjectPath" -ForegroundColor Gray
    Write-Host "      git pull origin main" -ForegroundColor Gray
    Write-Host "      npm run build" -ForegroundColor Gray
    Write-Host "      pm2 restart billing-app" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Read-Host "Press Enter to exit"

