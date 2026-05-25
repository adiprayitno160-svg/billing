require('ts-node/register');
const { ensureInitialSchema, databasePool } = require('./src/db/pool.ts');

async function run() {
    try {
        await ensureInitialSchema();
        console.log("Schema updated!");
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
