
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrateDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('🔄 Checking pppoe_packages table columns...');
        const [columns] = await connection.query('DESCRIBE pppoe_packages');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('max_clients')) {
            console.log('➕ Adding max_clients column...');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN max_clients INT DEFAULT 1');
        } else {
            console.log('✅ max_clients column already exists.');
        }

        if (!columnNames.includes('limit_at_upload')) {
            console.log('➕ Adding limit_at_upload column...');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN limit_at_upload VARCHAR(50) NULL');
        }

        if (!columnNames.includes('limit_at_download')) {
            console.log('➕ Adding limit_at_download column...');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN limit_at_download VARCHAR(50) NULL');
        }

        console.log('✅ Migration completed.');

    } catch (err) {
        console.error('❌ Error during migration:', err);
    } finally {
        await connection.end();
    }
}

migrateDatabase();
