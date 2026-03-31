
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

async function fixActiveSubscriptions() {
    console.log('🚀 Starting Fix Active Subscriptions Script...');

    try {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            // 1. Fix Customers Status (Inactive -> Active)
            // Exclude 'isolated' or 'terminated' if they exist, but generally 'inactive' means "not yet active"
            console.log('🔄 Fixing Customers Status...');
            const [custResult] = await conn.query<any>(
                "UPDATE customers SET status = 'active' WHERE status = 'inactive'"
            );
            console.log(`✅ Updated ${custResult.affectedRows} customers to 'active'.`);

            // 2. Fix Subscriptions Status
            console.log('🔄 Fixing Subscriptions Status...');
            // We only update subscriptions that belong to active customers
            const [subResult] = await conn.query<any>(
                `UPDATE subscriptions 
                 SET status = 'active' 
                 WHERE status != 'active' 
                 AND customer_id IN (SELECT id FROM customers WHERE status = 'active')`
            );
            console.log(`✅ Updated ${subResult.affectedRows} subscriptions to 'active'.`);

            // 3. Fix Static IP Clients Status
            console.log('🔄 Fixing Static IP Clients Status...');
            const [staticResult] = await conn.query<any>(
                `UPDATE static_ip_clients 
                  SET status = 'active' 
                  WHERE status != 'active' 
                  AND customer_id IN (SELECT id FROM customers WHERE status = 'active')`
            );
            console.log(`✅ Updated ${staticResult.affectedRows} static ip clients to 'active'.`);

            await conn.commit();
            console.log('🎉 Fix Script Completed Successfully!');

        } catch (err) {
            await conn.rollback();
            console.error('❌ Error during transaction:', err);
        } finally {
            conn.release();
        }

    } catch (error) {
        console.error('❌ Fatal Error:', error);
    } finally {
        process.exit();
    }
}

fixActiveSubscriptions();
