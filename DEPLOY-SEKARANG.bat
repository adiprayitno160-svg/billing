@echo off
chcp 65001 >nul
color 0A
cls

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  🚀 DEPLOY SEKARANG - SIMPLE IMPORT EXCEL                    ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Default values - EDIT INI SESUAI SERVER ANDA!
set SERVER_USER=root
set SERVER_IP=103.127.132.64
set PROJECT_PATH=/opt/billing

echo 📋 Server Info:
echo    User: %SERVER_USER%
echo    IP: %SERVER_IP%
echo    Path: %PROJECT_PATH%
echo.

set /p CONFIRM="Deploy ke server ini? (Y/n): "
if /i "%CONFIRM%"=="n" goto END

echo.
echo 🔄 DEPLOYING...
echo.

ssh %SERVER_USER%@%SERVER_IP% "cd %PROJECT_PATH% && echo '🔄 Git pull...' && git pull origin main && echo '🔨 Build...' && npm run build && echo '🔄 Restart PM2...' && pm2 restart billing-app && echo '✅ DONE!' && pm2 list"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔═══════════════════════════════════════════════════════════════╗
    echo ║  ✅ DEPLOY SUCCESS!                                          ║
    echo ╚═══════════════════════════════════════════════════════════════╝
    echo.
    echo 🌐 Test: http://%SERVER_IP%/customers/list
    echo.
) else (
    echo.
    echo ❌ DEPLOY FAILED!
    echo.
)

:END
pause

