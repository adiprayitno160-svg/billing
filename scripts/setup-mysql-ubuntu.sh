#!/bin/bash

# ==========================================
# AUTO INSTALL MYSQL & SETUP DATABASE (Ubuntu)
# ==========================================

echo "=========================================="
echo "   Auto Install MySQL & Setup Database"
echo "=========================================="

# 1. Update & Install MySQL
echo "📦 Updating repositories..."
sudo apt update

echo "📦 Installing MySQL Server..."
sudo apt install -y mysql-server

# 2. Start MySQL Service
echo "🚀 Starting MySQL Service..."
sudo systemctl start mysql
sudo systemctl enable mysql

# 3. Configure Database Credentials
echo ""
echo "⚙️  CONFIGURATION"
read -p "Database Name [billing]: " DB_NAME
DB_NAME=${DB_NAME:-billing}

read -p "Database User [billing_user]: " DB_USER
DB_USER=${DB_USER:-billing_user}

read -s -p "Database Password [Generate Random]: " DB_PASS
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 12)
    echo "Generated Password: $DB_PASS"
fi
echo ""

# 4. Setup Database & User
echo "🔧 Setting up Database '$DB_NAME' and User '$DB_USER'..."

sudo mysql <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME};
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root'; -- Optional: Set root password if needed, usually auth_socket
FLUSH PRIVILEGES;
EOF

echo "✅ Database & User created successfully!"
echo ""
echo "📝 SAVE THESE CREDENTIALS FOR YOUR .env FILE:"
echo "----------------------------------------"
echo "DB_HOST=localhost"
echo "DB_USER=$DB_USER"
echo "DB_PASSWORD=$DB_PASS"
echo "DB_NAME=$DB_NAME"
echo "----------------------------------------"
echo ""

# 5. Restore Option
read -p "Apakah Anda ingin me-restore file backup .sql sekarang? (y/n): " DO_RESTORE

if [[ "$DO_RESTORE" =~ ^[Yy]$ ]]; then
    read -e -p "Masukkan path file .sql (contoh: /home/ubuntu/backup.sql): " SQL_FILE
    
    if [ -f "$SQL_FILE" ]; then
        echo "⏳ Restoring database from $SQL_FILE..."
        # Gunakan sudo mysql agar tidak perlu password root jika auth_socket aktif
        sudo mysql "$DB_NAME" < "$SQL_FILE"
        
        if [ $? -eq 0 ]; then
            echo "✅ RESTORE SUCCESSFUL!"
        else
            echo "❌ Restore failed."
        fi
    else
        echo "❌ File not found: $SQL_FILE"
    fi
fi

echo ""
echo "🎉 Setup Finished!"
