
import { databasePool } from './src/db/pool';

async function searchNames() {
    try {
        const names = ['Wildan', 'Wakhid', 'Yeni', 'Mayasari'];
        const [tables] = await databasePool.query('SHOW TABLES') as any;
        const tableNames = tables.map((t: any) => Object.values(t)[0]);

        for (const tableName of tableNames) {
            try {
                const [columns] = await databasePool.query(`SHOW COLUMNS FROM ${tableName}`) as any;
                const textColumns = columns
                    .filter((c: any) => (c.Type.includes('char') || c.Type.includes('text')) && c.Field !== 'image_data')
                    .map((c: any) => c.Field);

                if (textColumns.length === 0) continue;

                const conditions = names.map(n => textColumns.map(col => `\`${col}\` LIKE '%${n}%'`).join(' OR ')).join(' OR ');
                const [rows] = await databasePool.query(`SELECT * FROM \`${tableName}\` WHERE ${conditions}`) as any;

                if (rows.length > 0) {
                    console.log(`Found in table ${tableName}:`);
                    console.log(JSON.stringify(rows, null, 2));
                }
            } catch (err) { }
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
searchNames();
