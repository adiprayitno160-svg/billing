-- 1. Fix Invoices Status Enum (Add 'partial')
ALTER TABLE invoices MODIFY COLUMN status ENUM('draft', 'sent', 'unpaid', 'paid', 'overdue', 'partial', 'cancelled') DEFAULT 'sent';

-- 2. Monitoring & Notification Tables (from MIGRASI_TABEL_BARU.md)
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

CREATE TABLE IF NOT EXISTS monitoring_map_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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

-- 3. Insert Default Map Config
INSERT IGNORE INTO monitoring_map_config (config_key, config_value, description) VALUES
('map_center_lat', '-6.2088', 'Default map center latitude'),
('map_center_lng', '106.8456', 'Default map center longitude'),
('map_zoom_level', '12', 'Default zoom level for monitoring map'),
('show_offline_customers', 'true', 'Show offline customers on map'),
('refresh_interval', '30', 'Refresh interval in seconds for map updates');

-- 4. Add Columns to Customers Table (Safe Add)
SET @dbname = DATABASE();

SET @check_lat = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'latitude');
SET @sql_lat = IF(@check_lat = 0, 'ALTER TABLE customers ADD COLUMN latitude DECIMAL(10, 8) NULL AFTER address', 'SELECT "latitude already exists"');
PREPARE stmt_lat FROM @sql_lat; EXECUTE stmt_lat; DEALLOCATE PREPARE stmt_lat;

SET @check_lng = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'longitude');
SET @sql_lng = IF(@check_lng = 0, 'ALTER TABLE customers ADD COLUMN longitude DECIMAL(11, 8) NULL AFTER latitude', 'SELECT "longitude already exists"');
PREPARE stmt_lng FROM @sql_lng; EXECUTE stmt_lng; DEALLOCATE PREPARE stmt_lng;

SET @check_last = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'last_online');
SET @sql_last = IF(@check_last = 0, 'ALTER TABLE customers ADD COLUMN last_online TIMESTAMP NULL', 'SELECT "last_online already exists"');
PREPARE stmt_last FROM @sql_last; EXECUTE stmt_last; DEALLOCATE PREPARE stmt_last;

SET @check_online = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_online');
SET @sql_online = IF(@check_online = 0, 'ALTER TABLE customers ADD COLUMN is_online BOOLEAN DEFAULT TRUE', 'SELECT "is_online already exists"');
PREPARE stmt_online FROM @sql_online; EXECUTE stmt_online; DEALLOCATE PREPARE stmt_online;
