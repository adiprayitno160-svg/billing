
import { databasePool } from './src/db/pool';

async function seedSLA() {
    try {
        console.log('Seeding SLA for Customer 75 (Invoice 75)...');

        // Check if invoice exists to confirm customer ID
        const [inv] = await databasePool.query<any[]>('SELECT * FROM invoices WHERE id = 75');
        if (!inv || inv.length === 0) { console.log('Invoice not found'); return; }
        const customerId = inv[0].customer_id;

        // 2026-01-01 -> Period '2026-01'
        const period = '2026-01';

        console.log(`Inserting/Updating SLA record for Customer ${customerId}, Period ${period}`);

        await databasePool.query(`
            INSERT INTO sla_records (
                customer_id, period, downtime_minutes, incident_count, sla_percentage, 
                discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                downtime_minutes = VALUES(downtime_minutes),
                sla_percentage = VALUES(sla_percentage),
                discount_amount = VALUES(discount_amount)
        `, [
            customerId, period,
            120, // 2 hours down
            1,   // 1 incident
            99.50, // 99.5% uptime
            5000   // 5000 amount
        ]);

        console.log('Seed success!');
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

seedSLA();
