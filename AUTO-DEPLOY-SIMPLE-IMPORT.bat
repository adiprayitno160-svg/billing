@echo off
chcp 65001 >nul
color 0A
cls

echo ╔═══════════════════════════════════════════════════════════════════════════╗
echo ║  🚀 AUTO DEPLOY - SIMPLE IMPORT EXCEL (3 KOLOM)                          ║
echo ╚═══════════════════════════════════════════════════════════════════════════╝
echo.

REM Get SSH connection details from user
set /p SERVER_USER="👤 Server username (contoh: root): "
set /p SERVER_IP="🌐 Server IP (contoh: 103.xxx.xxx.xxx): "
set /p PROJECT_PATH="📁 Project path (default: /opt/billing): "

REM Set default if empty
if "%PROJECT_PATH%"=="" set PROJECT_PATH=/opt/billing

echo.
echo ═══════════════════════════════════════════════════════════════════════════
echo 📋 Deployment Info:
echo    - Server: %SERVER_USER%@%SERVER_IP%
echo    - Path: %PROJECT_PATH%
echo    - Changes: Simple Import Excel (3 kolom)
echo ═══════════════════════════════════════════════════════════════════════════
echo.

pause

echo.
echo 🔄 Connecting to server and deploying...
echo.

REM Run deployment via SSH
ssh %SERVER_USER%@%SERVER_IP% "cd %PROJECT_PATH% && echo '1️⃣ Pulling latest changes...' && git pull origin main && echo '' && echo '2️⃣ Installing dependencies...' && npm install && echo '' && echo '3️⃣ Building TypeScript...' && npm run build && echo '' && echo '4️⃣ Restarting PM2...' && (pm2 restart billing-app 2>nul || pm2 restart billing-system 2>nul || pm2 restart billing 2>nul) && echo '' && echo '5️⃣ Checking status...' && pm2 list && echo '' && echo '✅ DEPLOYMENT COMPLETED!' && echo '' && echo 'Version:' && cat VERSION"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔═══════════════════════════════════════════════════════════════════════════╗
    echo ║  ✅ DEPLOYMENT SUCCESS!                                                   ║
    echo ╚═══════════════════════════════════════════════════════════════════════════╝
    echo.
    echo 🎉 Simple Import Excel sudah aktif!
    echo.
    echo 📋 Test Import:
    echo    1. Buat Excel dengan 3 kolom: Nama, Telepon, Alamat
    echo    2. Buka: http://%SERVER_IP%/customers/list
    echo    3. Klik: "📥 Import Excel"
    echo    4. Upload file Excel
    echo    5. Monitor log: pm2 logs billing-app
    echo.
) else (
    echo.
    echo ╔═══════════════════════════════════════════════════════════════════════════╗
    echo ║  ❌ DEPLOYMENT FAILED!                                                    ║
    echo ╚═══════════════════════════════════════════════════════════════════════════╝
    echo.
    echo 🔧 Troubleshooting:
    echo    1. Cek koneksi SSH: ssh %SERVER_USER%@%SERVER_IP%
    echo    2. Cek path project: ls %PROJECT_PATH%
    echo    3. Manual deploy: ssh %SERVER_USER%@%SERVER_IP%
    echo.
)

pause

