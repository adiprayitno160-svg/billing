# Quick Release Script untuk v2.1.4
# Usage: .\release-v2.1.4.ps1

$ErrorActionPreference = "Stop"

# Colors
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"
$WarningColor = "Yellow"

Write-Host "`n🚀 Starting Release v2.1.4...`n" -ForegroundColor $SuccessColor

# Check if gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: GitHub CLI (gh) tidak terinstall!" -ForegroundColor $ErrorColor
    Write-Host "📥 Install dari: https://cli.github.com/" -ForegroundColor $InfoColor
    exit 1
}

# Check if logged in to gh
try {
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Belum login ke GitHub CLI!" -ForegroundColor $ErrorColor
        Write-Host "🔐 Jalankan: gh auth login" -ForegroundColor $InfoColor
        exit 1
    }
} catch {
    Write-Host "❌ Error: Belum login ke GitHub CLI!" -ForegroundColor $ErrorColor
    Write-Host "🔐 Jalankan: gh auth login" -ForegroundColor $InfoColor
    exit 1
}

Write-Host "✅ GitHub CLI ready`n" -ForegroundColor $SuccessColor

# Version
$version = "2.1.4"

# Check if working directory is clean
Write-Host "📋 Checking git status..." -ForegroundColor $InfoColor
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "`n⚠️  You have uncommitted changes:" -ForegroundColor $WarningColor
    Write-Host $gitStatus -ForegroundColor $WarningColor
    Write-Host "`nCommit these changes? (y/n): " -NoNewline -ForegroundColor $InfoColor
    $commit = Read-Host
    
    if ($commit -eq 'y' -or $commit -eq 'Y') {
        Write-Host "`n📦 Staging all changes..." -ForegroundColor $InfoColor
        git add .
        
        Write-Host "💬 Commit message: " -NoNewline -ForegroundColor $InfoColor
        $commitMsg = Read-Host
        if ([string]::IsNullOrWhiteSpace($commitMsg)) {
            $commitMsg = "Release v$version - Multiple improvements"
        }
        
        git commit -m "$commitMsg"
        Write-Host "✅ Changes committed`n" -ForegroundColor $SuccessColor
    } else {
        Write-Host "`n⚠️  Continuing without committing...`n" -ForegroundColor $WarningColor
    }
}

# Create git tag if not exists
Write-Host "🏷️  Checking for existing tag..." -ForegroundColor $InfoColor
$tagExists = git tag -l "v$version"
if ($tagExists) {
    Write-Host "⚠️  Tag v$version already exists. Delete and recreate? (y/n): " -NoNewline -ForegroundColor $WarningColor
    $recreate = Read-Host
    if ($recreate -eq 'y' -or $recreate -eq 'Y') {
        git tag -d "v$version"
        git push origin ":refs/tags/v$version" 2>$null
        Write-Host "✅ Old tag deleted`n" -ForegroundColor $SuccessColor
    } else {
        Write-Host "`n❌ Aborting release...`n" -ForegroundColor $ErrorColor
        exit 1
    }
}

# Create new tag
Write-Host "🏷️  Creating git tag v$version..." -ForegroundColor $InfoColor
git tag -a "v$version" -m "Release v$version: UI/UX improvements and bug fixes"
Write-Host "✅ Tag created`n" -ForegroundColor $SuccessColor

# Push to GitHub
Write-Host "⬆️  Push to GitHub? (y/n): " -NoNewline -ForegroundColor $InfoColor
$push = Read-Host
if ($push -eq 'y' -or $push -eq 'Y') {
    Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor $InfoColor
    git push origin main
    git push origin "v$version"
    Write-Host "✅ Pushed to GitHub`n" -ForegroundColor $SuccessColor
} else {
    Write-Host "⚠️  Skipping push. You can push manually later with:" -ForegroundColor $WarningColor
    Write-Host "   git push origin main" -ForegroundColor White
    Write-Host "   git push origin v$version`n" -ForegroundColor White
}

# Release Notes
$releaseNotes = @"
## 🎉 Version 2.1.4

Rilis ini fokus pada perbaikan sistem update, konsistensi UI, dan peningkatan WhatsApp bot.

### ✨ Fitur Baru & Perbaikan

#### 🔄 Sistem Update
- **Fix Update Redirect**: Setelah update selesai, tidak lagi menampilkan "unable to connect"
- **Auto-redirect ke About**: User otomatis diarahkan ke halaman About setelah update berhasil
- **Visual Progress**: Loading indicator dengan step-by-step progress (✅ checkmarks)
- **Real-time Status**: Update status langsung terlihat saat proses berlangsung
- **Success Notification**: Notifikasi hijau muncul setelah redirect berhasil
- **Smart Timeout Handling**: Fallback handling jika server butuh waktu lebih lama

#### 🎨 UI/UX Improvements
- **Fix Header Double**: Perbaikan header ganda pada halaman billing
  - Riwayat Tagihan (tagihan.ejs)
  - Pelacakan Hutang (debt-tracking.ejs)
  - Billing Report (reports.ejs)
- **Real-time Clock**: Jam digital di header kanan atas dengan format HH:MM:SS
- **Layout About Page**: Changelog (2 kolom) dan Update Terbaru (1 kolom kanan)
- **Konsistensi Layout**: Semua halaman billing menggunakan layout yang sama

#### 📱 WhatsApp Bot Enhancements
- **Filter Status WhatsApp**: Bot tidak merespon status/story WhatsApp (status@broadcast)
- **Filter Pesan Grup**: Bot tidak merespon pesan di grup WhatsApp (@g.us)
- **Filter Self Message**: Bot tidak membalas pesan dari dirinya sendiri
- **Better Message Handling**: Penanganan pesan yang lebih baik dan akurat

### 📦 Perubahan File
- \`VERSION\` → 2.1.4
- \`VERSION_MAJOR\` → 2.1.4
- \`VERSION_HOTFIX\` → 2.1.4
- \`package.json\` → 2.1.4
- \`src/services/whatsapp/WhatsAppWebService.ts\` - WhatsApp bot filters
- \`views/about/index.ejs\` - Update system improvements
- \`views/billing/*.ejs\` - Layout consistency fixes
- \`views/partials/header.ejs\` - Real-time clock

### 🚀 Cara Update

#### Via Auto-Update (Recommended):
1. Login ke aplikasi billing
2. Buka menu **Tentang Aplikasi** (About)
3. Klik tombol **"Cek Update"**
4. Klik **"Update Sekarang"**
5. Tunggu hingga proses selesai (1-2 menit)
6. Aplikasi akan otomatis refresh ke halaman About
7. Notifikasi hijau akan muncul jika berhasil

#### Via Manual Update:
``````bash
cd /opt/billing  # atau path instalasi Anda
git fetch origin
git checkout v2.1.4
npm install
npm run build
pm2 restart billing-app
``````

#### Via Git Pull:
``````bash
cd /opt/billing
git pull origin main
npm install
npm run build
pm2 restart billing-app
``````

### 🐛 Bug Fixes
- Fixed: Unable to connect setelah update
- Fixed: Header ganda pada halaman billing
- Fixed: WhatsApp bot merespon status WhatsApp
- Fixed: WhatsApp bot merespon pesan grup
- Fixed: Layout tidak konsisten antar halaman

### 📝 Technical Details
- Improved update flow dengan checkServerAndRedirect()
- Enhanced loading indicator dengan step completion
- URL parameter handling untuk success/timeout notification
- Visual feedback untuk setiap tahap update process
- Better error handling dan fallback mechanism

### 🔗 Links
- **Repository**: https://github.com/adiprayitno160-svg/billing
- **Issues**: https://github.com/adiprayitno160-svg/billing/issues
- **Documentation**: Check /docs folder in repository

### ⚠️ Breaking Changes
Tidak ada breaking changes pada rilis ini.

### 📸 Preview
- ✅ Update system dengan progress indicator
- ✅ Success notification setelah update
- ✅ Real-time clock di header
- ✅ Konsisten layout billing pages

---

**Full Changelog**: https://github.com/adiprayitno160-svg/billing/compare/v2.1.3...v2.1.4
"@

# Create GitHub Release
Write-Host "🎉 Creating GitHub Release v$version..." -ForegroundColor $InfoColor
try {
    gh release create "v$version" --title "Release v$version - Update System & UI Improvements" --notes $releaseNotes --latest
    
    Write-Host "`n✅ Release v$version berhasil dibuat!" -ForegroundColor $SuccessColor
    Write-Host "🔗 https://github.com/adiprayitno160-svg/billing/releases/tag/v$version`n" -ForegroundColor $SuccessColor
    
    Write-Host "📢 Users sekarang bisa update dengan:" -ForegroundColor $InfoColor
    Write-Host "   1. Buka halaman About di aplikasi" -ForegroundColor White
    Write-Host "   2. Klik 'Cek Update'" -ForegroundColor White
    Write-Host "   3. Klik 'Update Sekarang'" -ForegroundColor White
    Write-Host "   4. Tunggu hingga redirect otomatis ke About" -ForegroundColor White
    Write-Host "   5. Lihat notifikasi hijau 'Update Berhasil!'`n" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ Error creating release: $_" -ForegroundColor $ErrorColor
    Write-Host "`nYou can create it manually with:" -ForegroundColor $InfoColor
    Write-Host "gh release create v$version --title 'Release v$version' --notes-file RELEASE_NOTES.md --latest`n" -ForegroundColor White
    exit 1
}

Write-Host "🎊 Done!`n" -ForegroundColor $SuccessColor

