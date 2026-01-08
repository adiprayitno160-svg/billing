
import { databasePool } from '../db/pool';

async function updateSchema() {
    try {
        console.log('Adding rental columns to customers table...');
        // Cek dulu apakah kolom sudah ada untuk menghindari error fatal jika script dijalankan ulang
        const [columns] = await databasePool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'billing'}' 
            AND TABLE_NAME = 'customers' 
            AND COLUMN_NAME = 'rental_mode'
        `);

        if ((columns as any[]).length === 0) {
            await databasePool.query(`
                ALTER TABLE customers
                ADD COLUMN rental_mode ENUM('flat', 'daily') DEFAULT 'flat' AFTER use_device_rental,
                ADD COLUMN rental_cost DECIMAL(12,2) DEFAULT NULL AFTER rental_mode
            `);
            console.log('Columns added successfully.');
        } else {
            console.log('Columns already exist, skipping.');
        }
    } catch (error: any) {
        console.error('Error updating schema:', error.message);
    }
    process.exit();
}

updateSchema();
