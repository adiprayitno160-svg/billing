<?php
/**
 * Database Migration Script untuk Postpaid PPN dan Device Rental
 * Jalankan dengan: php migrate_postpaid_ppn.php
 */

try {
    // Database connection
    $host = 'localhost';
    $db = 'billing';
    $user = 'root';
    $pass = 'root';
    
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "===========================================\n";
    echo "Postpaid PPN & Device Rental Migration\n";
    echo "===========================================\n\n";
    
    // Step 1: Add columns to invoices table
    echo "[1/2] Adding columns to invoices table...\n";
    
    $pdo->exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ppn_rate DECIMAL(5,2) DEFAULT 0 COMMENT 'PPN rate (percentage)'");
    echo "   ✓ ppn_rate column added\n";
    
    $pdo->exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ppn_amount DECIMAL(15,2) DEFAULT 0 COMMENT 'PPN amount in Rupiah'");
    echo "   ✓ ppn_amount column added\n";
    
    $pdo->exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS device_fee DECIMAL(15,2) DEFAULT 0 COMMENT 'Device rental fee'");
    echo "   ✓ device_fee column added\n";
    
    // Step 2: Setup system settings
    echo "\n[2/2] Setting up system settings...\n";
    
    $stmt = $pdo->prepare("
        INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_description, created_at, updated_at)
        VALUES 
            ('ppn_enabled', 'true', 'billing', 'Aktifkan perhitungan PPN pada invoice postpaid', NOW(), NOW()),
            ('ppn_rate', '11', 'billing', 'Rate PPN dalam persen (%)', NOW(), NOW()),
            ('device_rental_enabled', 'true', 'billing', 'Aktifkan biaya sewa perangkat', NOW(), NOW()),
            ('device_rental_fee', '50000', 'billing', 'Biaya sewa perangkat per bulan (Rupiah)', NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
            setting_value = VALUES(setting_value),
            setting_description = VALUES(setting_description),
            updated_at = NOW()
    ");
    $stmt->execute();
    echo "   ✓ System settings configured\n";
    
    echo "\n===========================================\n";
    echo "✅ Migration completed successfully!\n";
    echo "===========================================\n\n";
    
    echo "Settings yang sudah di-setup:\n";
    echo "  - ppn_enabled: true\n";
    echo "  - ppn_rate: 11%\n";
    echo "  - device_rental_enabled: true\n";
    echo "  - device_rental_fee: Rp 50,000\n\n";
    
    echo "Anda bisa mengubah settings ini via:\n";
    echo "  http://localhost/settings/system\n\n";
    
} catch (PDOException $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n\n";
    exit(1);
}
