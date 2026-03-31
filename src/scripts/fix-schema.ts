import { databasePool } from '../db/pool';

async function fix() {
    try {
        console.log("Starting DB Schema Update...");
        // Use standard ALTER TABLE (IF NOT EXISTS is for entire table, for columns it might not work in all MySQL 8.x versions easily without procedure)
        // I'll check existence first
        const [columns]: any = await databasePool.query('SHOW COLUMNS FROM payments');
        const colNames = columns.map((c: any) => c.Field);
        
        const addIfMissing = async (col: string, definition: string) => {
            if (!colNames.includes(col)) {
                console.log(`Adding column: ${col}`);
                await databasePool.query(`ALTER TABLE payments ADD COLUMN ${col} ${definition}`);
            } else {
                console.log(`Column ${col} already exists.`);
            }
        };

        await addIfMissing('status', 'VARCHAR(50) DEFAULT "paid" AFTER amount');
        await addIfMissing('created_by', 'INT DEFAULT NULL AFTER notes');
        await addIfMissing('kasir_name', 'VARCHAR(100) DEFAULT NULL AFTER created_by');
        await addIfMissing('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

        console.log("DONE! Schema updated successfully.");
    } catch (err: any) {
        console.error("FAILURE:", err.message);
    } finally {
        await databasePool.end();
    }
}

fix();
