/**
 * Database Migration Script untuk Postpaid PPN dan Device Rental
 * Jalankan dengan: node migrate_postpaid_ppn.js
 */

const mysql = require('mysql2/promise');

async function runMigration() {
    let connection;

    try {
        // Database connection
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'root',
            database: 'billing'
        });

        console.log('===========================================');
        console.log('Postpaid PPN & Device Rental Migration');
        console.log('===========================================\n');

        // Step 1: Add columns to invoices table
        console.log('[1/2] Adding columns to invoices table...');

        await connection.execute(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS ppn_rate DECIMAL(5,2) DEFAULT 0 COMMENT 'PPN rate (percentage)'
        `);
        console.log('   ✓ ppn_rate column added');

        await connection.execute(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS ppn_amount DECIMAL(15,2) DEFAULT 0 COMMENT 'PPN amount in Rupiah'
        `);
        console.log('   ✓ ppn_amount column added');

        await connection.execute(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS device_fee DECIMAL(15,2) DEFAULT 0 COMMENT 'Device rental fee'
        `);
        console.log('   ✓ device_fee column added');

        // Step 2: Setup system settings
        console.log('\n[2/2] Setting up system settings...');

        await connection.execute(`
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
        `);
        console.log('   ✓ System settings configured');

        console.log('\n===========================================');
        console.log('✅ Migration completed successfully!');
        console.log('===========================================\n');

        console.log('Settings yang sudah di-setup:');
        console.log('  - ppn_enabled: true');
        console.log('  - ppn_rate: 11%');
        console.log('  - device_rental_enabled: true');
        console.log('  - device_rental_fee: Rp 50,000\n');

        console.log('Anda bisa mengubah settings ini via:');
        console.log('  http://localhost/settings/system\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message, '\n');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigration();
