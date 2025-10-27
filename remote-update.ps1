# Remote Update Script untuk Windows
# Script ini dijalankan dari Windows untuk update server Linux via SSH

param(
    [string]$Host = "your-server-ip",
    [string]$User = "root",
    [int]$Port = 22,
    [string]$KeyPath = "",
    [switch]$Force,
    [switch]$Help
)

$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Yellow"
$BlueColor = "Cyan"

if ($Help) {
    Write-Host @"
Remote Update Script untuk Billing System

Usage: .\remote-update.ps1 [OPTIONS]

Options:
  -Host HOST      SSH host/IP address (required)
  -User USER      SSH username (default: root)
  -Port PORT      SSH port (default: 22)
  -KeyPath PATH   Path to SSH private key file
  -Force          Force update without confirmation
  -Help           Show this help message

Examples:
  .\remote-update.ps1 -Host 192.168.1.100
  .\remote-update.ps1 -Host myserver.com -User ubuntu -Port 2222
  .\remote-update.ps1 -Host 192.168.1.100 -KeyPath C:\Users\user\.ssh\id_rsa

Requirements:
  - SSH client must be installed (built-in on Windows 10/11)
  - Network access to the server
  - Valid SSH credentials

"@
    exit 0
}

Write-Host "`n========================================" -ForegroundColor $BlueColor
Write-Host "🚀 Remote Update Billing System" -ForegroundColor $SuccessColor
Write-Host "========================================`n" -ForegroundColor $BlueColor

# Validate required parameters
if ($Host -eq "your-server-ip") {
    Write-Host "Error: Please specify server host/IP with -Host parameter" -ForegroundColor $ErrorColor
    Write-Host "Example: .\remote-update.ps1 -Host 192.168.1.100`n" -ForegroundColor $InfoColor
    exit 1
}

Write-Host "Target Server:" -ForegroundColor $InfoColor
Write-Host "  Host: $Host"
Write-Host "  User: $User"
Write-Host "  Port: $Port"
$APP_DIR = "/opt/billing"
Write-Host "  App Dir: $APP_DIR`n"

# Build SSH command
$sshArgs = @("-p", $Port)
if ($KeyPath) {
    $sshArgs += @("-i", $KeyPath)
}
$sshArgs += @("${User}@${Host}")

# Test SSH connection
Write-Host "Testing SSH connection..." -ForegroundColor $InfoColor
try {
    $testCmd = @("-p", $Port)
    if ($KeyPath) { $testCmd += @("-i", $KeyPath) }
    $testCmd += @("${User}@${Host}", "echo", "Connection successful")
    
    $null = ssh @testCmd 2>&1
    Write-Host "✓ SSH connection OK`n" -ForegroundColor $SuccessColor
} catch {
    Write-Host "❌ Cannot connect to server" -ForegroundColor $ErrorColor
    Write-Host "Please check:" -ForegroundColor $InfoColor
    Write-Host "  - Server IP/hostname is correct"
    Write-Host "  - SSH port is correct"
    Write-Host "  - SSH key is valid (if used)"
    Write-Host "  - User has access to the server"
    exit 1
}

# Get current version from server
Write-Host "Getting current version..." -ForegroundColor $InfoColor
$currentVersionCmd = @($sshArgs) + @("cat ${APP_DIR}/VERSION 2>/dev/null || echo unknown")
$currentVersion = (ssh @currentVersionCmd).Trim()
Write-Host "Current version: $currentVersion`n" -ForegroundColor $SuccessColor

# Get latest version from GitHub
Write-Host "Checking latest version on GitHub..." -ForegroundColor $InfoColor
try {
    $gitTags = git ls-remote --tags https://github.com/adiprayitno160-svg/billing.git 2>$null | 
        Select-String 'refs/tags/v(\d+\.\d+\.\d+)$' |
        ForEach-Object { $_.Matches.Groups[1].Value } |
        Sort-Object { [version]$_ } |
        Select-Object -Last 1
    
    if (-not $gitTags) {
        throw "No version tags found"
    }
    
    $latestVersion = $gitTags
    Write-Host "Latest version: $latestVersion`n" -ForegroundColor $SuccessColor
} catch {
    Write-Host "❌ Cannot fetch latest version from GitHub" -ForegroundColor $ErrorColor
    Write-Host "Error: $_" -ForegroundColor $ErrorColor
    exit 1
}

# Check if update needed
if ($currentVersion -eq $latestVersion -and -not $Force) {
    Write-Host "✅ Server is already on the latest version!" -ForegroundColor $SuccessColor
    exit 0
}

# Confirm update
if (-not $Force) {
    Write-Host "⚠️  This will update the server from $currentVersion to $latestVersion" -ForegroundColor $InfoColor
    Write-Host "The application will be restarted.`n" -ForegroundColor $InfoColor
    $confirmation = Read-Host "Continue? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Host "Update cancelled" -ForegroundColor $InfoColor
        exit 0
    }
}

Write-Host "`nStarting remote update...`n" -ForegroundColor $BlueColor

# Upload update script
Write-Host "📤 Uploading update script..." -ForegroundColor $InfoColor
$scpArgs = @("-P", $Port)
if ($KeyPath) { $scpArgs += @("-i", $KeyPath) }
$scpArgs += @("update.sh", "${User}@${Host}:${APP_DIR}/")

try {
    scp @scpArgs 2>&1 | Out-Null
    Write-Host "✓ Update script uploaded`n" -ForegroundColor $SuccessColor
} catch {
    Write-Host "❌ Failed to upload update script" -ForegroundColor $ErrorColor
    exit 1
}

# Run update on server
Write-Host "🚀 Running update on server..." -ForegroundColor $InfoColor
Write-Host "----------------------------------------`n" -ForegroundColor $BlueColor

$updateCmd = @($sshArgs) + @("cd ${APP_DIR} && chmod +x update.sh && ./update.sh")
ssh @updateCmd

Write-Host "`n----------------------------------------" -ForegroundColor $BlueColor
Write-Host "✅ Remote update completed!`n" -ForegroundColor $SuccessColor

# Get new version
$newVersionCmd = @($sshArgs) + @("cat ${APP_DIR}/VERSION 2>/dev/null || echo unknown")
$newVersion = (ssh @newVersionCmd).Trim()
Write-Host "Server updated to version: $newVersion`n" -ForegroundColor $SuccessColor

# Check application status
Write-Host "Checking application status..." -ForegroundColor $InfoColor
$statusCmd = @($sshArgs) + @("pm2 list | grep -E 'billing-app|App name' || pm2 list")
ssh @statusCmd

Write-Host "`n✅ Update completed successfully!" -ForegroundColor $SuccessColor

exit 0

