import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';

export class MigrationController {
    /**
     * Run Postpaid PPN & Device Rental Migration
     * POST /tools/migrate/postpaid-ppn
     */
    static async runPostpaidPpnMigration(req: Request, res: Response): Promise<void> {
        try {
            const results: string[] = [];

            // Step 1: Add columns to invoices table
            results.push('🔧 Adding columns to invoices table...');

            try {
                await databasePool.execute(`
                    ALTER TABLE invoices 
                    ADD COLUMN ppn_rate DECIMAL(5,2) DEFAULT 0 COMMENT 'PPN rate (percentage)'
                `);
                results.push('   ✓ ppn_rate column added');
            } catch (error: any) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    results.push('   ℹ ppn_rate column already exists');
                } else {
                    throw error;
                }
            }

            try {
                await databasePool.execute(`
                    ALTER TABLE invoices 
                    ADD COLUMN ppn_amount DECIMAL(15,2) DEFAULT 0 COMMENT 'PPN amount in Rupiah'
                `);
                results.push('   ✓ ppn_amount column added');
            } catch (error: any) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    results.push('   ℹ ppn_amount column already exists');
                } else {
                    throw error;
                }
            }

            try {
                await databasePool.execute(`
                    ALTER TABLE invoices 
                    ADD COLUMN device_fee DECIMAL(15,2) DEFAULT 0 COMMENT 'Device rental fee'
                `);
                results.push('   ✓ device_fee column added');
            } catch (error: any) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    results.push('   ℹ device_fee column already exists');
                } else {
                    throw error;
                }
            }

            // Step 2: Add columns to prepaid tables
            results.push('');
            results.push('🔧 Adding columns to prepaid tables...');

            // payment_requests columns
            const prColumns = [
                { name: 'ppn_rate', def: 'DECIMAL(5,2) DEFAULT 0' },
                { name: 'ppn_amount', def: 'DECIMAL(15,2) DEFAULT 0' },
                { name: 'device_fee', def: 'DECIMAL(15,2) DEFAULT 0' },
                { name: 'subtotal_amount', def: 'DECIMAL(15,2) DEFAULT 0' }
            ];

            for (const col of prColumns) {
                try {
                    await databasePool.execute(`ALTER TABLE payment_requests ADD COLUMN ${col.name} ${col.def}`);
                    results.push(`   ✓ payment_requests.${col.name} added`);
                } catch (error: any) {
                    if (error.code === 'ER_DUP_FIELDNAME') results.push(`   ℹ payment_requests.${col.name} exists`);
                    else results.push(`   ❌ Error adding ${col.name}: ${error.message}`);
                }
            }

            // prepaid_transactions columns
            const ptColumns = [
                { name: 'ppn_amount', def: 'DECIMAL(15,2) DEFAULT 0' },
                { name: 'device_fee', def: 'DECIMAL(15,2) DEFAULT 0' },
                { name: 'invoice_id', def: 'INT NULL' }
            ];

            for (const col of ptColumns) {
                try {
                    await databasePool.execute(`ALTER TABLE prepaid_transactions ADD COLUMN ${col.name} ${col.def}`);
                    results.push(`   ✓ prepaid_transactions.${col.name} added`);
                } catch (error: any) {
                    if (error.code === 'ER_DUP_FIELDNAME') results.push(`   ℹ prepaid_transactions.${col.name} exists`);
                    else results.push(`   ❌ Error adding ${col.name}: ${error.message}`);
                }
            }

            // Step 3: Setup system settings
            results.push('');
            results.push('⚙️ Setting up system settings...');

            await databasePool.execute(`
                INSERT INTO system_settings (setting_key, setting_value, category, setting_description, created_at, updated_at)
                VALUES 
                    ('ppn_enabled', 'true', 'billing', 'Aktifkan perhitungan PPN pada invoice', NOW(), NOW()),
                    ('ppn_rate', '11', 'billing', 'Rate PPN dalam persen (%)', NOW(), NOW()),
                    ('device_rental_enabled', 'true', 'billing', 'Aktifkan biaya sewa perangkat', NOW(), NOW()),
                    ('device_rental_fee', '50000', 'billing', 'Biaya sewa perangkat per bulan (Rupiah)', NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    setting_description = VALUES(setting_description),
                    updated_at = NOW()
            `);
            results.push('   ✓ System settings configured');

            results.push('');
            results.push('✅ Migration completed successfully!');
            results.push('');
            results.push('Settings yang sudah di-setup:');
            results.push('  - ppn_enabled: true');
            results.push('  - ppn_rate: 11%');
            results.push('  - device_rental_enabled: true');
            results.push('  - device_rental_fee: Rp 50,000');
            results.push('');
            results.push('Anda bisa mengubah settings ini via:');
            results.push('  /settings/system');

            res.status(200).json({
                success: true,
                message: 'Migration completed successfully',
                details: results.join('\n')
            });

        } catch (error: any) {
            console.error('Migration error:', error);
            res.status(500).json({
                success: false,
                error: 'Migration failed',
                message: error.message,
                details: error.stack
            });
        }
    }
}
