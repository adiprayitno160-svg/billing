import { databasePool } from '../src/db/pool';

async function addMissingColumns() {
    try {
        console.log('🔧 Adding missing columns to subscriptions table...');
        const connection = await databasePool.getConnection();
        
        // Add activation_date column if it doesn't exist
        try {
            await connection.execute(
                `ALTER TABLE subscriptions ADD COLUMN activation_date DATE NULL`
            );
            console.log('✅ Added activation_date column');
        } catch (error: any) {
            if (error.message.includes('Duplicate column name')) {
                console.log('ℹ️ activation_date column already exists');
            } else {
                throw error;
            }
        }

        // Add is_activated column if it doesn't exist
        try {
            await connection.execute(
                `ALTER TABLE subscriptions ADD COLUMN is_activated BOOLEAN DEFAULT FALSE`
            );
            console.log('✅ Added is_activated column');
        } catch (error: any) {
            if (error.message.includes('Duplicate column name')) {
                console.log('ℹ️ is_activated column already exists');
            } else {
                throw error;
            }
        }

        // Add next_block_date column if it doesn't exist
        try {
            await connection.execute(
                `ALTER TABLE subscriptions ADD COLUMN next_block_date DATE NULL`
            );
            console.log('✅ Added next_block_date column');
        } catch (error: any) {
            if (error.message.includes('Duplicate column name')) {
                console.log('ℹ️ next_block_date column already exists');
            } else {
                throw error;
            }
        }

        // Add index for activation_date if it doesn't exist
        try {
            await connection.execute(
                `ALTER TABLE subscriptions ADD INDEX idx_activation_date (activation_date)`
            );
            console.log('✅ Added index for activation_date');
        } catch (error: any) {
            if (error.message.includes('Duplicate key name')) {
                console.log('ℹ️ Index for activation_date already exists');
            } else {
                throw error;
            }
        }

        // Add index for next_block_date if it doesn't exist
        try {
            await connection.execute(
                `ALTER TABLE subscriptions ADD INDEX idx_next_block_date (next_block_date)`
            );
            console.log('✅ Added index for next_block_date');
        } catch (error: any) {
            if (error.message.includes('Duplicate key name')) {
                console.log('ℹ️ Index for next_block_date already exists');
            } else {
                throw error;
            }
        }

        connection.release();
        console.log('✅ All missing columns added successfully!');
    } catch (error) {
        console.error('❌ Failed to add missing columns:', error);
    }
}

addMissingColumns();