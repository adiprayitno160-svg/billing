@echo off
cls
echo ========================================
echo   PREPAID SYSTEM - COMPILE ^& RESTART
echo ========================================
echo.

echo [1/4] Stopping existing Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/4] Navigating to project directory...
cd /d C:\laragon\www\billing

echo.
echo [3/4] Compiling TypeScript...
call C:\laragon\bin\nodejs\node-v22\npm.cmd run build
if errorlevel 1 (
    echo.
    echo ❌ Compilation FAILED! Check errors above.
    pause
    exit /b 1
)

echo.
echo [4/4] Starting development server...
start "Billing Server - Prepaid System" cmd /k "cd /d C:\laragon\www\billing && C:\laragon\bin\nodejs\node-v22\npm.cmd run dev"

echo.
echo ========================================
echo ✅ Server starting in new window...
echo ========================================
echo.
echo 📋 Access URLs:
echo    - Main Dashboard: http://localhost:3001
echo    - Prepaid Admin:  http://localhost:3001/prepaid/dashboard
echo    - Prepaid Portal: http://localhost:3001/prepaid/portal/login
echo.
echo 📚 Documentation:
echo    - Full Guide: PREPAID_SYSTEM_COMPLETE.md
echo    - Quick Start: PREPAID_QUICK_START.md
echo.
timeout /t 5
exit
