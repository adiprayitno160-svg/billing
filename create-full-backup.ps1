# ==========================================
# CREATE FULL DATABASE BACKUP FOR UBUNTU SERVER
# ==========================================

Write-Host "==========================================" -ForegroundColor Green
Write-Host "   CREATING FULL DATABASE BACKUP" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Configuration - Adjust according to your .env file
$DB_HOST = "localhost"
$DB_USER = "root"
$DB_PASSWORD = ""  # Leave empty if no password
$DB_NAME = "billing"
$OUTPUT_DIR = Join-Path $PSScriptRoot "backups"

# Create backups directory if not exists
if (!(Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
}

# Get current timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

Write-Host "Database: $DB_NAME"
Write-Host "Output Directory: $OUTPUT_DIR"
Write-Host "Timestamp: $timestamp"
Write-Host ""

# Try to find mysqldump executable
$MYSQLDUMP_PATH = $null
$MYSQL_PATH = $null

# Check common Laragon MySQL paths
$laragonPaths = @(
    "C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqldump.exe",
    "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqldump.exe",
    "C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe",
    "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe"
)

foreach ($path in $laragonPaths) {
    if (Test-Path $path) {
        if ($path -like "*mysqldump*") {
            $MYSQLDUMP_PATH = $path
        } elseif ($path -like "*mysql.exe") {
            $MYSQL_PATH = $path
        }
    }
}

# If not found in Laragon, try system PATH
if (!$MYSQLDUMP_PATH) {
    $MYSQLDUMP_PATH = "mysqldump"
    $MYSQL_PATH = "mysql"
}

Write-Host "Using mysqldump: $MYSQLDUMP_PATH"
Write-Host ""

# Create backup filename
$BACKUP_FILE = Join-Path $OUTPUT_DIR "billing_full_backup_$timestamp.sql"
$COMPRESSED_FILE = Join-Path $OUTPUT_DIR "billing_backup_$timestamp.zip"

# Build mysqldump command
$cmdArgs = @(
    "-h", $DB_HOST,
    "-u", $DB_USER,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    $DB_NAME
)

if ($DB_PASSWORD) {
    $cmdArgs = @("-p$DB_PASSWORD") + $cmdArgs
}

Write-Host "Creating full backup..." -ForegroundColor Yellow

try {
    # Execute mysqldump
    $process = Start-Process -FilePath $MYSQLDUMP_PATH -ArgumentList $cmdArgs -NoNewWindow -PassThru -RedirectStandardOutput $BACKUP_FILE
    $process.WaitForExit()
    
    if ($process.ExitCode -eq 0) {
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host "   BACKUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green
        
        # Get file size
        $fileInfo = Get-Item $BACKUP_FILE
        $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
        
        Write-Host "File: $($fileInfo.Name)"
        Write-Host "Size: $sizeKB KB"
        Write-Host "Location: $BACKUP_FILE"
        Write-Host ""
        
        # Create compressed version
        Write-Host "Creating compressed version..." -ForegroundColor Yellow
        Compress-Archive -Path $BACKUP_FILE -DestinationPath $COMPRESSED_FILE -Force
        
        if (Test-Path $COMPRESSED_FILE) {
            $zipInfo = Get-Item $COMPRESSED_FILE
            $zipSizeKB = [math]::Round($zipInfo.Length / 1KB, 2)
            Write-Host "Compressed backup created: $($zipInfo.Name) ($zipSizeKB KB)" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "To upload to Ubuntu server:" -ForegroundColor Cyan
        Write-Host "1. Upload the .sql file to your Ubuntu server" -ForegroundColor White
        Write-Host "2. SSH into your Ubuntu server" -ForegroundColor White
        Write-Host "3. Run: mysql -u root -p $DB_NAME < billing_full_backup_$timestamp.sql" -ForegroundColor White
        Write-Host ""
        Write-Host "Or if you have the zip file:" -ForegroundColor Cyan
        Write-Host "1. Upload billing_backup_$timestamp.zip to Ubuntu server" -ForegroundColor White
        Write-Host "2. Extract: unzip billing_backup_$timestamp.zip" -ForegroundColor White
        Write-Host "3. Import: mysql -u root -p $DB_NAME < billing_full_backup_$timestamp.sql" -ForegroundColor White
        Write-Host ""
        
    } else {
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Red
        Write-Host "   BACKUP FAILED!" -ForegroundColor Red
        Write-Host "==========================================" -ForegroundColor Red
        Write-Host "mysqldump exited with code: $($process.ExitCode)" -ForegroundColor Red
    }
    
} catch {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "   BACKUP FAILED!" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. MySQL server is running" -ForegroundColor White
    Write-Host "2. Database credentials are correct" -ForegroundColor White
    Write-Host "3. mysqldump is accessible" -ForegroundColor White
    Write-Host "4. You have permission to write to the backup directory" -ForegroundColor White
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")