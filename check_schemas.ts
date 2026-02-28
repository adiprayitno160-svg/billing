
import { databasePool } from './src/db/pool';

async function check() {
    try {
        const [rows] = await databasePool.query('SHOW CREATE TABLE subscriptions');
        console.log(JSON.stringify(rows, null, 2));

        const [rows2] = await databasePool.query('SHOW CREATE TABLE static_ip_packages');
        console.log(JSON.stringify(rows2, null, 2));

        const [rows3] = await databasePool.query('SHOW CREATE TABLE static_ip_clients');
        console.log(JSON.stringify(rows3, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
