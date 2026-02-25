
import { databasePool } from './src/db/pool';

async function searchAllTables() {
    try {
        const [tables] = await databasePool.query('SHOW TABLES') as any;
        const tableNames = tables.map((t: any) => Object.values(t)[0]);

        for (const tableName of tableNames) {
            try {
                const [columns] = await databasePool.query(`SHOW COLUMNS FROM ${tableName}`) as any;
                const textColumns = columns
                    .filter((c: any) => (c.Type.includes('char') || c.Type.includes('text')) && c.Field !== 'image_data')
                    .map((c: any) => c.Field);

                if (textColumns.length === 0) continue;

                const whereClause = textColumns.map(col => `\`${col}\` LIKE '%Wildan%' OR \`${col}\` LIKE '%Yeni%'`).join(' OR ');
                const [rows] = await databasePool.query(`SELECT * FROM \`${tableName}\` WHERE ${whereClause}`) as any;

                if (rows.length > 0) {
                    console.log(`Found in table ${tableName}:`);
                    // Exclude image_data from display
                    const sanitizedRows = rows.map((r: any) => {
                        const { image_data, ...rest } = r;
                        return rest;
                    });
                    console.log(JSON.stringify(sanitizedRows, null, 2));
                }
            } catch (err) {
                // Skip tables that might not have text columns or other errors
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
searchAllTables();
