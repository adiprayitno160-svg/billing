
import { databasePool } from './src/db/pool';

async function findGhost() {
    const conn = await databasePool.getConnection();
    try {
        console.log('--- GHOST BUSTER SEARCH ---');
        const phone = '089678630707';

        console.log(`Searching by Phone: ${phone}`);
        const [rows]: any = await conn.query("SELECT * FROM customers WHERE phone LIKE ?", [`%${phone}%`]);
        console.log('Found by Phone:', rows.length, 'records');
        console.dir(rows, { depth: null });

        console.log('\nSearching by Name: Ponakanae');
        const [rowsName]: any = await conn.query("SELECT * FROM customers WHERE name LIKE '%Ponakan%'");
        console.log('Found by Name:', rowsName.length, 'records');
        console.dir(rowsName, { depth: null });

        // Cek koneksi DB
        const [dbName]: any = await conn.query('SELECT DATABASE() as db');
        console.log('\nCurrent Database Name:', dbName[0].db);

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

findGhost();
