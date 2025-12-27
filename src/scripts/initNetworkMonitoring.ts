/**
 * Initialize Network Monitoring System
 * Run this script to setup database tables and sync initial data
 */

import { databasePool } from '../db/pool';
import { NetworkMonitoringService } from '../services/monitoring/NetworkMonitoringService';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
    console.log('🚀 Starting Network Monitoring System Setup...\n');

    try {
        // Read and execute SQL migration
        console.log('📋 Step 1: Creating database tables...');
        const sqlPath = path.join(__dirname, '..', 'db', 'migrations', 'create_network_monitoring_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

        for (const statement of statements) {
            try {
                await databasePool.query(statement);
            } catch (error: any) {
                // Ignore "table already exists" errors
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }
        console.log('✅ Database tables created successfully\n');

        // Initialize service
        console.log('📋 Step 2: Initializing monitoring service...');
        await NetworkMonitoringService.initialize();
        console.log('✅ Service initialized\n');

        // Sync FTTH infrastructure
        console.log('📋 Step 3: Syncing FTTH infrastructure (OLT, ODC, ODP)...');
        const ftthResult = await NetworkMonitoringService.syncFTTHInfrastructure();
        console.log(`✅ Synced ${ftthResult.added} new, ${ftthResult.updated} updated\n`);

        // Sync customers
        console.log('📋 Step 4: Syncing customer devices...');
        const customerResult = await NetworkMonitoringService.syncCustomerDevices();
        console.log(`✅ Synced ${customerResult.added} new, ${customerResult.updated} updated\n`);

        // Sync GenieACS devices
        console.log('📋 Step 5: Syncing GenieACS devices (ONTs)...');
        try {
            const genieacsResult = await NetworkMonitoringService.syncDevicesFromGenieACS();
            console.log(`✅ Synced ${genieacsResult.added} new, ${genieacsResult.updated} updated\n`);
        } catch (error) {
            console.log('⚠️  GenieACS sync failed (this is OK if GenieACS is not configured)\n');
        }

        // Auto-create links
        console.log('📋 Step 6: Auto-creating network links...');
        const linksCreated = await NetworkMonitoringService.autoCreateLinks();
        console.log(`✅ Created ${linksCreated} network links\n`);

        console.log('🎉 Network Monitoring System setup completed successfully!\n');
        console.log('📍 Access the monitoring page at: http://localhost:3000/monitoring/public/network-map\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

runMigration();
