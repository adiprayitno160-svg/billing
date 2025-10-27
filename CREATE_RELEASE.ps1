# Quick Release Script - Run this in your authenticated PowerShell
cd C:\laragon\www\billing

Write-Host "`nCreating GitHub Release v2.0.1..." -ForegroundColor Green

gh release create v2.0.1 `
    --title "Release v2.0.1 - Dashboard Improvements" `
    --notes-file RELEASE_NOTES_v2.0.1.md `
    --latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Release v2.0.1 berhasil dibuat!" -ForegroundColor Green
    Write-Host "🔗 https://github.com/adiprayitno160-svg/billing/releases/tag/v2.0.1" -ForegroundColor Cyan
    Write-Host "`n📢 User sekarang bisa:" -ForegroundColor Yellow
    Write-Host "   1. Download dari GitHub Releases" -ForegroundColor White
    Write-Host "   2. Auto-update dari About page di aplikasi" -ForegroundColor White
} else {
    Write-Host "`n❌ Error creating release" -ForegroundColor Red
}

