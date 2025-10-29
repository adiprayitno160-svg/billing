========================================
CARA DEPLOY v2.0.4 - SUPER MUDAH!
========================================

TINGGAL 1 LANGKAH:

1. Double-click file: GO.bat

   Atau di PowerShell ketik:
   .\GO.bat

SELESAI!

Script akan otomatis:
- Commit code
- Push ke GitHub  
- Deploy ke production (192.168.239.126)
- Restart server
- Test API

========================================

Setelah selesai:

1. Buka browser: http://192.168.239.126:3000

2. Press CTRL+F5 (hard refresh)

3. Check:
   - Footer shows: v2.0.4 ✓
   - Traffic chart works ✓
   - No 404 errors ✓

========================================

TROUBLESHOOTING:

Jika masih error 404:
- Tunggu 10 detik
- Refresh lagi (CTRL+F5)
- Clear cache browser

Jika SSH error:
- Edit file GO.bat
- Ganti "adi" dengan username SSH Anda
- Ganti "/var/www/billing" dengan path project Anda

========================================

FILE PENTING:

GO.bat                    <- JALANKAN INI!
verify-and-redeploy.bat   <- Jika GO.bat gagal
test-production.bat       <- Test saja (tanpa deploy)
quick-release.bat         <- Push ke GitHub saja
deploy-now.bat            <- Deploy saja (interactive)

========================================

SELAMAT DEPLOY! 🚀

