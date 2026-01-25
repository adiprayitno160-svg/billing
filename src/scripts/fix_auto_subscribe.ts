
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

async function fixAutoSubscribe() {
    console.log('🚀 Starting Auto-Subscribe Fix Script...');

    const conn = await databasePool.getConnection();
    try {
        // 1. Check table columns
        const [columns] = await conn.query<RowDataPacket[]>('SHOW COLUMNS FROM subscriptions');
        const columnNames = columns.map((c: any) => c.Field);
        console.log('📋 Subscriptions table columns:', columnNames.join(', '));

        const hasEndDate = columnNames.includes('end_date');
        const hasAutoRenew = columnNames.includes('is_auto_renewal') || columnNames.includes('auto_renew');
        const autoRenewCol = columnNames.includes('is_auto_renewal') ? 'is_auto_renewal' : (columnNames.includes('auto_renew') ? 'auto_renew' : null);

        // 2. Update logic for Auto-Subscribe
        // Definition: Auto-Subscribe means the subscription does not expire (end_date is NULL) OR auto_renew flag is ON.

        console.log('🔄 Updating active subscriptions to default Auto-Subscribe...');

        let updates = 0;

        // Condition: Status active, Connection type PPPoE (usually postpaid), and currently expiring.
        // We filter by customers.billing_mode != 'prepaid' (so postpaid or default)

        let query = `
            UPDATE subscriptions s
            JOIN customers c ON s.customer_id = c.id
            SET 
        `;

        const sets = [];
        if (hasEndDate) sets.push('s.end_date = NULL');
        if (autoRenewCol) sets.push(`s.${autoRenewCol} = 1`);

        if (sets.length === 0) {
            console.log('⚠️ No end_date or auto_renew column found. Nothing to update.');
        } else {
            query += sets.join(', ');
            query += `
                WHERE s.status = 'active'
                AND (c.billing_mode = 'postpaid' OR c.billing_mode IS NULL OR c.billing_mode = '')
                AND c.connection_type = 'pppoe'
            `;

            // Only update if not already setup correctly
            if (hasEndDate) query += ` AND s.end_date IS NOT NULL`;

            console.log('Executing query:', query);
            const [result] = await conn.query(query);
            updates = (result as any).affectedRows;
            console.log(`✅ Updated ${updates} subscriptions to Auto-Subscribe (end_date=NULL${autoRenewCol ? ', auto_renew=1' : ''}).`);
        }

        // 3. Optional: Listing customers without subscriptions for manual review
        console.log('🔍 Checking for active PPPoE customers without subscriptions...');
        const [missing] = await conn.query<RowDataPacket[]>(`
            SELECT c.id, c.name, c.pppoe_username
            FROM customers c
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
            WHERE c.status = 'active' 
            AND c.connection_type = 'pppoe'
            AND s.id IS NULL
        `);

        if (missing.length > 0) {
            console.log(`⚠️ Found ${missing.length} active PPPoE customers WITHOUT active subscription:`);
            missing.forEach((m: any) => console.log(`   - ID ${m.id}: ${m.name} (${m.pppoe_username})`));
            console.log('   (These customers rely on "Fallback" invoice generation currently. You may want to manually assign a package to them.)');
        } else {
            console.log('✅ All active PPPoE customers have active subscriptions.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        conn.release();
        process.exit(0);
    }
}

fixAutoSubscribe();
