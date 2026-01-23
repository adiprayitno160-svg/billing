
import { databasePool } from './src/db/pool';

async function seedData() {
    try {
        console.log('Seeding dummy registration request...');
        await databasePool.query(`
            INSERT INTO registration_requests (name, address, phone, status, latitude, longitude, created_at) 
            VALUES ('Budi Santoso (Dummy)', 'Jl. Merpati No. 123, Desa Sukamaju', '081234567890', 'pending', -6.200000, 106.816666, NOW())
        `);
        console.log('Dummy data inserted.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

seedData();
