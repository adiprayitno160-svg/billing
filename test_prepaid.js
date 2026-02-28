// Test Prepaid Purchase Flow
const { databasePool } = require('./dist/db/pool');

async function testPrepaidFlow() {
    try {
        console.log('=== TEST PREPAID FLOW ===\n');

        // 1. Get an active prepaid customer
        const [customers] = await databasePool.query(
            "SELECT id, name, phone, billing_mode, expiry_date FROM customers WHERE billing_mode = 'prepaid' LIMIT 1"
        );

        if (customers.length === 0) {
            console.log('❌ No prepaid customers found');
            process.exit(1);
        }

        const customer = customers[0];
        console.log('✅ Found prepaid customer:', customer.name, '(ID:', customer.id, ')');

        // 2. Get package
        const [packages] = await databasePool.query(
            `SELECT pp.id, pp.name, pp.price_30_days, pp.is_enabled_30_days
             FROM customers c
             LEFT JOIN pppoe_profiles pr ON c.pppoe_profile_id = pr.id
             LEFT JOIN pppoe_packages pp ON pr.id = pp.profile_id
             WHERE c.id = ? LIMIT 1`,
            [customer.id]
        );

        const pkg = packages[0];

        // 3. Generate payment request
        const { PrepaidService } = require('./dist/services/billing/PrepaidService');
        const duration = 30;

        console.log('\n--- Generating payment request ---');
        const result = await PrepaidService.generatePaymentRequest(customer.id, pkg ? pkg.id : 1, duration);

        if (!result.success) {
            console.log('❌ Failed to generate payment request:', result.message);
            process.exit(1);
        }

        const pr = result.paymentRequest;
        console.log('✅ Payment request created (ID:', pr.id, ')');

        // 4. Confirm payment
        console.log('\n--- Confirming payment ---');
        const confirmResult = await PrepaidService.confirmPayment(pr.id, null, 'manual_test');
        console.log('✅ Confirmation result:', confirmResult.success);

        // 5. Verify transaction was recorded
        const [transactions] = await databasePool.query(
            "SELECT id, amount, duration_days FROM prepaid_transactions WHERE payment_request_id = ?",
            [pr.id]
        );

        if (transactions.length > 0) {
            console.log('\n✅ Transaction RECORDED correctly in prepaid_transactions!');
            console.log('   Amount:', transactions[0].amount);
            console.log('   Duration:', transactions[0].duration_days);
        } else {
            console.log('\n❌ Transaction NOT recorded!');
            process.exit(1);
        }

        console.log('\n=== TEST PASSED ===');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testPrepaidFlow();
