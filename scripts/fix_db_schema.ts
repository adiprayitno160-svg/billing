
import { databasePool } from '../src/db/pool';

async function fixSchema() {
    const connection = await databasePool.getConnection();
    try {
        console.log('Checking unified_notifications_queue table...');

        // Check if attachment_path column exists
        const [columns] = await connection.query<any[]>('SHOW COLUMNS FROM unified_notifications_queue LIKE "attachment_path"');

        if (columns.length === 0) {
            console.log('Adding missing column: attachment_path');
            await connection.query('ALTER TABLE unified_notifications_queue ADD COLUMN attachment_path VARCHAR(255) NULL AFTER message');
            console.log('✅ Column added successfully.');
        } else {
            console.log('ℹ️ Column attachment_path already exists.');
        }

        // Check pppoe_packages table for missing capacity columns
        console.log('Checking pppoe_packages table columns...');
        const [pppoeCols] = await connection.query<any[]>('SHOW COLUMNS FROM pppoe_packages');
        const pppoeColNames = pppoeCols.map(c => c.Field);

        if (!pppoeColNames.includes('max_clients')) {
            console.log('Adding missing column: pppoe_packages.max_clients');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN max_clients INT DEFAULT 1 AFTER is_enabled_30_days');
        }

        if (!pppoeColNames.includes('limit_at_upload')) {
            console.log('Adding missing column: pppoe_packages.limit_at_upload');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN limit_at_upload VARCHAR(50) NULL AFTER max_clients');
        }

        if (!pppoeColNames.includes('limit_at_download')) {
            console.log('Adding missing column: pppoe_packages.limit_at_download');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN limit_at_download VARCHAR(50) NULL AFTER limit_at_upload');
        }

        console.log('✅ pppoe_packages schema check completed.');

        // ALL NEW FIXES FOR PAYMENT VERIFICATION
        console.log('Checking manual_payment_verifications schema...');
        try {
            // Ensure table exists first
            await connection.query(`
                CREATE TABLE IF NOT EXISTS manual_payment_verifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    customer_id INT NOT NULL,
                    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    image_data LONGTEXT,
                    image_mimetype VARCHAR(50),
                    extracted_amount DECIMAL(15, 2),
                    expected_amount DECIMAL(15, 2),
                    reason TEXT,
                    notes TEXT,
                    invoice_id INT,
                    verified_by INT,
                    verified_at DATETIME,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX (customer_id),
                    INDEX (status),
                    INDEX (verified_by)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            const [mpvCols] = await connection.query<any[]>('SHOW COLUMNS FROM manual_payment_verifications');
            const mpvColNames = mpvCols.map(c => c.Field);

            if (!mpvColNames.includes('verified_by')) {
                console.log('Adding verified_by to manual_payment_verifications...');
                await connection.query('ALTER TABLE manual_payment_verifications ADD COLUMN verified_by INT NULL');
            }
            if (!mpvColNames.includes('verified_at')) {
                console.log('Adding verified_at to manual_payment_verifications...');
                await connection.query('ALTER TABLE manual_payment_verifications ADD COLUMN verified_at DATETIME NULL');
            }
            if (!mpvColNames.includes('invoice_id')) {
                console.log('Adding invoice_id to manual_payment_verifications...');
                await connection.query('ALTER TABLE manual_payment_verifications ADD COLUMN invoice_id INT NULL');
            }
            if (!mpvColNames.includes('notes')) {
                console.log('Adding notes to manual_payment_verifications...');
                await connection.query('ALTER TABLE manual_payment_verifications ADD COLUMN notes TEXT NULL');
            }
        } catch (err) {
            console.error('Error fixing manual_payment_verifications:', err);
        }

        console.log('Checking invoices schema...');
        try {
            const [invCols] = await connection.query<any[]>('SHOW COLUMNS FROM invoices');
            const invColNames = invCols.map(c => c.Field);

            if (!invColNames.includes('paid_at')) {
                console.log('Adding paid_at to invoices...');
                await connection.query('ALTER TABLE invoices ADD COLUMN paid_at DATETIME NULL AFTER due_date');
            }
        } catch (err) {
            console.error('Error fixing invoices:', err);
        }

    } catch (error) {
        console.error('❌ Error updating database schema:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

fixSchema();
