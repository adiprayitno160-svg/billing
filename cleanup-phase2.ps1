# Phase 2 Cleanup - Remove more unnecessary files
# This removes old scripts, hotfixes, and installation files

Write-Host "Starting Phase 2 cleanup..." -ForegroundColor Cyan

# Files and directories to remove
$itemsToRemove = @(
    # Old installation scripts (keep only install.sh for Linux users)
    "install-debian-tested.sh",
    "uninstall.sh",
    
    # Scripts directory (contains only old deployment/release scripts)
    "scripts",
    
    # Hotfix directory (old version hotfixes)
    "hotfix",
    
    # Migrations directory (empty)
    "migrations",
    
    # Duplicate/old PM2 guides (keep only main README.md)
    "PM2_GUIDE.md",
    "README-PM2.md",
    
    # Docs that are now outdated or duplicates
    "docs/INSTALLATION_SCRIPTS.md",
    "docs/INSTALLATION_SUMMARY.md",
    "docs/PREPAID_MIKROTIK_ONE_CLICK_SETUP.md",
    "docs/PREPAID_MIKROTIK_SETUP.md",
    "docs/PREPAID_SETUP_COMPLETE_GUIDE.md",
    "docs/QUICK_FIX_GUIDE.md"
)

$deletedCount = 0
$notFoundCount = 0

foreach ($item in $itemsToRemove) {
    $itemPath = Join-Path $PSScriptRoot $item
    if (Test-Path $itemPath) {
        if ((Get-Item $itemPath) -is [System.IO.DirectoryInfo]) {
            Remove-Item $itemPath -Recurse -Force
            Write-Host "[OK] Deleted directory: $item" -ForegroundColor Green
        } else {
            Remove-Item $itemPath -Force
            Write-Host "[OK] Deleted file: $item" -ForegroundColor Green
        }
        $deletedCount++
    } else {
        Write-Host "[SKIP] Not found: $item" -ForegroundColor Yellow
        $notFoundCount++
    }
}

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "Phase 2 Cleanup Summary:" -ForegroundColor Cyan
Write-Host "  Items deleted: $deletedCount" -ForegroundColor Green
Write-Host "  Items not found: $notFoundCount" -ForegroundColor Yellow
Write-Host "=======================================" -ForegroundColor Cyan

# Git operations
Write-Host "`nStaging changes..." -ForegroundColor Cyan
git add -A

Write-Host "`nCommitting changes..." -ForegroundColor Cyan
git commit -m "chore: cleanup phase 2 - remove old scripts, hotfixes, and duplicate documentation"

Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
git push

Write-Host "`nPhase 2 cleanup completed!" -ForegroundColor Green
Write-Host "`nRemaining documentation:" -ForegroundColor Cyan
Write-Host "  - README.md (main documentation)" -ForegroundColor White
Write-Host "  - install.sh (Linux installation)" -ForegroundColor White
Write-Host "  - docs/ (essential guides only)" -ForegroundColor White
