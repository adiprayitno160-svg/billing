@echo off
chcp 65001 >nul
color 0A
cls

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  🚀 DEPLOY v2.0.9 ke 192.168.239.126                         ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo 📋 Deploying:
echo    - Server: root@192.168.239.126
echo    - Version: 2.0.9 (Simple Import Excel)
echo    - Path: /opt/billing
echo.

pause

echo.
echo 🔄 Deploying...
echo.

ssh root@192.168.239.126 "cd /opt/billing && echo '1️⃣ Git pull...' && git pull origin main && echo '' && echo '2️⃣ NPM build...' && npm run build && echo '' && echo '3️⃣ PM2 restart...' && pm2 restart billing-app && echo '' && echo '✅ DEPLOYMENT SUCCESS!' && echo '' && pm2 list"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔═══════════════════════════════════════════════════════════════╗
    echo ║  ✅ DEPLOY SUCCESS!                                          ║
    echo ╚═══════════════════════════════════════════════════════════════╝
    echo.
    echo 🎉 v2.0.9 sudah aktif!
    echo.
    echo 📋 Test Import:
    echo    1. Buka: http://192.168.239.126/customers/list
    echo    2. Klik "📥 Import Excel"
    echo    3. Upload Excel dengan 3 kolom: Nama, Telepon, Alamat
    echo.
    echo 📖 Monitor log:
    echo    ssh root@192.168.239.126 "pm2 logs billing-app --lines 20"
    echo.
    
    set /p OPEN="Buka browser untuk test? (Y/n): "
    if /i not "%OPEN%"=="n" start http://192.168.239.126/customers/list
) else (
    echo.
    echo ╔═══════════════════════════════════════════════════════════════╗
    echo ║  ❌ DEPLOY FAILED!                                           ║
    echo ╚═══════════════════════════════════════════════════════════════╝
    echo.
    echo 🔧 Coba manual:
    echo    ssh root@192.168.239.126
    echo    cd /opt/billing
    echo    git pull origin main
    echo    npm run build
    echo    pm2 restart billing-app
    echo.
)

pause

