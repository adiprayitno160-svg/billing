
import { databasePool } from './src/db/pool';

async function migrateToBigInt() {
    console.log('--- MIGRATING DATABASE TO BIGINT (RETRY) ---');

    const conn = await databasePool.getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS=0');
        console.log('Foreign Key Checks: DISABLED');

        // Drop FK if exists (ignoring error if not exists)
        try {
            await conn.query('ALTER TABLE customers DROP FOREIGN KEY fk_referred_by');
            console.log('Dropped FK fk_referred_by');
        } catch (e) {
            console.log('FK fk_referred_by might not exist or error dropping:', (e as any).message);
        }

        // 1. Modify Customers Table: ID and referred_by_id
        console.log('Migrating table `customers` columns...');
        // Modifying both to ensure compatibility
        // First referred_by_id (to avoid FK issues even though checks are off, good practice)
        await conn.execute('ALTER TABLE customers MODIFY referred_by_id BIGINT UNSIGNED');
        // Then ID
        await conn.execute('ALTER TABLE customers MODIFY id BIGINT UNSIGNED AUTO_INCREMENT');

        // 2. Modify Related Tables
        const tables = [
            'static_ip_clients',
            'subscriptions',
            'invoices',
            'payments'
        ];

        for (const table of tables) {
            try {
                console.log(`Migrating table \`${table}\` column \`customer_id\`...`);
                await conn.query(`ALTER TABLE ${table} MODIFY customer_id BIGINT UNSIGNED`);
            } catch (err: any) {
                console.log(`Warning processing \`${table}\`: ${err.message}`);
            }
        }

        // Restore FK
        console.log('Restoring FK fk_referred_by...');
        try {
            await conn.query('ALTER TABLE customers ADD CONSTRAINT fk_referred_by FOREIGN KEY (referred_by_id) REFERENCES customers(id) ON DELETE SET NULL');
        } catch (e) {
            console.log('Warning restoring FK:', (e as any).message);
        }

        await conn.query('SET FOREIGN_KEY_CHECKS=1');
        console.log('\n✅ MIGRATION SUCCESSFUL!');

    } catch (err) {
        console.error('❌ MIGRATION FAILED:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

migrateToBigInt();
