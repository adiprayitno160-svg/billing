import { databasePool } from './db/pool';

/**
 * Add Static IP fields to customers table
 * Fields: ip_address, gateway_ip, gateway_ip_id, interface
 * Run this script once to update the database schema
 */
async function addStaticIpFieldsToCustomers() {
    const conn = await databasePool.getConnection();

    try {
        console.log('🔧 Adding Static IP fields to customers table...');
        console.log('');

        // Check which columns already exist
        const [columns] = await conn.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'customers' 
            AND COLUMN_NAME IN ('ip_address', 'gateway_ip', 'gateway_ip_id', 'interface')
        `);

        const existingColumns = (columns as any[]).map(row => row.COLUMN_NAME);
        console.log('Existing columns:', existingColumns);

        // Add ip_address column if not exists
        if (!existingColumns.includes('ip_address')) {
            await conn.execute(`
                ALTER TABLE customers 
                ADD COLUMN ip_address VARCHAR(50) NULL 
                COMMENT 'IP address for static IP customers'
                AFTER connection_type
            `);
            console.log('✅ Added column: ip_address');
        } else {
            console.log('ℹ️  Column ip_address already exists');
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
        } else {
            console.log('ℹ️  Column gateway_ip already exists');
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
        } else {
            console.log('ℹ️  Column gateway_ip_id already exists');
        }

        // Add interface column if not exists
        if (!existingColumns.includes('interface')) {
            await conn.execute(`
                ALTER TABLE customers 
                ADD COLUMN interface VARCHAR(100) NULL 
                COMMENT 'MikroTik interface for static IP customers'
                AFTER gateway_ip_id
            `);
            console.log('✅ Added column: interface');
        } else {
            console.log('ℹ️  Column interface already exists');
        }

        // Add indexes for performance
        console.log('');
        console.log('Creating indexes...');

        try {
            await conn.execute('CREATE INDEX idx_ip_address ON customers(ip_address)');
            console.log('✅ Created index: idx_ip_address');
        } catch (e) {
            console.log('ℹ️  Index idx_ip_address may already exist');
        }

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
        console.log('📊 Added columns: ip_address, gateway_ip, gateway_ip_id, interface');
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
addStaticIpFieldsToCustomers().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
