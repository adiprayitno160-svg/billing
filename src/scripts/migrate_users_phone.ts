import { databasePool } from '../db/pool';

async function migrate() {
    try {
        console.log("Migrating users table...");
        await databasePool.query("ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER email");
        console.log("Column 'phone' added to 'users' table.");
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column 'phone' already exists in 'users' table.");
        } else {
            console.error("Migration failed:", e);
        }
    }
    process.exit(0);
}

migrate();
