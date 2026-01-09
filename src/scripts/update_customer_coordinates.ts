/**
 * Script to update customer coordinates from their linked ODP
 * Run this to fix existing customers without coordinates
 */

import { databasePool } from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

async function updateCustomerCoordinates() {
    console.log('🔄 Starting customer coordinate update from ODP...\n');

    try {
        // Find customers without coordinates but with ODP assigned
        const [customers] = await databasePool.query<RowDataPacket[]>(`
            SELECT c.id, c.name, c.customer_code, c.odp_id, c.latitude, c.longitude,
                   o.latitude as odp_latitude, o.longitude as odp_longitude, o.name as odp_name
            FROM customers c
            LEFT JOIN ftth_odp o ON c.odp_id = o.id
            WHERE (c.latitude IS NULL OR c.longitude IS NULL OR c.latitude = 0 OR c.longitude = 0)
              AND c.odp_id IS NOT NULL
              AND o.latitude IS NOT NULL 
              AND o.longitude IS NOT NULL
        `);

        console.log(`📊 Found ${customers.length} customers without coordinates that have ODP assigned\n`);

        let updated = 0;
        let failed = 0;

        for (const customer of customers) {
            try {
                await databasePool.execute(
                    'UPDATE customers SET latitude = ?, longitude = ?, updated_at = NOW() WHERE id = ?',
                    [customer.odp_latitude, customer.odp_longitude, customer.id]
                );

                console.log(`✅ Updated: ${customer.name} (${customer.customer_code}) → ODP: ${customer.odp_name} (${customer.odp_latitude}, ${customer.odp_longitude})`);
                updated++;
            } catch (err: any) {
                console.error(`❌ Failed to update ${customer.name}: ${err.message}`);
                failed++;
            }
        }

        console.log('\n========================================');
        console.log('📊 SUMMARY');
        console.log('========================================');
        console.log(`✅ Updated: ${updated}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📍 Total processed: ${customers.length}`);

        // Now trigger network device sync
        console.log('\n🔄 Triggering network device sync...');

        const { NetworkMonitoringService } = await import('../services/monitoring/NetworkMonitoringService');
        const syncResult = await NetworkMonitoringService.syncCustomerDevices();

        console.log(`✅ Network sync complete: ${syncResult.added} added, ${syncResult.updated} updated`);

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await databasePool.end();
        console.log('\n✅ Done!');
        process.exit(0);
    }
}

updateCustomerCoordinates();
