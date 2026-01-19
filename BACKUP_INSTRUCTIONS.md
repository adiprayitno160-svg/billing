# Database Backup for Ubuntu Server Deployment

## Overview
This repository contains scripts to create a full database backup that can be uploaded to your Ubuntu live server.

## Backup Scripts

### 1. Windows Batch Script (`create-full-backup.bat`)
- Simple batch file for Windows
- Automatically detects Laragon MySQL installation
- Creates both SQL and ZIP versions of backup

### 2. PowerShell Script (`create-full-backup.ps1`)
- More advanced PowerShell version
- Better error handling and colored output
- Same functionality as batch script

## How to Create Backup

### Method 1: Using PowerShell (Recommended)
```powershell
.\create-full-backup.ps1
```

### Method 2: Using Batch File
```cmd
create-full-backup.bat
```

## What Gets Backed Up
- Complete database structure (tables, indexes, constraints)
- All data from all tables
- Stored procedures and functions
- Triggers
- Events

## Output Files
Backups are saved in the `backups/` directory:
- `billing_full_backup_YYYY-MM-DD_HH-mm-ss.sql` - Raw SQL backup
- `billing_backup_YYYY-MM-DD_HH-mm-ss.zip` - Compressed backup

## Uploading to Ubuntu Server

### Method 1: Direct SQL Import
1. Upload the `.sql` file to your Ubuntu server:
   ```bash
   scp billing_full_backup_*.sql user@your-server:/home/user/
   ```

2. SSH into your Ubuntu server:
   ```bash
   ssh user@your-server
   ```

3. Import the database:
   ```bash
   mysql -u root -p billing < billing_full_backup_*.sql
   ```

### Method 2: Using Compressed File
1. Upload the `.zip` file to your Ubuntu server:
   ```bash
   scp billing_backup_*.zip user@your-server:/home/user/
   ```

2. SSH into your Ubuntu server:
   ```bash
   ssh user@your-server
   ```

3. Extract and import:
   ```bash
   unzip billing_backup_*.zip
   mysql -u root -p billing < billing_full_backup_*.sql
   ```

## Prerequisites on Ubuntu Server

Make sure your Ubuntu server has:
1. MySQL/MariaDB installed
2. Database created (can be done during import)
3. Sufficient disk space
4. Unzip utility (for compressed files):
   ```bash
   sudo apt install unzip
   ```

## Troubleshooting

### If backup fails:
- Check if MySQL server is running locally
- Verify database credentials in the script
- Ensure Laragon MySQL path is correct
- Check write permissions to backup directory

### If import fails on Ubuntu:
- Make sure database exists: `CREATE DATABASE billing;`
- Check MySQL user permissions
- Verify file upload was successful
- Check available disk space

## Security Notes
- Backup files contain sensitive data
- Store backups securely
- Delete old backups regularly
- Consider encrypting backup files for transfer

## Automation
You can schedule automatic backups using:
- Windows Task Scheduler for batch script
- Cron jobs on Ubuntu server for regular imports