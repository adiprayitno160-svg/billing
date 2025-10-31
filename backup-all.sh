#!/bin/bash

# Script untuk backup semua file aplikasi dan database dalam 1 file ZIP
# Usage: bash backup-all.sh

APP_PATH="/opt/billing"
BACKUP_DIR="/opt/billing/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="billing-backup-${TIMESTAMP}"
TEMP_DIR="${BACKUP_DIR}/${BACKUP_NAME}"

# Buat direktori backup jika belum ada
mkdir -p "$BACKUP_DIR"
mkdir -p "$TEMP_DIR"

echo "🔄 Starting backup process..."
echo "📦 Backup name: ${BACKUP_NAME}"
echo ""

# 1. Backup Database
echo "📊 Backing up database..."
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-billing_user}"
DB_NAME="${DB_NAME:-billing}"
DB_PASSWORD="${DB_PASSWORD:-}"

DB_BACKUP_FILE="${TEMP_DIR}/database.sql"

# Backup database dengan mysqldump
if [ -z "$DB_PASSWORD" ]; then
    mysqldump -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" > "$DB_BACKUP_FILE" 2>/dev/null || {
        echo "⚠️  Warning: Database backup failed (might need password)"
        echo "   Trying with prompt..."
        mysqldump -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" > "$DB_BACKUP_FILE" || {
            echo "❌ Database backup failed!"
            rm -rf "$TEMP_DIR"
            exit 1
        }
    }
else
    mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$DB_BACKUP_FILE" || {
        echo "❌ Database backup failed!"
        rm -rf "$TEMP_DIR"
        exit 1
    }
fi

if [ -f "$DB_BACKUP_FILE" ]; then
    DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
    echo "✅ Database backed up successfully (${DB_SIZE})"
else
    echo "❌ Database backup file not created!"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""

# 2. Backup Application Files
echo "📁 Backing up application files..."
echo "   (This may take a while...)"

# Backup semua file kecuali yang tidak perlu
rsync -a \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='backups' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='uploads' \
    --exclude='whatsapp-session' \
    --exclude='*.log' \
    --exclude='.env' \
    "$APP_PATH/" "${TEMP_DIR}/files/" 2>/dev/null || {
    # Fallback jika rsync tidak ada, gunakan tar
    echo "   Using tar (rsync not available)..."
    cd "$APP_PATH" || exit 1
    tar --exclude='node_modules' \
        --exclude='dist' \
        --exclude='backups' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='uploads' \
        --exclude='whatsapp-session' \
        --exclude='*.log' \
        --exclude='.env' \
        -czf "${TEMP_DIR}/files.tar.gz" . 2>/dev/null || {
        echo "❌ File backup failed!"
        rm -rf "$TEMP_DIR"
        exit 1
    }
}

FILES_SIZE=$(du -sh "${TEMP_DIR}/files" 2>/dev/null | cut -f1 || du -sh "${TEMP_DIR}/files.tar.gz" 2>/dev/null | cut -f1 || echo "unknown")
echo "✅ Application files backed up (${FILES_SIZE})"
echo ""

# 3. Backup .env file (optional, dengan warning)
if [ -f "${APP_PATH}/.env" ]; then
    echo "🔐 Backing up .env file (contains sensitive data)..."
    cp "${APP_PATH}/.env" "${TEMP_DIR}/.env.backup"
    echo "✅ .env file backed up"
    echo ""
fi

# 4. Buat file info backup
echo "📝 Creating backup info file..."
cat > "${TEMP_DIR}/backup-info.txt" <<EOF
Backup Information
==================
Date: $(date)
Timestamp: ${TIMESTAMP}
Backup Name: ${BACKUP_NAME}

Application Path: ${APP_PATH}
Database: ${DB_NAME}

Files Included:
- Application source code
- Configuration files
- Database dump

Files Excluded:
- node_modules (can be reinstalled)
- dist (can be rebuilt)
- .git (version control)
- logs
- uploads (user uploads)
- backups (backup directory)
- whatsapp-session (session files)

Restore Instructions:
1. Extract this ZIP file
2. Restore database: mysql -u ${DB_USER} -p ${DB_NAME} < database.sql
3. Copy files to application directory
4. Run: npm install
5. Run: npm run build
6. Restore .env if needed
7. Restart application: pm2 restart billing-app

EOF

echo "✅ Backup info created"
echo ""

# 5. Buat ZIP file
echo "📦 Creating ZIP archive..."
ZIP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.zip"
cd "$BACKUP_DIR" || exit 1

zip -r "${BACKUP_NAME}.zip" "${BACKUP_NAME}" > /dev/null 2>&1 || {
    echo "❌ ZIP creation failed! Trying with different method..."
    # Fallback jika zip tidak ada, gunakan tar.gz
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}" || {
        echo "❌ Archive creation failed!"
        rm -rf "$TEMP_DIR"
        exit 1
    }
    ZIP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
}

# Hapus temporary directory
rm -rf "$TEMP_DIR"

# Get file size
if [ -f "$ZIP_FILE" ]; then
    FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo "✅ Backup archive created successfully!"
    echo ""
    echo "📦 Backup file: ${ZIP_FILE}"
    echo "📊 Size: ${FILE_SIZE}"
    echo ""
    echo "✅ Backup completed successfully!"
    
    # List recent backups
    echo ""
    echo "Recent backups:"
    ls -lh "$BACKUP_DIR"/*.{zip,tar.gz} 2>/dev/null | tail -5 | awk '{print $9, "(" $5 ")"}'
else
    echo "❌ Backup archive not found!"
    exit 1
fi

