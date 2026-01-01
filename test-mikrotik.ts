
import { databasePool } from './src/db/pool';
import { MikroTikConfig, testMikrotikConnection } from './src/services/mikrotikService';
import { getMikrotikConfig } from './src/services/pppoeService';

async function test() {
    try {
        console.log('Fetching MikroTik config...');
        const config = await getMikrotikConfig();
        if (!config) {
            console.error('❌ MikroTik config not found in database settings');
            process.exit(1);
        }

        console.log('Config found:', {
            host: config.host,
            port: config.port,
            username: config.username,
            use_tls: config.use_tls
        });

        const result = await testMikrotikConnection(config);
        if (result.connected) {
            console.log('✅ MikroTik connection SUCCESS');

            const { getPppoeActiveConnections } = await import('./src/services/mikrotikService');
            const sessions = await getPppoeActiveConnections(config);
            console.log('Active Sessions Count:', sessions.length);
            console.log('Active Sessions:', JSON.stringify(sessions, null, 2));

            const { getPppoeSecrets } = await import('./src/services/mikrotikService');
            const secrets = await getPppoeSecrets(config);
            console.log('Secrets Count:', secrets.length);
            console.log('Secrets (first 5):', JSON.stringify(secrets.slice(0, 5), null, 2));
        } else {
            console.error('❌ MikroTik connection FAILED:', result.error);
        }
    } catch (error) {
        console.error('❌ Uncaught error during test:', error);
    } finally {
        process.exit(0);
    }
}

test();
