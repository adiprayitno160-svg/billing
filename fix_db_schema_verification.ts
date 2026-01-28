
import { databasePool } from './src/db/pool';

async function fixSchema() {
    const conn = await databasePool.getConnection();
    try {
        console.log('Checking schema...');

        // 1. Fix manual_payment_verifications
        {
            console.log('Checking manual_payment_verifications...');
            const [columns] = await conn.query<any[]>('SHOW COLUMNS FROM manual_payment_verifications');
            const columnNames = columns.map(c => c.Field);

            if (!columnNames.includes('verified_by')) {
                console.log('Adding verified_by to manual_payment_verifications...');
                await conn.query('ALTER TABLE manual_payment_verifications ADD COLUMN verified_by INT NULL');
            }
            if (!columnNames.includes('verified_at')) {
                console.log('Adding verified_at to manual_payment_verifications...');
                await conn.query('ALTER TABLE manual_payment_verifications ADD COLUMN verified_at DATETIME NULL');
            }
            if (!columnNames.includes('invoice_id')) {
                console.log('Adding invoice_id to manual_payment_verifications...');
                await conn.query('ALTER TABLE manual_payment_verifications ADD COLUMN invoice_id INT NULL');
            }
            if (!columnNames.includes('notes')) {
                console.log('Adding notes to manual_payment_verifications...');
                await conn.query('ALTER TABLE manual_payment_verifications ADD COLUMN notes TEXT NULL');
            }
        }

        // 2. Fix invoices
        {
            console.log('Checking invoices...');
            const [columns] = await conn.query<any[]>('SHOW COLUMNS FROM invoices');
            const columnNames = columns.map(c => c.Field);

            if (!columnNames.includes('paid_at')) {
                console.log('Adding paid_at to invoices...');
                await conn.query('ALTER TABLE invoices ADD COLUMN paid_at DATETIME NULL');
            }
        }

        console.log('Schema update complete.');

    } catch (error) {
        console.error('Error fixing schema:', error);
    } finally {
        conn.release();
        process.exit();
    }
}

fixSchema();
