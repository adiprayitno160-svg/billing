import { databasePool } from './src/db/pool';

async function checkConfig() {
    console.log('DB Config:', (databasePool as any).pool.config.connectionConfig.database);
    process.exit(0);
}

checkConfig();
