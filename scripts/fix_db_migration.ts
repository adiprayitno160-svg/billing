
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import { databasePool } from '../src/db/pool';

async function migrate() {
    console.log('Migrating Database specific for AI features...');
    try {
        // Add proof_image_hash to invoices if not exists
        try {
            await databasePool.query(`
                ALTER TABLE invoices 
                ADD COLUMN proof_image_hash VARCHAR(64) NULL AFTER status
            `);
            console.log('✅ Added proof_image_hash to invoices');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ proof_image_hash already exists in invoices');
            } else {
                console.error('❌ Failed to alter invoices:', e.message);
            }
        }

        // Add index for faster lookup
        try {
            await databasePool.query(`
                CREATE INDEX idx_proof_hash ON invoices(proof_image_hash)
            `);
            console.log('✅ Added index on proof_image_hash');
        } catch (e: any) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️ Index idx_proof_hash already exists');
            } else {
                console.log('⚠️ Failed to add index (non-critical):', e.message);
            }
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit(0);
    }
}

migrate();
