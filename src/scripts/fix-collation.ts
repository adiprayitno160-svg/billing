
import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const db = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function fixCollation() {
    console.log('🔧 Starting Database Collation Repair...');

    try {
        // Ambil semua tabel
        const [rows] = await db.query('SHOW TABLES');
        const tables = (rows as any[]).map(row => Object.values(row)[0]);

        console.log(`Found ${tables.length} tables to checking...`);

        // Matikan Foreign Key Check sebentar agar tidak error saat convert
        await db.query('SET FOREIGN_KEY_CHECKS = 0;');

        for (const table of tables) {
            console.log(`👉 Fixing table: ${table}...`);
            try {
                // Convert ke utf8mb4_unicode_ci (Standar Universal)
                await db.query(`ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
                console.log(`   ✅ Success: ${table}`);
            } catch (err: any) {
                console.error(`   ❌ Failed ${table}: ${err.message}`);
            }
        }

        // Nyalakan lagi Foreign Key Check
        await db.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('\n✅ All Done! Database collation normalized.');
    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        process.exit();
    }
}

fixCollation();
