# Skrip Migrasi Tabel Baru untuk Database Billing

## Pendekatan Update Tabel Database Baru

Skrip ini digunakan untuk menambahkan tabel-tabel baru ke database billing yang sudah berjalan, tanpa mengganti seluruh database.

### 1. Identifikasi Tabel-Tabel Baru
Berikut adalah tabel-tabel yang mungkin perlu ditambahkan berdasarkan fitur-fitur terbaru:

#### Tabel Monitoring dan Notifikasi
```sql
-- Tabel untuk menyimpan log notifikasi dua jam
CREATE TABLE IF NOT EXISTS two_hour_notification_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    notification_type ENUM('offline', 'recovery') NOT NULL,
    ticket_number VARCHAR(50),
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_sent_at (sent_at),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Tabel untuk melacak durasi offline pelanggan
CREATE TABLE IF NOT EXISTS customer_offline_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    duration_minutes INT DEFAULT 0,
    status ENUM('offline', 'online') DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

#### Tabel untuk Map Monitoring Modern
```sql
-- Tabel untuk menyimpan konfigurasi map monitoring
CREATE TABLE IF NOT EXISTS monitoring_map_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk menyimpan lokasi pelanggan untuk map
CREATE TABLE IF NOT EXISTS customer_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    location_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_coordinates (latitude, longitude),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

### 2. Skrip Migrasi Utama
File: `migrate_new_tables.sql`

```sql
-- Migration Script: Add new tables for enhanced monitoring features
-- This script adds new tables without affecting existing data

-- 1. Create two hour notification logs table
CREATE TABLE IF NOT EXISTS two_hour_notification_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    notification_type ENUM('offline', 'recovery') NOT NULL,
    ticket_number VARCHAR(50),
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_sent_at (sent_at),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 2. Create customer offline tracking table
CREATE TABLE IF NOT EXISTS customer_offline_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    duration_minutes INT DEFAULT 0,
    status ENUM('offline', 'online') DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 3. Create monitoring map configuration table
CREATE TABLE IF NOT EXISTS monitoring_map_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Create customer locations table
CREATE TABLE IF NOT EXISTS customer_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    location_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_coordinates (latitude, longitude),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 5. Insert default configuration values
INSERT IGNORE INTO monitoring_map_config (config_key, config_value, description) VALUES
('map_center_lat', '-6.2088', 'Default map center latitude'),
('map_center_lng', '106.8456', 'Default map center longitude'),
('map_zoom_level', '12', 'Default zoom level for monitoring map'),
('show_offline_customers', 'true', 'Show offline customers on map'),
('refresh_interval', '30', 'Refresh interval in seconds for map updates');

-- 6. Add columns to existing tables if needed
-- Add coordinates to customers table if not exists
SET @col_exists = 0;
SELECT 1 INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'customers' 
AND COLUMN_NAME = 'latitude';

SET @sql_stmt = IF(@col_exists = 0, 
    'ALTER TABLE customers ADD COLUMN latitude DECIMAL(10, 8) NULL AFTER address, ADD COLUMN longitude DECIMAL(11, 8) NULL AFTER latitude', 
    'SELECT "Column already exists" as Message');

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add monitoring related columns to customers if not exists
SET @col_exists = 0;
SELECT 1 INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'customers' 
AND COLUMN_NAME = 'last_online';

SET @sql_stmt = IF(@col_exists = 0, 
    'ALTER TABLE customers ADD COLUMN last_online TIMESTAMP NULL, ADD COLUMN is_online BOOLEAN DEFAULT TRUE', 
    'SELECT "Column already exists" as Message');

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

### 3. Skrip Eksekusi Migrasi
File: `run-migration.bat`

```batch
@echo off
setlocal enabledelayedexpansion

:: ==========================================
:: SCRIPT MIGRASI TABEL BARU KE DATABASE PRODUKSI
:: ==========================================

echo ==========================================
echo   MIGRASI TABEL BARU KE DATABASE PRODUKSI
echo ==========================================

:: Konfigurasi (sesuaikan dengan .env Anda)
set DB_HOST=localhost
set DB_USER=root
set DB_PASSWORD=
set DB_NAME=billing
set MIGRATION_SCRIPT=migrate_new_tables.sql

echo Database: %DB_NAME%
echo Migration Script: %MIGRATION_SCRIPT%
echo.

:: Cari executable mysql
set MYSQL_PATH=

:: Cek path MySQL di Laragon
if exist "C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe" (
    set MYSQL_PATH=C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe
) else if exist "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" (
    set MYSQL_PATH=C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe
) else (
    set MYSQL_PATH=mysql
)

echo Menggunakan MySQL: %MYSQL_PATH%
echo.

:: Buat backup sebelum migrasi
echo Membuat backup sebelum migrasi...
set TIMESTAMP=%date:~6,4%-%date:~3,2%-%date:~0,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set BACKUP_FILE=backup_before_migration_%TIMESTAMP%.sql

if defined DB_PASSWORD (
    "%MYSQL_PATH%" -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% --single-transaction %DB_NAME% > "%BACKUP_FILE%"
) else (
    "%MYSQL_PATH%" -h %DB_HOST% -u %DB_USER% --single-transaction %DB_NAME% > "%BACKUP_FILE%"
)

if %ERRORLEVEL% equ 0 (
    echo Backup berhasil: %BACKUP_FILE%
    echo.
    
    :: Eksekusi migrasi
    echo Menjalankan migrasi tabel baru...
    
    if defined DB_PASSWORD (
        "%MYSQL_PATH%" -h %DB_HOST% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < %MIGRATION_SCRIPT%
    ) else (
        "%MYSQL_PATH%" -h %DB_HOST% -u %DB_USER% %DB_NAME% < %MIGRATION_SCRIPT%
    )
    
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ==========================================
        echo   MIGRASI BERHASIL!
        echo ==========================================
        echo Tabel-tabel baru telah ditambahkan ke database.
        echo.
        echo Tabel yang ditambahkan:
        echo - two_hour_notification_logs
        echo - customer_offline_tracking
        echo - monitoring_map_config
        echo - customer_locations
        echo.
        echo Jangan lupa untuk restart aplikasi agar
        echo perubahan dapat diakses oleh sistem.
        echo.
    ) else (
        echo.
        echo ==========================================
        echo   MIGRASI GAGAL!
        echo ==========================================
        echo Terjadi kesalahan saat menjalankan migrasi.
        echo.
        echo Rollback ke backup: %BACKUP_FILE%
        echo.
    )
) else (
    echo.
    echo ==========================================
    echo   GAGAL MEMBUAT BACKUP!
    echo ==========================================
    echo Tidak dapat membuat backup sebelum migrasi.
    echo.
    pause
    exit /b 1
)

echo Tekan tombol apa saja untuk keluar...
pause
```

### 4. Skrip PowerShell (Alternatif)
File: `run-migration.ps1`

```powershell
# ==========================================
# SCRIPT MIGRASI TABEL BARU KE DATABASE PRODUKSI
# ==========================================

Write-Host "==========================================" -ForegroundColor Green
Write-Host "   MIGRASI TABEL BARU KE DATABASE PRODUKSI" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Konfigurasi (sesuaikan dengan .env Anda)
$DB_HOST = "localhost"
$DB_USER = "root"
$DB_PASSWORD = ""  # Kosongkan jika tidak ada password
$DB_NAME = "billing"
$MIGRATION_SCRIPT = "migrate_new_tables.sql"

Write-Host "Database: $DB_NAME"
Write-Host "Migration Script: $MIGRATION_SCRIPT"
Write-Host ""

# Cari executable mysql
$MYSQL_PATH = $null

# Cek path MySQL di Laragon
$laragonPaths = @(
    "C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe",
    "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe"
)

foreach ($path in $laragonPaths) {
    if (Test-Path $path) {
        $MYSQL_PATH = $path
        break
    }
}

if (!$MYSQL_PATH) {
    $MYSQL_PATH = "mysql"
}

Write-Host "Menggunakan MySQL: $MYSQL_PATH"
Write-Host ""

# Buat timestamp untuk backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_before_migration_$timestamp.sql"

# Buat backup sebelum migrasi
Write-Host "Membuat backup sebelum migrasi..." -ForegroundColor Yellow

try {
    $cmdArgs = @(
        "-h", $DB_HOST,
        "-u", $DB_USER,
        "--single-transaction",
        $DB_NAME
    )

    if ($DB_PASSWORD) {
        $cmdArgs = @("-p$DB_PASSWORD") + $cmdArgs
    }

    $process = Start-Process -FilePath $MYSQL_PATH -ArgumentList $cmdArgs -NoNewWindow -PassThru -RedirectStandardOutput $backupFile
    $process.WaitForExit()

    if ($process.ExitCode -eq 0) {
        Write-Host "Backup berhasil: $backupFile" -ForegroundColor Green
        Write-Host ""

        # Eksekusi migrasi
        Write-Host "Menjalankan migrasi tabel baru..." -ForegroundColor Yellow

        $migrationArgs = @(
            "-h", $DB_HOST,
            "-u", $DB_USER,
            $DB_NAME
        )

        if ($DB_PASSWORD) {
            $migrationArgs = @("-p$DB_PASSWORD") + $migrationArgs
        }

        $migrationProcess = Start-Process -FilePath $MYSQL_PATH -ArgumentList $migrationArgs -NoNewWindow -PassThru -RedirectStandardInput $MIGRATION_SCRIPT
        $migrationProcess.WaitForExit()

        if ($migrationProcess.ExitCode -eq 0) {
            Write-Host ""
            Write-Host "==========================================" -ForegroundColor Green
            Write-Host "   MIGRASI BERHASIL!" -ForegroundColor Green
            Write-Host "==========================================" -ForegroundColor Green
            Write-Host "Tabel-tabel baru telah ditambahkan ke database." -ForegroundColor Green
            Write-Host ""
            Write-Host "Tabel yang ditambahkan:" -ForegroundColor Cyan
            Write-Host "- two_hour_notification_logs" -ForegroundColor White
            Write-Host "- customer_offline_tracking" -ForegroundColor White
            Write-Host "- monitoring_map_config" -ForegroundColor White
            Write-Host "- customer_locations" -ForegroundColor White
            Write-Host ""
            Write-Host "Jangan lupa untuk restart aplikasi agar" -ForegroundColor Yellow
            Write-Host "perubahan dapat diakses oleh sistem." -ForegroundColor Yellow
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "==========================================" -ForegroundColor Red
            Write-Host "   MIGRASI GAGAL!" -ForegroundColor Red
            Write-Host "==========================================" -ForegroundColor Red
            Write-Host "Terjadi kesalahan saat menjalankan migrasi." -ForegroundColor Red
            Write-Host ""
            Write-Host "Rollback ke backup: $backupFile" -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Red
        Write-Host "   GAGAL MEMBUAT BACKUP!" -ForegroundColor Red
        Write-Host "==========================================" -ForegroundColor Red
        Write-Host "Tidak dapat membuat backup sebelum migrasi." -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
}

Write-Host "Tekan tombol apa saja untuk keluar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
```

### 5. Instruksi Penggunaan

1. **Persiapan**:
   - Pastikan database billing aktif dan dapat diakses
   - Backup manual database sebelum menjalankan migrasi

2. **Eksekusi**:
   - Jalankan `run-migration.bat` (untuk Windows Command Prompt)
   - Atau `run-migration.ps1` (untuk PowerShell)

3. **Verifikasi**:
   - Cek apakah tabel-tabel baru telah dibuat
   - Test koneksi aplikasi ke database

Skrip ini akan menambahkan tabel-tabel baru untuk fitur monitoring yang telah kita buat sebelumnya tanpa mengganti seluruh database yang sudah ada.