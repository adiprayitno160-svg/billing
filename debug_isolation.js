const { databasePool } = require('./src/db/pool');

async function debug() {
    const conn = await databasePool.getConnection();
    try {
        console.log('--- CUSTOMER SEARCH: ADI WIYAHYA ---');
        const [customers] = await conn.query("SELECT id, name, customer_code, connection_type, pppoe_username, is_isolated FROM customers WHERE name LIKE '%adi wiyahya%'");
        console.log('Customers found:', customers.length);
        console.log(JSON.stringify(customers, null, 2));

        for (const customer of customers) {
            console.log(`\n--- RECENT ISOLATION LOGS FOR ${customer.name} (ID: ${customer.id}) ---`);
            const [logs] = await conn.query("SELECT * FROM isolation_logs WHERE customer_id = ? ORDER BY id DESC LIMIT 10", [customer.id]);
            console.log(JSON.stringify(logs, null, 2));

            console.log(`\n--- ACTIVE SUBSCRIPTIONS ---`);
            const [subs] = await conn.query("SELECT * FROM subscriptions WHERE customer_id = ? AND status = 'active'", [customer.id]);
            console.log(JSON.stringify(subs, null, 2));
        }

        console.log('\n--- MIKROTIK SETTINGS ---');
        const [mikrotik] = await conn.query("SELECT id, host, username, is_active FROM mikrotik_settings");
        console.log(JSON.stringify(mikrotik, null, 2));

    } catch (err) {
        console.error('DEBUG ERROR:', err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

debug();
