const mysql = require('mysql2/promise');

// Koneksi ke database SERVER LIVE
const DB_CONFIG = {
    host: '192.168.239.154',
    port: 3306,
    user: 'root',
    password: '',
    database: 'billing'
};

(async () => {
    let db;
    try {
        db = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Terhubung ke database server live: ' + DB_CONFIG.host);
    } catch (err) {
        console.error('❌ Gagal koneksi ke server live:', err.message);
        console.log('Mencoba dengan password lain...');
        try {
            DB_CONFIG.password = 'root';
            db = await mysql.createConnection(DB_CONFIG);
            console.log('✅ Terhubung dengan password "root"');
        } catch (err2) {
            console.error('❌ Gagal juga:', err2.message);
            process.exit(1);
        }
    }

    console.log('\n=== MENCARI DATA BU NANIK ===');
    
    // 1. Cari customer dengan nama nanik
    const [customers] = await db.query(
        "SELECT id, name, customer_code, status, is_isolated, isolation_enabled, is_deferred, connection_type, pppoe_username FROM customers WHERE name LIKE '%nanik%'"
    );
    console.log('\n1. DATA CUSTOMER:');
    console.log(JSON.stringify(customers, null, 2));

    if (customers.length === 0) {
        console.log('BU NANIK TIDAK DITEMUKAN! Cari semua customer aktif belum terisolir...');
        const [allActive] = await db.query(
            "SELECT id, name, customer_code, status, is_isolated, isolation_enabled, is_deferred FROM customers WHERE status = 'active' AND is_isolated = FALSE ORDER BY name LIMIT 50"
        );
        console.log(`\nTotal customer aktif belum terisolir: ${allActive.length}`);
        console.log(JSON.stringify(allActive, null, 2));
        await db.end();
        return;
    }

    const customerId = customers[0].id;
    const customer = customers[0];

    // 2. Cek invoice yang belum lunas
    console.log('\n2. INVOICE BELUM LUNAS:');
    const [invoices] = await db.query(
        "SELECT id, invoice_number, period, status, remaining_amount, due_date, created_at FROM invoices WHERE customer_id = ? AND status NOT IN ('paid', 'cancelled') ORDER BY period ASC",
        [customerId]
    );
    console.log(JSON.stringify(invoices, null, 2));

    // 3. Cek payment deferments
    console.log('\n3. PAYMENT DEFERMENTS:');
    const [deferments] = await db.query(
        "SELECT * FROM payment_deferments WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5",
        [customerId]
    );
    console.log(JSON.stringify(deferments, null, 2));

    // 4. Cek isolation logs
    console.log('\n4. ISOLATION LOGS (terakhir 10):');
    const [isoLogs] = await db.query(
        "SELECT id, action, reason, performed_by, mikrotik_username, mikrotik_response, created_at FROM isolation_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10",
        [customerId]
    );
    console.log(JSON.stringify(isoLogs, null, 2));

    // 5. Simulasi query autoIsolateOverdueCustomers
    console.log('\n5. SIMULASI QUERY autoIsolateOverdueCustomers:');
    const GRACE_PERIOD_DAYS = 3;
    const [overdueCheck] = await db.query(`
        SELECT 
            c.id, c.name, c.status, c.is_isolated, c.isolation_enabled, c.is_deferred,
            COUNT(i.id) as unpaid_count,
            GROUP_CONCAT(i.period ORDER BY i.period ASC) as periods,
            GROUP_CONCAT(i.status ORDER BY i.period ASC) as invoice_statuses,
            MAX(i.id) as latest_invoice_id,
            MIN(i.due_date) as oldest_due_date
        FROM customers c
        JOIN invoices i ON c.id = i.customer_id
        WHERE c.id = ?
        AND i.status NOT IN ('paid', 'partial', 'cancelled', 'hutang')
        AND i.period < DATE_FORMAT(CURDATE(), '%Y-%m')
        AND i.due_date < DATE_SUB(CURDATE(), INTERVAL ${GRACE_PERIOD_DAYS} DAY)
        AND c.is_isolated = FALSE
        AND c.is_deferred = FALSE
        AND c.status = 'active'
        AND c.isolation_enabled = 1
        AND NOT EXISTS (
            SELECT 1 FROM payment_deferments pd 
            WHERE pd.customer_id = c.id 
            AND pd.status IN ('pending', 'approved') 
            AND pd.deferred_until_date >= CURDATE()
        )
        GROUP BY c.id
    `, [customerId]);
    
    if (overdueCheck.length > 0) {
        console.log('✅ Bu Nanik MASUK ke query autoIsolateOverdueCustomers');
        console.log(JSON.stringify(overdueCheck, null, 2));
    } else {
        console.log('❌ Bu Nanik TIDAK MASUK ke query autoIsolateOverdueCustomers');
        
        // Diagnosa KENAPA tidak masuk
        console.log('\n--- DIAGNOSA KEGAGALAN ---');
        
        const checks = [
            { label: 'is_isolated', expect: 'FALSE (0)', actual: customer.is_isolated, pass: customer.is_isolated == 0 },
            { label: 'is_deferred', expect: 'FALSE (0)', actual: customer.is_deferred, pass: customer.is_deferred == 0 },
            { label: 'status', expect: 'active', actual: customer.status, pass: customer.status === 'active' },
            { label: 'isolation_enabled', expect: '1', actual: customer.isolation_enabled, pass: customer.isolation_enabled == 1 },
        ];
        
        for (const check of checks) {
            const icon = check.pass ? '✅ PASS' : '❌ GAGAL';
            console.log(`  ${icon}: ${check.label} = ${check.actual} (expected: ${check.expect})`);
        }
        
        // Cek detail invoice satu per satu
        const [invoiceCheck] = await db.query(`
            SELECT id, period, status, remaining_amount, due_date,
                   CASE WHEN status NOT IN ('paid', 'partial', 'cancelled', 'hutang') THEN 'PASS' ELSE 'FAIL' END as status_check,
                   CASE WHEN period < DATE_FORMAT(CURDATE(), '%Y-%m') THEN 'PASS' ELSE 'FAIL' END as period_check,
                   CASE WHEN due_date < DATE_SUB(CURDATE(), INTERVAL ${GRACE_PERIOD_DAYS} DAY) THEN 'PASS' ELSE 'FAIL' END as grace_check,
                   DATEDIFF(CURDATE(), due_date) as days_since_due
            FROM invoices
            WHERE customer_id = ?
            AND status NOT IN ('paid', 'cancelled')
            ORDER BY period ASC
        `, [customerId]);
        
        console.log('\n  Detail Invoice (belum lunas):');
        for (const inv of invoiceCheck) {
            console.log(`    Period: ${inv.period} | Status: ${inv.status} (${inv.status_check}) | Due: ${inv.due_date} (${inv.grace_check}, ${inv.days_since_due} hari) | Period<curMonth: ${inv.period_check} | Remaining: Rp ${inv.remaining_amount}`);
        }
        
        // Cek deferment aktif
        const [activeDeferments] = await db.query(
            "SELECT id, status, deferred_until_date FROM payment_deferments WHERE customer_id = ? AND status IN ('pending', 'approved') AND deferred_until_date >= CURDATE()",
            [customerId]
        );
        if (activeDeferments.length > 0) {
            console.log(`\n  ❌ ADA DEFERMENT AKTIF: ${JSON.stringify(activeDeferments)}`);
        } else {
            console.log('\n  ✅ Tidak ada deferment aktif');
        }
    }

    // 6. Simulasi query autoIsolatePreviousMonthUnpaid
    console.log('\n6. SIMULASI QUERY autoIsolatePreviousMonthUnpaid:');
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    console.log(`   Previous period: ${prevPeriod}`);

    const [prevMonthCheck] = await db.query(`
        SELECT DISTINCT c.id, c.name
        FROM customers c
        JOIN invoices i ON c.id = i.customer_id
        WHERE c.id = ?
        AND i.period = ?
        AND i.status NOT IN ('paid', 'partial', 'hutang')
        AND (i.due_date IS NULL OR i.due_date < CURDATE())
        AND c.is_isolated = FALSE
        AND c.is_deferred = FALSE
        AND c.status = 'active'
        AND c.isolation_enabled = 1
        AND NOT EXISTS (
            SELECT 1 FROM payment_deferments pd 
            WHERE pd.customer_id = c.id 
            AND pd.status IN ('pending', 'approved') 
            AND pd.deferred_until_date >= CURDATE()
        )
    `, [customerId, prevPeriod]);

    if (prevMonthCheck.length > 0) {
        console.log('✅ Bu Nanik MASUK ke query autoIsolatePreviousMonthUnpaid');
    } else {
        console.log('❌ Bu Nanik TIDAK MASUK ke query autoIsolatePreviousMonthUnpaid');
    }

    // 7. Cek scheduler settings
    console.log('\n7. SCHEDULER SETTINGS (auto_isolation):');
    const [schedulerSettings] = await db.query(
        "SELECT * FROM scheduler_settings WHERE task_name = 'auto_isolation'"
    );
    console.log(JSON.stringify(schedulerSettings, null, 2));

    // 8. Cek payment confirmations
    console.log('\n8. PAYMENT CONFIRMATIONS (terakhir 5):');
    const [payConfs] = await db.query(
        "SELECT id, status, type, amount, due_date, created_at, updated_at FROM payment_confirmations WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5",
        [customerId]
    );
    console.log(JSON.stringify(payConfs, null, 2));

    await db.end();
})().catch(err => {
    console.error('FATAL ERROR:', err.message);
    process.exit(1);
});
