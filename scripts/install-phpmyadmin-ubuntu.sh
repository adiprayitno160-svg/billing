#!/bin/bash

# Script Instalasi Otomatis PhpMyAdmin untuk Ubuntu
# Dibuat untuk Aplikasi Billing

echo "========================================================"
echo "   INSTALLER PHPMYADMIN OTOMATIS (Ubuntu/Debian)"
echo "========================================================"

# Cek apakah user adalah root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Mohon jalankan script ini sebagai root (gunakan sudo)"
  exit 1
fi

echo "🔄 Mengupdate repository apt..."
apt-get update

echo "📦 Menginstall dependensi PHP (Diperlukan oleh phpMyAdmin)..."
# Install PHP dan ekstensi umum yang dibutuhkan
apt-get install -y php php-cli php-fpm php-mysql php-mbstring php-zip php-gd php-json php-curl php-xml

# Deteksi Web Server
WEBSERVER=""
if [ -d "/etc/nginx" ]; then
    echo "✅ Nginx terdeteksi."
    WEBSERVER="nginx"
elif [ -d "/etc/apache2" ]; then
    echo "✅ Apache terdeteksi."
    WEBSERVER="apache2"
else
    echo "⚠️ Tidak ada webserver standar (Nginx/Apache) yang terdeteksi secara otomatis."
    echo "   Akan mencoba instalasi default."
fi

echo "🚀 Menginstall PhpMyAdmin..."

# Konfigurasi otomatis agar tidak banyak bertanya (Non-Interactive)
# Kita set webserver selection. Jika Nginx, pilih 'none' di debconf karena phpmyadmin tidak support auto-config nginx via apt
if [ "$WEBSERVER" == "nginx" ]; then
    echo "phpmyadmin phpmyadmin/reconfigure-webserver multiselect" | debconf-set-selections
else
    echo "phpmyadmin phpmyadmin/reconfigure-webserver multiselect apache2" | debconf-set-selections
fi

echo "phpmyadmin phpmyadmin/dbconfig-install boolean true" | debconf-set-selections
# Password (kosongkan agar ditanya atau generate random jika script sepenuhnya silent)
# Disini kita biarkan instalasi interaktif untuk langkah penting seperti password root mysql jika diperlukan
# Namun perintah 'apt install -y' akan mencoba default.
# Jika ingin benar-benar otomatis, kita harus hati-hati dengan password.
# Untuk keamanan, script ini akan membiarkan prompt password muncul jika sistem membutuhkannya.

apt-get install -y phpmyadmin

# Konfigurasi Khusus Nginx
if [ "$WEBSERVER" == "nginx" ]; then
    echo "⚙️  Mengkonfigurasi untuk Nginx..."
    
    # Buat symlink ke direktori web root umum (sesuaikan jika root folder berbeda)
    # Asumsi root folder umum nginx ada di /var/www/html
    if [ -d "/var/www/html" ]; then
        if [ ! -d "/var/www/html/phpmyadmin" ]; then
            ln -s /usr/share/phpmyadmin /var/www/html/phpmyadmin
            echo "✅ Symlink dibuat: /var/www/html/phpmyadmin -> /usr/share/phpmyadmin"
        else
            echo "ℹ️  Folder /var/www/html/phpmyadmin sudah ada."
        fi
        
        # Cek permission session php (seringkali jadi masalah login phpmyadmin)
        chmod 777 /var/lib/php/sessions/
        
        echo ""
        echo "⚠️  PENTING UNTUK PENGGUNA NGINX:"
        echo "   Pastikan konfigurasi server block Nginx Anda menangani PHP."
        echo "   Biasanya anda perlu menambahkan 'index.php' ke baris 'index'."
        echo "   Contoh lokasi file conf: /etc/nginx/sites-available/default"
        echo "   Pastikan blok 'location ~ \.php$ {' sudah aktif."
    else
        echo "❌ Folder /var/www/html tidak ditemukan. Mohon buat symlink manual: sudo ln -s /usr/share/phpmyadmin /path/to/your/webroot"
    fi
fi

# Konfigurasi Khusus Apache
if [ "$WEBSERVER" == "apache2" ]; then
    echo "⚙️  Mengkonfigurasi untuk Apache..."
    # Biasanya otomatis, tapi kadang perlu enable conf
    if [ -f "/etc/apache2/conf-available/phpmyadmin.conf" ]; then
        a2enconf phpmyadmin
        systemctl reload apache2
        echo "✅ Konfigurasi Apache diaktifkan."
    fi
fi

echo "========================================================"
echo "✅ INSTALASI SELESAI"
echo "========================================================"
echo "phpMyAdmin seharusnya sudah terinstall."
echo "👉 Akses melalui browser: http://IP-SERVER-ANDA/phpmyadmin"
echo ""
echo "📝 Catatan:"
echo "1. Gunakan username 'root' dan password MySQL root Anda untuk melihat SEMUA database."
echo "2. Jika gagal login, cek status service mysql: systemctl status mysql"
echo "========================================================"
