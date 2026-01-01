const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixFtthTables() {
    console.log('🚀 Starting FTTH Table Fix...');

    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('✅ Connected to database.');

        // 1. Pastikan ftth_areas ada
        console.log('1️⃣ Checking table: ftth_areas');
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS ftth_areas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Add area_id to ftth_odc (TABLE YANG BENAR)
        console.log('2️⃣ Updating ftth_odc table...');
        try {
            const [columns] = await conn.execute("SHOW COLUMNS FROM ftth_odc");
            const columnNames = columns.map(c => c.Field);

            if (!columnNames.includes('area_id')) {
                console.log('   ➕ Adding area_id column to ftth_odc');
                await conn.execute(`
                    ALTER TABLE ftth_odc 
                    ADD COLUMN area_id INT NULL AFTER olt_id,
                    ADD CONSTRAINT fk_ftth_odc_area FOREIGN KEY (area_id) REFERENCES ftth_areas(id) ON DELETE SET NULL
                `);
            } else {
                console.log('   ℹ️ area_id column already exists in ftth_odc');
            }
        } catch (err) {
            console.error('   ❌ Error updating ftth_odc (maybe table missing?):', err.message);
        }

        console.log('✨ FTTH Table Fix Completed!');
        await conn.end();

    } catch (error) {
        console.error('❌ Migration Failed:', error);
    }
}

fixFtthTables();
