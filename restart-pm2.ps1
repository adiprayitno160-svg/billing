# PowerShell script to restart PM2 billing-app
Write-Host "Restarting PM2 billing-app..." -ForegroundColor Cyan

# Change to script directory
Set-Location $PSScriptRoot

# Define common Node.js/npm paths
$npmPaths = @(
    "C:\laragon\bin\nodejs\node-v22\npm.cmd",
    "C:\laragon\bin\nodejs\npm.cmd",
    "C:\Program Files\nodejs\npm.cmd",
    "$env:APPDATA\npm\npm.cmd"
)

$pm2Paths = @(
    "C:\laragon\bin\nodejs\node-v22\pm2.cmd",
    "C:\laragon\bin\nodejs\pm2.cmd",
    "$env:APPDATA\npm\pm2.cmd",
    "C:\Program Files\nodejs\pm2.cmd"
)

try {
    # Method 1: Try to find and use PM2 directly
    foreach ($pm2Path in $pm2Paths) {
        if (Test-Path $pm2Path) {
            Write-Host "Found PM2 at: $pm2Path" -ForegroundColor Green
            & $pm2Path restart billing-app
            Write-Host "`nPM2 restart completed successfully!" -ForegroundColor Green
            exit 0
        }
    }

    # Method 2: Try to install PM2 using npm
    foreach ($npmPath in $npmPaths) {
        if (Test-Path $npmPath) {
            Write-Host "Found npm at: $npmPath" -ForegroundColor Yellow
            Write-Host "Installing PM2 globally..." -ForegroundColor Yellow
            & $npmPath install -g pm2
            
            # Try to find PM2 again after installation
            foreach ($pm2Path in $pm2Paths) {
                if (Test-Path $pm2Path) {
                    Write-Host "PM2 installed successfully at: $pm2Path" -ForegroundColor Green
                    & $pm2Path restart billing-app
                    Write-Host "`nPM2 restart completed successfully!" -ForegroundColor Green
                    exit 0
                }
            }
        }
    }

    # Method 3: Try using npx
    $npxPaths = @(
        "C:\laragon\bin\nodejs\node-v22\npx.cmd",
        "C:\laragon\bin\nodejs\npx.cmd",
        "C:\Program Files\nodejs\npx.cmd"
    )
    
    foreach ($npxPath in $npxPaths) {
        if (Test-Path $npxPath) {
            Write-Host "Using npx at: $npxPath" -ForegroundColor Green
            & $npxPath pm2 restart billing-app
            Write-Host "`nPM2 restart completed successfully!" -ForegroundColor Green
            exit 0
        }
    }

    # If all methods fail
    Write-Host "`nERROR: Could not find PM2" -ForegroundColor Red
    Write-Host "Please ensure Node.js and PM2 are installed" -ForegroundColor Yellow
    Write-Host "Or open Laragon Terminal and run: pm2 restart billing-app" -ForegroundColor Yellow
    exit 1
}
catch {
    Write-Host "`nError occurred: $_" -ForegroundColor Red
    exit 1
}

