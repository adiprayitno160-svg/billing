echo 'adi' | sudo -S mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'adi'; FLUSH PRIVILEGES;"
