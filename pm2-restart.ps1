# PM2 Restart Script for PowerShell
Write-Host "Restarting PM2 Application..." -ForegroundColor Cyan

# Try to restart the billing-app
pm2 restart billing-app

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nApplication restarted successfully!" -ForegroundColor Green
    pm2 list
} else {
    Write-Host "`nFailed to restart. Make sure PM2 is installed and in PATH." -ForegroundColor Red
    Write-Host "You can install PM2 globally with: npm install -g pm2" -ForegroundColor Yellow
}

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")



