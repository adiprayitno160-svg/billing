@echo off
echo ========================================
echo   RESTART BILLING SERVER
echo ========================================
echo.

REM Kill existing node processes
echo [1/3] Menghentikan server yang berjalan...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Kompilasi TypeScript...
cd /d "%~dp0"

REM Try to find npm in common Laragon paths
SET NPM_PATH=
if exist "C:\laragon\bin\nodejs\node-v20\npm.cmd" SET NPM_PATH=C:\laragon\bin\nodejs\node-v20\npm.cmd
if exist "C:\laragon\bin\nodejs\node-v18\npm.cmd" SET NPM_PATH=C:\laragon\bin\nodejs\node-v18\npm.cmd
if exist "C:\laragon\bin\nodejs\node-v16\npm.cmd" SET NPM_PATH=C:\laragon\bin\nodejs\node-v16\npm.cmd
if exist "C:\laragon\bin\nodejs\npm.cmd" SET NPM_PATH=C:\laragon\bin\nodejs\npm.cmd

if "%NPM_PATH%"=="" (
    echo ERROR: npm tidak ditemukan di Laragon!
    echo Silakan jalankan server dari Laragon Terminal
    pause
    exit /b 1
)

echo Menggunakan: %NPM_PATH%
call "%NPM_PATH%" run build

echo [3/3] Memulai server...
start "Billing Server" cmd /k "cd /d "%~dp0" && call "%NPM_PATH%" run dev"

echo.
echo ========================================
echo   SERVER BERHASIL DIRESTART!
echo ========================================
echo.
echo Jendela baru akan terbuka dengan server yang berjalan.
echo.
echo LANGKAH SELANJUTNYA:
echo 1. Tunggu hingga server selesai loading
echo 2. Buka file: fix-sla-database.html
echo 3. Klik tombol "Perbaiki Database Sekarang"
echo.
pause
