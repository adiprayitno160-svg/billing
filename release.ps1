# Auto Release Script untuk Billing System (PowerShell)
# Usage: .\release.ps1 [major|minor|patch] "Release message"

param(
    [string]$VersionType = "patch",
    [string]$ReleaseMessage = "Dashboard improvements: Real-time traffic monitoring with Chart.js, sidebar toggle, and UI enhancements"
)

# Colors
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Yellow"

# Check if gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "Error: GitHub CLI (gh) tidak terinstall!" -ForegroundColor $ErrorColor
    Write-Host "Install dari: https://cli.github.com/" -ForegroundColor $InfoColor
    exit 1
}

# Check if logged in to gh
try {
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Belum login ke GitHub CLI!" -ForegroundColor $ErrorColor
        Write-Host "Jalankan: gh auth login" -ForegroundColor $InfoColor
        exit 1
    }
} catch {
    Write-Host "Error: Belum login ke GitHub CLI!" -ForegroundColor $ErrorColor
    Write-Host "Jalankan: gh auth login" -ForegroundColor $InfoColor
    exit 1
}

# Validate version type
if ($VersionType -notmatch '^(major|minor|patch)$') {
    Write-Host "Error: Version type harus major, minor, atau patch" -ForegroundColor $ErrorColor
    Write-Host "Usage: .\release.ps1 [major|minor|patch] `"Release message`"" -ForegroundColor $InfoColor
    exit 1
}

Write-Host "`n🚀 Starting Auto Release Process...`n" -ForegroundColor $SuccessColor

# Get current version from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "Current version: $currentVersion" -ForegroundColor $InfoColor

# Calculate new version
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

switch ($VersionType) {
    "major" {
        $major++
        $minor = 0
        $patch = 0
    }
    "minor" {
        $minor++
        $patch = 0
    }
    "patch" {
        $patch++
    }
}

$newVersion = "$major.$minor.$patch"
Write-Host "New version: $newVersion`n" -ForegroundColor $SuccessColor

# Update package.json
Write-Host "📝 Updating package.json..." -ForegroundColor $InfoColor
npm version $newVersion --no-git-tag-version

# Update VERSION file
$newVersion | Out-File -FilePath "VERSION" -NoNewline -Encoding UTF8
Write-Host "✓ VERSION file updated" -ForegroundColor $SuccessColor

# Commit changes
Write-Host "`n📦 Committing changes..." -ForegroundColor $InfoColor
git add package.json package-lock.json VERSION views/dashboard/index.ejs
git commit -m "Release v$newVersion - Dashboard improvements"

# Create git tag
Write-Host "🏷️  Creating git tag v$newVersion..." -ForegroundColor $InfoColor
git tag -a "v$newVersion" -m "Release v${newVersion}: $ReleaseMessage"

# Push to GitHub
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor $InfoColor
git push origin main
git push origin "v$newVersion"

Write-Host "✓ Pushed to GitHub" -ForegroundColor $SuccessColor

# Get recent commits for changelog
Write-Host "`n📋 Generating changelog..." -ForegroundColor $InfoColor
$changelog = git log --pretty=format:"- %s" -10

# Create GitHub Release
Write-Host "🎉 Creating GitHub Release..." -ForegroundColor $InfoColor

$releaseNotes = @"
## Version $newVersion

$ReleaseMessage

### 🎯 Key Features in this Release:
- ✨ Real-time traffic monitoring dengan Chart.js
- 📊 Interface traffic visualization (RX/TX separate lines)
- 🎛️ Interface selector untuk multiple interfaces
- 🔄 Sidebar toggle dengan state persistence
- 📱 Responsive footer yang mengikuti sidebar
- 🎨 Modern dashboard dengan 6 KPI cards
- ⚡ Live speed display dengan color coding
- 🌈 Improved UI/UX dengan Tailwind CSS

### Changes:
$changelog

### 📦 Installation:
``````bash
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-app
``````

### 🔄 Auto-Update:
Buka halaman **About** di aplikasi, lalu klik:
1. "Check for Updates"
2. "Update Now"

### 📸 Screenshots:
- Dashboard dengan real-time traffic monitoring
- Interface speed dengan separate RX/TX lines
- Responsive sidebar toggle
"@

gh release create "v$newVersion" --title "Release v$newVersion" --notes $releaseNotes --latest

Write-Host "`n✅ Release v$newVersion berhasil dibuat!" -ForegroundColor $SuccessColor
Write-Host "🔗 https://github.com/adiprayitno160-svg/billing/releases/tag/v$newVersion" -ForegroundColor $SuccessColor
Write-Host "`n📢 Sekarang user bisa update dengan:" -ForegroundColor $InfoColor
Write-Host "   1. Buka About page di aplikasi" -ForegroundColor White
Write-Host "   2. Klik 'Check for Updates'" -ForegroundColor White
Write-Host "   3. Klik 'Update Now'" -ForegroundColor White
