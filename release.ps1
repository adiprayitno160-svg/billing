# Auto Release Script untuk Billing System (PowerShell)
# Usage: .\release.ps1 [major|minor|patch] "Release message"

param(
    [ValidateSet('major', 'minor', 'patch')]
    [string]$VersionType = 'patch',
    [string]$ReleaseMessage = 'Bug fixes and improvements'
)

$ErrorActionPreference = 'Stop'

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Check if gh CLI is installed
try {
    gh --version | Out-Null
} catch {
    Write-ColorOutput Red "Error: GitHub CLI (gh) tidak terinstall!"
    Write-Output "Download dari: https://cli.github.com/"
    exit 1
}

# Check if logged in to gh
try {
    gh auth status 2>&1 | Out-Null
} catch {
    Write-ColorOutput Red "Error: Belum login ke GitHub CLI!"
    Write-Output "Jalankan: gh auth login"
    exit 1
}

Write-ColorOutput Green "🚀 Starting Auto Release Process...`n"

# Get current version from package.json
$packageJson = Get-Content package.json | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-ColorOutput Yellow "Current version: $currentVersion"

# Calculate new version
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

switch ($VersionType) {
    'major' {
        $major++
        $minor = 0
        $patch = 0
    }
    'minor' {
        $minor++
        $patch = 0
    }
    'patch' {
        $patch++
    }
}

$newVersion = "$major.$minor.$patch"
Write-ColorOutput Green "New version: $newVersion`n"

# Update package.json
Write-ColorOutput Yellow "📝 Updating package.json..."
npm version $newVersion --no-git-tag-version

# Update VERSION file
$newVersion | Out-File -FilePath VERSION -Encoding utf8 -NoNewline
Write-ColorOutput Green "✓ VERSION file updated"

# Commit changes
Write-Output "`n"
Write-ColorOutput Yellow "📦 Committing changes..."
git add package.json package-lock.json VERSION
git commit -m "Release v$newVersion"

# Create git tag
Write-ColorOutput Yellow "🏷️  Creating git tag v$newVersion..."
git tag -a "v$newVersion" -m "Release v${newVersion}: $ReleaseMessage"

# Push to GitHub
Write-ColorOutput Yellow "⬆️  Pushing to GitHub..."
git push origin main
git push origin "v$newVersion"

Write-ColorOutput Green "✓ Pushed to GitHub"

# Get recent commits for changelog
Write-Output "`n"
Write-ColorOutput Yellow "📋 Generating changelog..."

$lastTag = git describe --tags --abbrev=0 HEAD^ 2>$null
if ($lastTag) {
    $changelog = git log --pretty=format:"- %s" "$lastTag..HEAD"
} else {
    $changelog = git log --pretty=format:"- %s" -10
}

# Create GitHub Release
Write-ColorOutput Yellow "🎉 Creating GitHub Release..."

$releaseNotes = @"
## Version $newVersion

$ReleaseMessage

### Changes:
$changelog

### Installation:
``````bash
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-app
``````

### Auto-Update:
Buka halaman About di aplikasi, lalu klik "Check for Updates" → "Update Now"
"@

gh release create "v$newVersion" `
    --title "Release v$newVersion" `
    --notes $releaseNotes `
    --latest

Write-Output "`n"
Write-ColorOutput Green "✅ Release v$newVersion berhasil dibuat!"
Write-ColorOutput Green "🔗 https://github.com/adiprayitno160-svg/billing/releases/tag/v$newVersion"
Write-Output "`n"
Write-ColorOutput Yellow "📢 Sekarang user bisa update dengan:"
Write-Output "   1. Buka About page di aplikasi"
Write-Output "   2. Klik 'Check for Updates'"
Write-Output "   3. Klik 'Update Now'"

