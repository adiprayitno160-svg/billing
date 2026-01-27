
import { databasePool } from './src/db/pool';

async function checkColumns() {
    try {
        const [rows] = await databasePool.query("DESCRIBE subscriptions");
        console.log("Subscriptions Table Columns:");
        (rows as any[]).forEach(row => {
            console.log(`- ${row.Field} (${row.Type})`);
        });

        const [custRows] = await databasePool.query("DESCRIBE customers");
        console.log("\nCustomers Table Columns:");
        (custRows as any[]).forEach(row => {
            console.log(`- ${row.Field} (${row.Type})`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkColumns();
