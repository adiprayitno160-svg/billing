# Cleanup Script - Remove unnecessary documentation files
# This script removes all temporary, test, debug, and old changelog files

Write-Host "Starting cleanup of unnecessary files..." -ForegroundColor Cyan

# Define files to be removed
$filesToRemove = @(
    # Changelog files
    "CHANGELOG_v2.0.10.md",
    "CHANGELOG_v2.0.3.md",
    "CHANGELOG_v2.0.4.md",
    "CHANGELOG_v2.0.5.md",
    "CHANGELOG_v2.0.6.md",
    "CHANGELOG_v2.0.7.md",
    "CHANGELOG_v2.0.8.md",
    "CHANGELOG_v2.0.9.md",
    "CHANGELOG_v2.1.0.md",
    "CHANGELOG_v2.1.1.md",
    "CHANGELOG_v2.1.10.md",
    "CHANGELOG_v2.1.11.md",
    "CHANGELOG_v2.1.12.md",
    "CHANGELOG_v2.1.13.md",
    "CHANGELOG_v2.1.14.md",
    "CHANGELOG_v2.1.15.md",
    "CHANGELOG_v2.1.16.md",
    "CHANGELOG_v2.1.17.md",
    "CHANGELOG_v2.1.18.md",
    "CHANGELOG_v2.1.19.md",
    "CHANGELOG_v2.1.2.md",
    "CHANGELOG_v2.1.20.md",
    "CHANGELOG_v2.1.3.md",
    "CHANGELOG_v2.1.5.md",
    "CHANGELOG_v2.1.6.md",
    "CHANGELOG_v2.1.7.md",
    "CHANGELOG_v2.1.8.md",
    "CHANGELOG_v2.1.9.md",
    
    # Release notes
    "RELEASE_NOTES_v2.0.8.5.md",
    "RELEASE_NOTES_v2.0.8.md",
    "RELEASE_NOTES_v2.0.9.md",
    "RELEASE_v2.0.3.md",
    "RELEASE_v2.0.4_SUMMARY.md",
    "RELEASE_v2.0.8_DEPLOY.md",
    "RELEASE_v2.0.9.md",
    "RELEASE_v2.0.9_READY.txt",
    
    # Deploy documentation
    "AUTO_DEPLOY_GUIDE.md",
    "AUTO_FIX_IMPLEMENTED.md",
    "AUTO_FIX_MIKROTIK_TIMEOUT.md",
    "AUTO_MIGRATION_READY.md",
    "AUTO_UPDATE_SYSTEM.md",
    "CARA_DEPLOY_OTOMATIS.md",
    "DEPLOY-CEPAT.txt",
    "DEPLOY-COMMANDS-192.168.239.126.txt",
    "DEPLOY_AUTO_MIGRATION.txt",
    "DEPLOY_AUTO_READY.txt",
    "DEPLOY_COMMANDS.txt",
    "DEPLOY_HOTFIX_v2.0.8.3_NOW.txt",
    "DEPLOY_INSTRUCTIONS_v2.1.5.md",
    "DEPLOY_INTERFACE_TRAFFIC_FIX.sh",
    "DEPLOY_MANUAL_STEPS.md",
    "DEPLOY_NOW_v2.0.7.txt",
    "DEPLOY_SIMPLE_IMPORT_NOW.txt",
    "DEPLOY_TO_LIVE_SERVER.txt",
    "DEPLOY_TO_PRODUCTION.sh",
    "DEPLOY_v2.0.3_SUMMARY.md",
    "DEPLOY_v2.0.7_NOW.sh",
    "DEPLOY_v2.0.8.4_SEKARANG.txt",
    "DEPLOY_v2.0.8_SEKARANG.txt",
    "DEPLOY_v2.1.6.md",
    "DEPLOY_v2.1.8.md",
    
    # Fix documentation
    "CRITICAL_HOTFIX_v2.0.8.2.txt",
    "DEBUG_ADDRESS_LIST_ERROR.md",
    "DEBUG_BURST_LIMITING_SYNC.txt",
    "DEBUG_EXCEL_IMPORT.txt",
    "DEBUG_MIKROTIK_SETUP.md",
    "EMERGENCY_HOTFIX_v2.0.8.3.txt",
    "FINAL_FIX_v2.0.8.4_GRADUAL_TRANSITION.txt",
    "FINAL_STEPS.md",
    "FIX_BURST_LIMITING_DATA.txt",
    "FIX_BURST_LIMITING_STEP_BY_STEP.sh",
    "FIX_BURST_MANUAL_COMMANDS.txt",
    "FIX_CONNECTION_TYPE_ERROR.md",
    "FIX_DATABASE_COLUMNS.md",
    "FIX_DATABASE_ERROR_NOW.txt",
    "FIX_DEPLOY_ERROR.txt",
    "FIX_DOUBLE_SIDEBAR.txt",
    "FIX_IMPORT_LIVE_SERVER.md",
    "FIX_INTERFACE_TRAFFIC_REALTIME.md",
    "FIX_LAMBAT_DATABASE.txt",
    "FIX_LIVE_SERVER.txt",
    "FIX_MIKROTIK_DETECTION.md",
    "FIX_MIKROTIK_TIMEOUT_NOW.txt",
    "FIX_NOW.txt",
    "FIX_PM2_NOW.txt",
    "FIX_PREPAID_MIKROTIK_SLOW.md",
    "FIX_PROFILE_PPPOE_RATE_LIMIT.txt",
    "FIX_SUMMARY.md",
    "FIX_SUMMARY_v2.0.7.md",
    "FIX_UPDATE_ISSUE.md",
    
    # Hotfix documentation
    "HOTFIX.md",
    "HOTFIX_ALL_MIKROTIK_TIMEOUT.md",
    "HOTFIX_CATEGORY_COLUMN.md",
    "HOTFIX_DOUBLE_SIDEBAR.md",
    "HOTFIX_ERROR_500.md",
    "HOTFIX_INTERFACE_TRAFFIC_v2.0.8.1.txt",
    "HOTFIX_MIKROTIK_SETUP.md",
    "HOTFIX_ROUTEROS_IMPORT.md",
    "HOTFIX_SLOW_MIKROTIK_PAGES.md",
    
    # Implementation status
    "CHECK_CHART_ISSUE.md",
    "COMPLETE_PREPAID_IMPLEMENTATION.md",
    "IMPLEMENTATION_COMPLETE_SUMMARY.md",
    "IMPLEMENTATION_FINAL_SUMMARY.md",
    "IMPLEMENTATION_STATUS.md",
    "IMPORT_ISSUE_CHECKLIST.md",
    
    # Update documentation
    "README_DEPLOY.txt",
    "README_FIXES_COMPLETED.md",
    "README_INTERFACE_TRAFFIC_FIX.txt",
    "README_UPDATE_v2.1.8.md",
    "SOLUSI_UPDATE.txt",
    "SYNC_TO_PRODUCTION.md",
    "UPDATE_GUIDE.md",
    "UPDATE_SERVER_NOW.txt",
    "UPDATE_SERVER_v2.1.10.txt",
    "UPDATE_SERVER_v2.1.11.txt",
    "UPDATE_SERVER_v2.1.12.txt",
    "UPDATE_SERVER_v2.1.13.txt",
    "UPDATE_SERVER_v2.1.14.txt",
    "UPDATE_SERVER_v2.1.15.txt",
    "UPDATE_SERVER_v2.1.16.txt",
    "UPDATE_SERVER_v2.1.8_FINAL.txt",
    "UPDATE_SERVER_v2.1.9.txt",
    "UPDATE_v2.0.7_SIMPLE.txt",
    "VERIFY_DEPLOYMENT.txt",
    "VERSION_STRATEGY.md",
    
    # Quick guides (temporary)
    "QUICK_DEPLOY.md",
    "QUICK_DEPLOY_GUIDE.md",
    "QUICK_FIX_INTERFACE_TRAFFIC.md",
    "QUICK_FIX_TSC_NOT_FOUND.txt",
    "QUICK_RELEASE_GUIDE.md",
    "QUICK_START_PREPAID_SETUP.md",
    "QUICK_UPDATE_COMMAND.txt",
    "QUICK_UPDATE_GUIDE.txt",
    
    # Test files
    "TEST_BURST_LIMITING_NOW.txt",
    "TEST_EXCEL_IMPORT.txt",
    "test-import.txt",
    "test_download.xlsx",
    "TEMPLATE_IMPORT_EXCEL_SIMPLE.txt",
    "TROUBLESHOOTING_IMPORT_GAGAL.txt",
    
    # Manual steps and temporary scripts
    "MANUAL_STEPS.txt",
    "CARA_BUAT_FILE_EXCEL.txt",
    "CHECK-IMPORT-ERROR.ps1",
    
    # Old deployment scripts
    "auto-deploy.ps1",
    "auto-deploy.sh",
    "auto-fix-database.js",
    "auto-update-views.sh",
    "deploy-simple-import.ps1",
    "deploy-v2.1.5.sh",
    "deploy.ps1",
    "diagnose-import-issue.sh",
    "diagnose-import-live.sh",
    "fix-db-now.js",
    "fix-import-live.sh",
    "force-update.sh",
    "full-deploy.sh",
    "quick-fix-import.sh",
    "release-v2.0.3.sh",
    "release-v2.1.4.ps1",
    "release-v2.1.4.sh",
    "release.ps1",
    "release.sh",
    "remote-update.ps1",
    "remote-update.sh",
    "restart-pm2.ps1",
    "pm2-restart.ps1",
    "setup-complete.sh",
    "setup-dependencies.sh",
    "update-to-2.1.8.sh",
    "update.sh",
    
    # Version tracking files
    "VERSION",
    "VERSION_HOTFIX",
    "VERSION_MAJOR",
    
    # Duplicate env file
    "env.example"
)

$deletedCount = 0
$notFoundCount = 0

foreach ($file in $filesToRemove) {
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

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Cleanup Summary:" -ForegroundColor Cyan
Write-Host "  Files deleted: $deletedCount" -ForegroundColor Green
Write-Host "  Files not found: $notFoundCount" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Git operations
Write-Host "Staging deleted files in Git..." -ForegroundColor Cyan
git add -A

Write-Host "`nCommitting changes..." -ForegroundColor Cyan
git commit -m "chore: cleanup unnecessary changelog, release, test, and documentation files"

Write-Host "`nDo you want to push to GitHub now? (Y/N): " -ForegroundColor Yellow -NoNewline
$pushChoice = Read-Host

if ($pushChoice -eq 'Y' -or $pushChoice -eq 'y') {
    Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
    git push
    Write-Host "`nSuccessfully pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "`nSkipped pushing to GitHub. You can push manually later with: git push" -ForegroundColor Yellow
}

Write-Host "`nCleanup completed!" -ForegroundColor Green

