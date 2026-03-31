@echo off
TITLE Billing System Auto Update

echo ========================================================
echo    STARTING UPDATE PROCCESS - BILLING SYSTEM (WINDOWS)
echo ========================================================

:: 1. Pull latest changes
echo.
echo [1/5] Pulling changes from repository...
git pull origin main

:: 2. Install dependencies
echo.
echo [2/5] Installing new dependencies...
call npm install

:: 3. Build application
echo.
echo [3/5] Building application (TypeScript)...
call npm run build

:: 4. Build CSS
echo.
echo [4/5] Building TailwindCSS...
call npm run css:build

:: 5. Restart PM2 (if installed globally on Windows, or use node directly)
echo.
echo [5/5] Restarting Background Process...

:: Optional: Restart PM2 if you use it on Windows
call pm2 reload billing-app 2>NUL
if %ERRORLEVEL% NEQ 0 (
    echo PM2 process not found or PM2 not installed. 
    echo Please ensure your server is running.
) else (
    echo PM2 Reloaded successfully.
)

echo.
echo ========================================================
echo    UPDATE COMPLETED SUCCESSFULLY! 🚀
echo ========================================================
pause
