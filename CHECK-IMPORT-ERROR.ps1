# ═══════════════════════════════════════════════════════════════════════════
# 🔍 AUTO-CHECK IMPORT EXCEL ERROR
# ═══════════════════════════════════════════════════════════════════════════

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ServerIP = ""
)

Write-Host "╔═══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🔍 AUTO-CHECK IMPORT EXCEL ERROR                                        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Get server details if not provided
if ([string]::IsNullOrWhiteSpace($ServerUser)) {
    $ServerUser = Read-Host "👤 Server username"
}

if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    $ServerIP = Read-Host "🌐 Server IP"
}

Write-Host ""
Write-Host "🔍 Checking server: $ServerUser@$ServerIP" -ForegroundColor Yellow
Write-Host ""

# Check 1: Git version
Write-Host "1️⃣  Checking Git version..." -ForegroundColor Cyan
$gitVersion = ssh "$ServerUser@$ServerIP" "cd /opt/billing && cat VERSION 2>/dev/null || echo 'FILE NOT FOUND'"
Write-Host "   Current version: $gitVersion" -ForegroundColor White

if ($gitVersion -eq "FILE NOT FOUND") {
    Write-Host "   ❌ VERSION file not found! Deployment might have failed." -ForegroundColor Red
} else {
    Write-Host "   ✅ Version file exists" -ForegroundColor Green
}
Write-Host ""

# Check 2: PM2 status
Write-Host "2️⃣  Checking PM2 status..." -ForegroundColor Cyan
ssh "$ServerUser@$ServerIP" "pm2 list"
Write-Host ""

# Check 3: Recent PM2 logs (last 30 lines)
Write-Host "3️⃣  Checking recent PM2 logs (last 30 lines)..." -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
ssh "$ServerUser@$ServerIP" "pm2 logs billing-app --lines 30 --nostream 2>/dev/null || pm2 logs billing-system --lines 30 --nostream 2>/dev/null || pm2 logs billing --lines 30 --nostream"
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

# Check 4: Check if customerController.ts exists
Write-Host "4️⃣  Checking if import controller exists..." -ForegroundColor Cyan
$controllerExists = ssh "$ServerUser@$ServerIP" "test -f /opt/billing/dist/controllers/customerController.js && echo 'EXISTS' || echo 'NOT FOUND'"
if ($controllerExists -eq "EXISTS") {
    Write-Host "   ✅ customerController.js exists (compiled)" -ForegroundColor Green
} else {
    Write-Host "   ❌ customerController.js NOT FOUND! TypeScript build might have failed." -ForegroundColor Red
}
Write-Host ""

# Check 5: Check last customers in database
Write-Host "5️⃣  Checking last 5 customers in database..." -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
ssh "$ServerUser@$ServerIP" "mysql -u root -p -e 'USE billing; SELECT id, name, phone, created_at FROM customers ORDER BY id DESC LIMIT 5;' 2>/dev/null || echo '⚠️  Could not connect to database'"
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

# Diagnostic summary
Write-Host "╔═══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║  📋 DIAGNOSTIC SUMMARY                                                    ║" -ForegroundColor Yellow
Write-Host "╚═══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""

Write-Host "Berdasarkan hasil di atas, coba analisa:" -ForegroundColor White
Write-Host ""
Write-Host "❓ Apakah PM2 status 'online' dan 'uptime' bukan '0s'?" -ForegroundColor Cyan
Write-Host "   - Jika 'stopped' atau 'errored' → PM2 crash, restart dulu" -ForegroundColor Gray
Write-Host ""
Write-Host "❓ Apakah ada error di PM2 logs?" -ForegroundColor Cyan
Write-Host "   - Lihat log di atas, cari kata 'error', 'failed', 'cannot'" -ForegroundColor Gray
Write-Host ""
Write-Host "❓ Apakah customerController.js EXISTS?" -ForegroundColor Cyan
Write-Host "   - Jika NOT FOUND → npm run build gagal" -ForegroundColor Gray
Write-Host ""
Write-Host "❓ Apakah customer terbaru ada di database?" -ForegroundColor Cyan
Write-Host "   - Jika kosong → import belum pernah berhasil" -ForegroundColor Gray
Write-Host "   - Jika ada tapi lama → import baru gagal" -ForegroundColor Gray
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

# Ask for next action
Write-Host "🔧 Mau coba apa sekarang?" -ForegroundColor Green
Write-Host "   1. Rebuild & restart PM2" -ForegroundColor White
Write-Host "   2. Monitor live logs (real-time)" -ForegroundColor White
Write-Host "   3. Test upload Excel sekarang" -ForegroundColor White
Write-Host "   4. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Pilih (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🔨 Rebuilding & restarting..." -ForegroundColor Cyan
        ssh "$ServerUser@$ServerIP" "cd /opt/billing && npm run build && pm2 restart billing-app"
        Write-Host ""
        Write-Host "✅ Done! Coba upload Excel lagi." -ForegroundColor Green
    }
    "2" {
        Write-Host ""
        Write-Host "📖 Monitoring live logs... (Press Ctrl+C to stop)" -ForegroundColor Cyan
        Write-Host ""
        ssh "$ServerUser@$ServerIP" "pm2 logs billing-app --lines 0"
    }
    "3" {
        Write-Host ""
        Write-Host "🌐 Buka browser untuk test upload..." -ForegroundColor Cyan
        Start-Process "http://$ServerIP/customers/list"
        Write-Host ""
        Write-Host "📖 Monitoring logs... (Press Ctrl+C to stop)" -ForegroundColor Cyan
        ssh "$ServerUser@$ServerIP" "pm2 logs billing-app --lines 0"
    }
    "4" {
        Write-Host ""
        Write-Host "👋 Exit" -ForegroundColor White
    }
}

Write-Host ""
Read-Host "Press Enter to exit"

