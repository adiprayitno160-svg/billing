
import { databasePool } from './src/db/pool';

async function run() {
    try {
        console.log('Creating registration_requests table...');
        const query = `
            CREATE TABLE IF NOT EXISTS registration_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                address TEXT,
                package_id INT,
                latitude VARCHAR(50),
                longitude VARCHAR(50),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await databasePool.query(query);
        console.log('✅ Table registration_requests created or already exists.');

        console.log('Inserting dummy data...');
        const insertQuery = `
            INSERT INTO registration_requests (name, phone, address, status, notes)
            SELECT 'Ahmad Contoh (Demo)', '6281234567890', 'Dusun I, RT 01/RW 01, Desa Sukamaju', 'pending', 'Mohon pasang segera'
            WHERE NOT EXISTS (SELECT 1 FROM registration_requests WHERE phone = '6281234567890');
        `;
        await databasePool.query(insertQuery);
        console.log('✅ Dummy data inserted.');

        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

run();
