import { databasePool } from './src/db/pool';

async function checkPool() {
    try {
        console.log('--- Pool Status ---');
        const pool = databasePool as any;
        console.log('Total Connections:', pool._allConnections?.length);
        console.log('Free Connections:', pool._freeConnections?.length);
        console.log('Acquiring Connections:', pool._acquiringConnections?.length);
        console.log('Connection Queue:', pool._connectionQueue?.length);
        
        // Try to get a connection
        console.log('Attempting to get connection...');
        const conn = await databasePool.getConnection();
        console.log('Successfully got connection!');
        conn.release();
        console.log('Connection released.');
        
        process.exit(0);
    } catch (error: any) {
        console.error('Failed to get connection:', error.message);
        process.exit(1);
    }
}

checkPool();
