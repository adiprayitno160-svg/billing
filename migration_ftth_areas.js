const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateFtthAreas() {
    console.log('🚀 Starting FTTH Area Migration...');

    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('✅ Connected to database.');

        // 1. Create ftth_areas table
        console.log('1️⃣ Creating table: ftth_areas');
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

        // 2. Add area_id to odcs table
        console.log('2️⃣ Updating odcs table...');
        const [columns] = await conn.execute("SHOW COLUMNS FROM odcs");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('area_id')) {
            console.log('   ➕ Adding area_id column to odcs');
            await conn.execute(`
                ALTER TABLE odcs 
                ADD COLUMN area_id INT NULL AFTER name,
                ADD CONSTRAINT fk_odc_area FOREIGN KEY (area_id) REFERENCES ftth_areas(id) ON DELETE SET NULL
            `);
        } else {
            console.log('   ℹ️ area_id column already exists');
        }

        // 3. Insert Default Area if empty (supaya tidak error data lama)
        const [areas] = await conn.execute("SELECT count(*) as count FROM ftth_areas");
        if (areas[0].count === 0) {
            console.log('3️⃣ Creating default area: "Uncategorized"');
            await conn.execute(`
                INSERT INTO ftth_areas (code, name, description) 
                VALUES ('DEFAULT', 'Wilayah Umum', 'Area default untuk ODC lama')
            `);

            // Update ODC lama ke default area
            const [defaultArea] = await conn.execute("SELECT id FROM ftth_areas WHERE code='DEFAULT'");
            await conn.execute("UPDATE odcs SET area_id = ? WHERE area_id IS NULL", [defaultArea[0].id]);
        }

        console.log('✨ FTTH Area Migration Completed Successfully!');
        await conn.end();

    } catch (error) {
        console.error('❌ Migration Failed:', error);
    }
}

migrateFtthAreas();
