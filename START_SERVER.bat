@echo off
cls
echo ========================================
echo   WhatsApp Billing System Server
echo ========================================
echo.

REM Set Node.js path
set PATH=C:\laragon\bin\nodejs\node-v22;%PATH%

REM Change to project directory
cd /d "%~dp0"

REM Kill any existing node processes
echo [*] Stopping existing node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

cls
echo ========================================
echo   WhatsApp Billing System Server
echo ========================================
echo.
echo [OK] Starting server...
echo.
echo Server will be available at:
echo   http://localhost:3000
echo.
echo WhatsApp Binding page:
echo   http://localhost:3000/whatsapp/binding
echo.
echo -----------------------------------------
echo IMPORTANT: First time QR generation
echo takes 30-60 seconds. Please be patient!
echo -----------------------------------------
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start server
npm run dev

pause

