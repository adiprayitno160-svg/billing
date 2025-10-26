-- =====================================================
-- BILLING SYSTEM - Complete Database Schema
-- Jalankan script ini untuk membuat SEMUA tabel yang dibutuhkan
-- =====================================================

USE billing_system;

-- =====================================================
-- 1. USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(191) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(191) NULL,
    role ENUM('admin','user','kasir','teknisi') DEFAULT 'user',
    status ENUM('active','inactive') DEFAULT 'active',
    telegram_chat_id VARCHAR(100) NULL,
    full_name VARCHAR(191) NULL,
    phone VARCHAR(50) NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_telegram_chat_id (telegram_chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. MIKROTIK SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS mikrotik_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host VARCHAR(191) NOT NULL,
    port INT NOT NULL DEFAULT 8728,
    username VARCHAR(191) NOT NULL,
    password VARCHAR(191) NOT NULL,
    use_tls TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. PPPOE PROFILES & PACKAGES
-- =====================================================

CREATE TABLE IF NOT EXISTS pppoe_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL UNIQUE,
    local_address VARCHAR(45) NULL,
    remote_address_pool VARCHAR(191) NULL,
    rate_limit VARCHAR(191) NULL,
    session_timeout VARCHAR(50) NULL,
    idle_timeout VARCHAR(50) NULL,
    keepalive_timeout VARCHAR(50) NULL,
    dns_server VARCHAR(191) NULL,
    only_one VARCHAR(10) NULL,
    change_tcp_mss VARCHAR(10) NULL,
    use_compression VARCHAR(10) NULL,
    use_encryption VARCHAR(10) NULL,
    use_mpls VARCHAR(10) NULL,
    use_upnp VARCHAR(10) NULL,
    use_vj_compression VARCHAR(10) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pppoe_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    profile_id INT NULL,
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    duration_days INT NOT NULL DEFAULT 30,
    auto_activation TINYINT(1) DEFAULT 0,
    status ENUM('active','inactive') DEFAULT 'active',
    description TEXT NULL,
    rate_limit_rx VARCHAR(50) NULL COMMENT 'Download limit',
    rate_limit_tx VARCHAR(50) NULL COMMENT 'Upload limit',
    burst_limit_rx VARCHAR(50) NULL,
    burst_limit_tx VARCHAR(50) NULL,
    burst_threshold_rx VARCHAR(50) NULL,
    burst_threshold_tx VARCHAR(50) NULL,
    burst_time_rx VARCHAR(50) NULL,
    burst_time_tx VARCHAR(50) NULL,
    sla_target DECIMAL(5,2) DEFAULT 99.5 COMMENT 'SLA target percentage',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_profile_id (profile_id),
    FOREIGN KEY (profile_id) REFERENCES pppoe_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. STATIC IP PACKAGES & CLIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS static_ip_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    parent_upload_name VARCHAR(191) NULL,
    parent_download_name VARCHAR(191) NULL,
    max_limit_upload VARCHAR(50) NOT NULL,
    max_limit_download VARCHAR(50) NOT NULL,
    max_clients INT DEFAULT 1,
    child_upload_name VARCHAR(191) NULL,
    child_download_name VARCHAR(191) NULL,
    child_upload_limit VARCHAR(50) NULL,
    child_download_limit VARCHAR(50) NULL,
    child_limit_at_upload VARCHAR(50) NULL,
    child_limit_at_download VARCHAR(50) NULL,
    child_burst_upload VARCHAR(50) NULL,
    child_burst_download VARCHAR(50) NULL,
    price DECIMAL(12,2) DEFAULT 0,
    duration_days INT DEFAULT 30,
    status ENUM('active','inactive') DEFAULT 'active',
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS static_ip_clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    customer_id INT NULL,
    client_name VARCHAR(191) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    network VARCHAR(45) NULL,
    interface VARCHAR(100) NULL,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_package_id (package_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    FOREIGN KEY (package_id) REFERENCES static_ip_packages(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. FTTH INFRASTRUCTURE
-- =====================================================

CREATE TABLE IF NOT EXISTS ftth_olt (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    location VARCHAR(191) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    total_ports INT NOT NULL DEFAULT 0,
    used_ports INT NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ftth_odc (
    id INT AUTO_INCREMENT PRIMARY KEY,
    olt_id INT NOT NULL,
    name VARCHAR(191) NOT NULL,
    location VARCHAR(191) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    total_ports INT NOT NULL DEFAULT 0,
    used_ports INT NOT NULL DEFAULT 0,
    olt_card VARCHAR(50) NULL,
    olt_port VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_olt_id (olt_id),
    INDEX idx_olt_card (olt_card),
    INDEX idx_olt_port (olt_port),
    FOREIGN KEY (olt_id) REFERENCES ftth_olt(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ftth_odp (
    id INT AUTO_INCREMENT PRIMARY KEY,
    odc_id INT NOT NULL,
    name VARCHAR(191) NOT NULL,
    location VARCHAR(191) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    total_ports INT NOT NULL DEFAULT 0,
    used_ports INT NOT NULL DEFAULT 0,
    olt_card VARCHAR(50) NULL,
    olt_port VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_odc_id (odc_id),
    INDEX idx_olt_card (olt_card),
    INDEX idx_olt_port (olt_port),
    FOREIGN KEY (odc_id) REFERENCES ftth_odc(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. SUBSCRIPTIONS (Customer Package Assignment)
-- =====================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    package_id INT NULL,
    package_type ENUM('pppoe','static_ip','prepaid') DEFAULT 'pppoe',
    start_date DATE NOT NULL,
    end_date DATE NULL,
    status ENUM('active','inactive','suspended','expired') DEFAULT 'active',
    auto_renewal TINYINT(1) DEFAULT 1,
    price DECIMAL(15,2) DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_package_id (package_id),
    INDEX idx_status (status),
    INDEX idx_end_date (end_date),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. INVOICES & PAYMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    subscription_id INT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    tax DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    status ENUM('unpaid','paid','partial','overdue','cancelled') DEFAULT 'unpaid',
    payment_method VARCHAR(50) NULL,
    paid_at TIMESTAMP NULL,
    notes TEXT NULL,
    period_month INT NULL,
    period_year INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_period (period_year, period_month),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_id INT NOT NULL,
    customer_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('cash','transfer','credit_card','e-wallet','xendit','midtrans','other') DEFAULT 'cash',
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_number VARCHAR(191) NULL,
    notes TEXT NULL,
    cashier_id INT NULL,
    status ENUM('pending','success','failed','cancelled') DEFAULT 'success',
    gateway_response TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_number (payment_number),
    INDEX idx_invoice_id (invoice_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_status (status),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. PREPAID SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS prepaid_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    type ENUM('time','quota','unlimited') DEFAULT 'time',
    duration_value INT NULL COMMENT 'Duration in minutes/hours/days',
    duration_unit ENUM('minutes','hours','days','months') DEFAULT 'days',
    quota_value INT NULL COMMENT 'Quota in MB/GB',
    quota_unit ENUM('MB','GB','TB') DEFAULT 'GB',
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    speed_profile_id INT NULL,
    validity_days INT DEFAULT 30,
    status ENUM('active','inactive') DEFAULT 'active',
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prepaid_vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_code VARCHAR(50) UNIQUE NOT NULL,
    package_id INT NOT NULL,
    customer_id INT NULL,
    status ENUM('available','sold','used','expired','cancelled') DEFAULT 'available',
    generated_by INT NULL,
    sold_by INT NULL,
    sold_at TIMESTAMP NULL,
    activated_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    pppoe_username VARCHAR(191) NULL,
    pppoe_password VARCHAR(191) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_voucher_code (voucher_code),
    INDEX idx_package_id (package_id),
    INDEX idx_status (status),
    INDEX idx_customer_id (customer_id),
    FOREIGN KEY (package_id) REFERENCES prepaid_packages(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (sold_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prepaid_speed_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL UNIQUE,
    download_speed VARCHAR(50) NOT NULL COMMENT 'e.g., 10M, 20M',
    upload_speed VARCHAR(50) NOT NULL,
    burst_download VARCHAR(50) NULL,
    burst_upload VARCHAR(50) NULL,
    burst_threshold VARCHAR(50) NULL,
    burst_time VARCHAR(50) NULL,
    priority INT DEFAULT 8,
    address_list VARCHAR(191) NULL,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prepaid_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT NOT NULL,
    customer_id INT NULL,
    transaction_type ENUM('generate','sell','activate','expire','extend','cancel') NOT NULL,
    amount DECIMAL(15,2) DEFAULT 0,
    payment_method VARCHAR(50) NULL,
    performed_by INT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_voucher_id (voucher_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (voucher_id) REFERENCES prepaid_vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. KASIR / CASHIER SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS kasir_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(191) NULL,
    transaction_type ENUM('invoice_payment','prepaid_sale','topup','other') DEFAULT 'invoice_payment',
    invoice_id INT NULL,
    voucher_id INT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    cashier_id INT NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_transaction_number (transaction_number),
    INDEX idx_customer_id (customer_id),
    INDEX idx_cashier_id (cashier_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kasir_shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cashier_id INT NOT NULL,
    shift_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shift_end TIMESTAMP NULL,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    closing_balance DECIMAL(15,2) NULL,
    total_transactions INT DEFAULT 0,
    total_cash DECIMAL(15,2) DEFAULT 0,
    total_transfer DECIMAL(15,2) DEFAULT 0,
    total_other DECIMAL(15,2) DEFAULT 0,
    notes TEXT NULL,
    status ENUM('open','closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cashier_id (cashier_id),
    INDEX idx_status (status),
    INDEX idx_shift_start (shift_start),
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. SLA MONITORING
-- =====================================================

CREATE TABLE IF NOT EXISTS sla_incidents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    service_type ENUM('pppoe','static_ip') NOT NULL DEFAULT 'pppoe',
    incident_type ENUM('downtime','degraded','maintenance') NOT NULL DEFAULT 'downtime',
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    duration_minutes INT DEFAULT 0,
    status ENUM('ongoing','resolved','excluded') DEFAULT 'ongoing',
    exclude_reason ENUM('maintenance','force_majeure','customer_fault','transient','isolated') NULL,
    exclude_notes TEXT NULL,
    is_counted_in_sla BOOLEAN DEFAULT 1,
    technician_id INT NULL,
    resolved_by INT NULL,
    alert_sent_telegram BOOLEAN DEFAULT 0,
    alert_sent_whatsapp BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sla_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    month_year DATE NOT NULL,
    total_minutes INT DEFAULT 43200 COMMENT '30 days * 24 hours * 60 minutes',
    downtime_minutes INT DEFAULT 0,
    sla_percentage DECIMAL(5,2) DEFAULT 100.00,
    sla_status ENUM('met','breach','warning') DEFAULT 'met',
    incident_count INT DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,
    discount_approved BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_customer_month (customer_id, month_year),
    INDEX idx_month_year (month_year),
    INDEX idx_sla_status (sla_status),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(191) NOT NULL,
    description TEXT NULL,
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    actual_start TIMESTAMP NULL,
    actual_end TIMESTAMP NULL,
    affected_area VARCHAR(191) NULL,
    affected_customers TEXT NULL COMMENT 'JSON array of customer IDs',
    status ENUM('scheduled','in_progress','completed','cancelled') DEFAULT 'scheduled',
    notification_sent BOOLEAN DEFAULT 0,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_scheduled_start (scheduled_start),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. BANDWIDTH MONITORING
-- =====================================================

CREATE TABLE IF NOT EXISTS bandwidth_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    pppoe_username VARCHAR(191) NULL,
    download_bytes BIGINT DEFAULT 0,
    upload_bytes BIGINT DEFAULT 0,
    total_bytes BIGINT DEFAULT 0,
    log_date DATE NOT NULL,
    log_hour INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_pppoe_username (pppoe_username),
    INDEX idx_log_date (log_date),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 12. ADDRESS LISTS (MikroTik)
-- =====================================================

CREATE TABLE IF NOT EXISTS address_lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL UNIQUE,
    description TEXT NULL,
    addresses TEXT NULL,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS address_list_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    address_list_id INT NOT NULL,
    address VARCHAR(45) NOT NULL,
    comment VARCHAR(255) NULL,
    disabled TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_address_list_id (address_list_id),
    UNIQUE KEY unique_address_per_list (address_list_id, address),
    FOREIGN KEY (address_list_id) REFERENCES address_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 13. TELEGRAM & WHATSAPP SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS telegram_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_token VARCHAR(500) NOT NULL COMMENT 'Token bot dari BotFather',
    auto_start TINYINT(1) DEFAULT 1 COMMENT 'Auto start bot saat server dimulai',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chat_id VARCHAR(100) UNIQUE NOT NULL,
    user_id INT NULL,
    username VARCHAR(191) NULL,
    first_name VARCHAR(191) NULL,
    last_name VARCHAR(191) NULL,
    is_authorized BOOLEAN DEFAULT 0,
    role ENUM('admin','user','teknisi') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_chat_id (chat_id),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(50) NULL,
    qr_code TEXT NULL,
    session_status ENUM('disconnected','connecting','connected') DEFAULT 'disconnected',
    auto_reply TINYINT(1) DEFAULT 0,
    auto_notification TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 14. COMPANY SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS company_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(191) NOT NULL,
    address TEXT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(191) NULL,
    website VARCHAR(191) NULL,
    logo_path VARCHAR(255) NULL,
    tax_number VARCHAR(100) NULL,
    bank_name VARCHAR(191) NULL,
    bank_account_number VARCHAR(100) NULL,
    bank_account_name VARCHAR(191) NULL,
    invoice_footer TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 15. SYSTEM SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string','number','boolean','json') DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 16. PARENT QUEUES (MikroTik Queue Management)
-- =====================================================

CREATE TABLE IF NOT EXISTS parent_queues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL UNIQUE,
    target VARCHAR(191) NOT NULL,
    max_limit VARCHAR(50) NOT NULL,
    burst_limit VARCHAR(50) NULL,
    burst_threshold VARCHAR(50) NULL,
    burst_time VARCHAR(50) NULL,
    priority INT DEFAULT 8,
    queue_type VARCHAR(50) DEFAULT 'default',
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 17. PORTAL ACCESS (Customer Portal)
-- =====================================================

CREATE TABLE IF NOT EXISTS portal_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL UNIQUE,
    username VARCHAR(191) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    status ENUM('active','inactive','suspended') DEFAULT 'active',
    last_login TIMESTAMP NULL,
    reset_token VARCHAR(255) NULL,
    reset_token_expires TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_customer_id (customer_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VIEWS for Dashboard & Reporting
-- =====================================================

CREATE OR REPLACE VIEW v_active_incidents AS
SELECT 
    si.id AS incident_id,
    si.customer_id,
    c.name AS customer_name,
    c.area,
    COALESCE(c.odc_location, '') AS odc_location,
    si.service_type,
    si.start_time,
    si.duration_minutes,
    si.incident_type,
    si.status,
    si.alert_sent_telegram,
    si.alert_sent_whatsapp
FROM sla_incidents si
JOIN customers c ON si.customer_id = c.id
WHERE si.status = 'ongoing'
ORDER BY si.duration_minutes DESC, si.start_time ASC;

-- =====================================================
-- Default Data
-- =====================================================

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('app_version', '1.0.0', 'string', 'Current application version'),
('auto_invoice_generation', 'true', 'boolean', 'Auto generate invoices monthly'),
('invoice_due_days', '7', 'number', 'Default invoice due days'),
('tax_percentage', '0', 'number', 'Tax percentage for invoices'),
('currency', 'IDR', 'string', 'Currency code')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Insert default company info if not exists
INSERT INTO company_info (company_name, address, phone, email)
SELECT 'Billing System', 'Your Address', '0000-0000-0000', 'info@yourdomain.com'
WHERE NOT EXISTS (SELECT 1 FROM company_info LIMIT 1);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 'All tables created successfully!' AS status,
       COUNT(*) AS total_tables
FROM information_schema.tables 
WHERE table_schema = 'billing_system';

