
import { databasePool } from '../src/db/pool';

async function migrate() {
    console.log('Migrating Payment Requests Table...');
    try {
        // Add proof_image to payment_requests
        try {
            await databasePool.query(`
                ALTER TABLE payment_requests 
                ADD COLUMN proof_image VARCHAR(255) NULL AFTER total_amount
            `);
            console.log('✅ Added proof_image to payment_requests');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ proof_image already exists in payment_requests');
            } else {
                console.error('❌ Failed to alter payment_requests:', e.message);
            }
        }

        // Add verification_status to payment_requests for better state tracking
        try {
            await databasePool.query(`
                ALTER TABLE payment_requests 
                ADD COLUMN verification_status ENUM('none', 'pending', 'verified', 'rejected') DEFAULT 'none' AFTER status
            `);
            console.log('✅ Added verification_status to payment_requests');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ verification_status already exists');
            } else {
                console.log('⚠️ Failed to add verification_status (might already exist):', e.message);
            }
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit(0);
    }
}

migrate();
