import * as mysql from 'mysql2/promise';

async function searchAllDBs() {
    const configs = [
        { host: '127.0.0.1', user: 'root', password: '', database: 'information_schema' },
        { host: '127.0.0.1', user: 'root', password: 'adi', database: 'information_schema' }
    ];

    for (const config of configs) {
        try {
            const connection = await mysql.createConnection(config);
            const [dbs]: any = await connection.query("SHOW DATABASES");
            
            for (const db of dbs) {
                const dbName = db.Database;
                if (['information_schema', 'mysql', 'performance_schema', 'sys'].includes(dbName)) continue;

                try {
                    const [tables]: any = await connection.query(`SHOW TABLES FROM \`${dbName}\` LIKE 'customers'`);
                    if (tables.length > 0) {
                        const [rows]: any = await connection.query(`SELECT id, name FROM \`${dbName}\`.customers WHERE name LIKE '%Lusi%' OR name LIKE '%Sawo%'`);
                        if (rows.length > 0) {
                            console.log(`Found in database: ${dbName}`);
                            console.log(JSON.stringify(rows, null, 2));
                        }
                    }
                } catch (e) {}
            }
            await connection.end();
        } catch (e) {}
    }
}

searchAllDBs();
