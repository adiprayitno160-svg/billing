import { databasePool } from './src/db/pool';

async function searchAllTables() {
    try {
        const [tables]: any = await databasePool.query("SHOW TABLES");
        for (const tableRow of tables) {
            const tableName = Object.values(tableRow)[0] as string;
            try {
                const [cols]: any = await databasePool.query(`SHOW COLUMNS FROM \`${tableName}\``);
                const hasName = cols.some((c: any) => c.Field === 'name');
                const hasFullName = cols.some((c: any) => c.Field === 'full_name');
                const hasCustomerName = cols.some((c: any) => c.Field === 'customer_name');

                let query = "";
                if (hasName) query = `SELECT * FROM \`${tableName}\` WHERE name LIKE '%Lusi%'`;
                else if (hasFullName) query = `SELECT * FROM \`${tableName}\` WHERE full_name LIKE '%Lusi%'`;
                else if (hasCustomerName) query = `SELECT * FROM \`${tableName}\` WHERE customer_name LIKE '%Lusi%'`;

                if (query) {
                    const [rows]: any = await databasePool.query(query);
                    if (rows.length > 0) {
                        console.log(`Found in table: ${tableName}`);
                        console.log(JSON.stringify(rows, null, 2));
                    }
                }
            } catch (e) {}
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

searchAllTables();
