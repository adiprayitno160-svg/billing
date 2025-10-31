# Phase 3 Cleanup - Remove .bat and .sql files from root
# Remove old deployment scripts and SQL debug files

Write-Host "Starting Phase 3 cleanup (.bat and .sql files)..." -ForegroundColor Cyan

# BAT files to remove (keep only essential ones if any)
$batFiles = @(
    "AUTO-DEPLOY-SIMPLE-IMPORT.bat",
    "DEBUG.bat",
    "DEPLOY-FIXED.bat",
    "deploy-now.bat",
    "deploy-production.bat",
    "DEPLOY-SEKARANG.bat",
    "DEPLOY-TO-192.168.239.126.bat",
    "DEPLOY_INTERFACE_TRAFFIC_FIX.bat",
    "DEPLOY_PREPAID_FIX.bat",
    "DEPLOY_TO_PRODUCTION.bat",
    "DEPLOY_v2.0.7_NOW.bat",
    "FINAL-RELEASE.bat",
    "find-project-path.bat",
    "fix-chart-now.bat",
    "fix-database-error.bat",
    "GO.bat",
    "HOTFIX_DEPLOY.bat",
    "pm2-menu.bat",
    "pm2-restart.bat",
    "pm2-status.bat",
    "quick-fix-import.bat",
    "quick-release.bat",
    "release-v2.0.3.bat",
    "RELEASE_AND_DEPLOY_v2.0.4.bat",
    "RELEASE_NOW.bat",
    "restart-import.bat",
    "restart-pm2.bat",
    "RESTART-SEKARANG.bat",
    "restart-untuk-test.bat",
    "test-production.bat",
    "test-ssh-connection.bat",
    "verify-and-redeploy.bat"
)

# SQL files to remove (debug/test SQL files)
$sqlFiles = @(
    "auto-fix-database.sql",
    "check-customer-table.sql",
    "check-mikrotik-db.sql",
    "CHECK_PRODUCTION_DB.sql",
    "CREATE_PREPAID_PACKAGES_TABLE.sql",
    "FIX_NOW.sql",
    "QUICK_FIX_COPY_PASTE.sql"
)

# Other files to remove
$otherFiles = @(
    "COMMIT_MESSAGE_v2.0.6.txt",
    "billing-system.tar.gz",
    "billing-system.zip"
)

$allFiles = $batFiles + $sqlFiles + $otherFiles
$deletedCount = 0
$notFoundCount = 0

foreach ($file in $allFiles) {
    $filePath = Join-Path $PSScriptRoot $file
    if (Test-Path $filePath) {
        Remove-Item $filePath -Force
        Write-Host "[OK] Deleted: $file" -ForegroundColor Green
        $deletedCount++
    } else {
        Write-Host "[SKIP] Not found: $file" -ForegroundColor Yellow
        $notFoundCount++
    }
}

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "Phase 3 Cleanup Summary:" -ForegroundColor Cyan
Write-Host "  BAT files: $($batFiles.Count)" -ForegroundColor White
Write-Host "  SQL files: $($sqlFiles.Count)" -ForegroundColor White
Write-Host "  Other files: $($otherFiles.Count)" -ForegroundColor White
Write-Host "  ---" -ForegroundColor White
Write-Host "  Total deleted: $deletedCount" -ForegroundColor Green
Write-Host "  Not found: $notFoundCount" -ForegroundColor Yellow
Write-Host "=======================================" -ForegroundColor Cyan

# Git operations
Write-Host "`nStaging changes..." -ForegroundColor Cyan
git add -A

Write-Host "`nCommitting changes..." -ForegroundColor Cyan
git commit -m "chore: cleanup phase 3 - remove all .bat deployment scripts and debug .sql files"

Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
git push

Write-Host "`nPhase 3 cleanup completed!" -ForegroundColor Green
Write-Host "`nYour repository is now clean and minimal!" -ForegroundColor Cyan

