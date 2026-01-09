import { databasePool } from './db/pool';

/**
 * Add gateway_ip and gateway_ip_id columns to customers table
 * Run this script once to update the database schema
 */
async function addGatewayFieldsToCustomers() {
    const conn = await databasePool.getConnection();

    try {
        console.log('🔧 Adding gateway fields to customers table...');

        // Check if columns already exist
        const [columns] = await conn.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'customers' 
            AND COLUMN_NAME IN ('gateway_ip', 'gateway_ip_id')
        `);

        const existingColumns = (columns as any[]).map(row => row.COLUMN_NAME);

        if (existingColumns.includes('gateway_ip') && existingColumns.includes('gateway_ip_id')) {
            console.log('✅ Columns gateway_ip and gateway_ip_id already exist!');
            return;
        }

        // Add gateway_ip column if not exists
        if (!existingColumns.includes('gateway_ip')) {
            await conn.execute(`
                ALTER TABLE customers 
                ADD COLUMN gateway_ip VARCHAR(50) NULL 
                COMMENT 'Gateway IP address for static IP customers'
                AFTER ip_address
            `);
            console.log('✅ Added column: gateway_ip');
        }

        // Add gateway_ip_id column if not exists
        if (!existingColumns.includes('gateway_ip_id')) {
            await conn.execute(`
                ALTER TABLE customers 
                ADD COLUMN gateway_ip_id VARCHAR(100) NULL 
                COMMENT 'MikroTik gateway IP ID for isolation control'
                AFTER gateway_ip
            `);
            console.log('✅ Added column: gateway_ip_id');
        }

        // Add indexes for performance
        try {
            await conn.execute('CREATE INDEX idx_gateway_ip ON customers(gateway_ip)');
            console.log('✅ Created index: idx_gateway_ip');
        } catch (e) {
            console.log('ℹ️  Index idx_gateway_ip may already exist');
        }

        try {
            await conn.execute('CREATE INDEX idx_gateway_ip_id ON customers(gateway_ip_id)');
            console.log('✅ Created index: idx_gateway_ip_id');
        } catch (e) {
            console.log('ℹ️  Index idx_gateway_ip_id may already exist');
        }

        console.log('');
        console.log('✅ Migration completed successfully!');
        console.log('');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        conn.release();
        process.exit(0);
    }
}

// Run migration
addGatewayFieldsToCustomers().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
