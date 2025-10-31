@echo off
REM Script untuk backup semua file aplikasi dan database dalam 1 file ZIP (Windows)
REM Usage: backup-all.bat

setlocal enabledelayedexpansion

set APP_PATH=%~dp0
set BACKUP_DIR=%APP_PATH%backups
set TIMESTAMP=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_NAME=billing-backup-%TIMESTAMP%
set TEMP_DIR=%BACKUP_DIR%\%BACKUP_NAME%

echo.
echo ========================================
echo   BILLING SYSTEM - FULL BACKUP
echo ========================================
echo.

REM Buat direktori backup jika belum ada
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
if not exist "%TEMP_DIR%\files" mkdir "%TEMP_DIR%\files"

echo [1/5] Backing up database...
REM Backup database (perlu disesuaikan dengan konfigurasi MySQL Anda)
set DB_USER=billing_user
set DB_NAME=billing
set DB_PASSWORD=

REM Coba backup database
"C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqldump.exe" -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% > "%TEMP_DIR%\database.sql" 2>nul
if errorlevel 1 (
    echo    Warning: Database backup might need password
    echo    Please run manually: mysqldump -u %DB_USER% -p %DB_NAME% ^> "%TEMP_DIR%\database.sql"
)

if exist "%TEMP_DIR%\database.sql" (
    echo    Database backup created
) else (
    echo    Warning: Database backup file not created
)
echo.

echo [2/5] Backing up application files...
echo    (This may take a while...)

REM Backup files dengan xcopy (exclude certain directories)
xcopy "%APP_PATH%*" "%TEMP_DIR%\files\" /E /I /H /Y /EXCLUDE:backup-exclude.txt 2>nul

REM Buat exclude list jika belum ada
if not exist "backup-exclude.txt" (
    (
        echo node_modules
        echo dist
        echo backups
        echo .git
        echo logs
        echo uploads
        echo whatsapp-session
        echo *.log
    ) > backup-exclude.txt
)

echo    Application files copied
echo.

echo [3/5] Backing up .env file...
if exist "%APP_PATH%.env" (
    copy "%APP_PATH%.env" "%TEMP_DIR%\.env.backup" >nul 2>&1
    echo    .env file backed up
) else (
    echo    .env file not found (skipped)
)
echo.

echo [4/5] Creating backup info file...
(
    echo Backup Information
    echo ==================
    echo Date: %date% %time%
    echo Timestamp: %TIMESTAMP%
    echo Backup Name: %BACKUP_NAME%
    echo.
    echo Application Path: %APP_PATH%
    echo Database: %DB_NAME%
    echo.
    echo Files Included:
    echo - Application source code
    echo - Configuration files
    echo - Database dump
    echo.
    echo Restore Instructions:
    echo 1. Extract this ZIP file
    echo 2. Restore database: mysql -u %DB_USER% -p %DB_NAME% ^< database.sql
    echo 3. Copy files to application directory
    echo 4. Run: npm install
    echo 5. Run: npm run build
    echo 6. Restore .env if needed
) > "%TEMP_DIR%\backup-info.txt"

echo    Backup info created
echo.

echo [5/5] Creating ZIP archive...
REM Gunakan PowerShell untuk create ZIP (built-in Windows)
powershell -command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%BACKUP_DIR%\%BACKUP_NAME%.zip' -Force" 2>nul

if exist "%BACKUP_DIR%\%BACKUP_NAME%.zip" (
    echo    ZIP archive created successfully
    echo.
    echo ========================================
    echo   BACKUP COMPLETED SUCCESSFULLY
    echo ========================================
    echo.
    echo Backup file: %BACKUP_DIR%\%BACKUP_NAME%.zip
    echo.
    
    REM Show file size
    for %%A in ("%BACKUP_DIR%\%BACKUP_NAME%.zip") do echo Size: %%~zA bytes
    
    REM Cleanup temp directory
    rmdir /S /Q "%TEMP_DIR%" 2>nul
    
    echo.
    echo Recent backups:
    dir /B /O-D "%BACKUP_DIR%\*.zip" | more
) else (
    echo    Error: ZIP archive creation failed!
    echo    Temp files kept in: %TEMP_DIR%
    exit /b 1
)

echo.
pause

