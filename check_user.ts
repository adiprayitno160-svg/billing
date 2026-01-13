
import { db } from './src/db/pool';

async function checkUser() {
    try {
        console.log('Checking database for user 042010524015@id.net...');
        const [rows] = await db.query(
            "SELECT id, name, pppoe_username FROM customers WHERE pppoe_username LIKE '%042010524%'"
        );
        console.log('Found customers:', rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkUser();
