const mysql = require('mysql2/promise');

async function checkInvoice() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    try {
        console.log('=== Checking Invoice INV/2026/01/0002 ===\n');

        // Get invoice details
        const [invoices] = await connection.query(
            'SELECT * FROM invoices WHERE invoice_number = ?',
            ['INV/2026/01/0002']
        );

        if (invoices.length === 0) {
            console.log('❌ Invoice not found!');
            return;
        }

        const invoice = invoices[0];
        console.log('📄 Invoice Details:');
        console.log(`   ID: ${invoice.id}`);
        console.log(`   Customer ID: ${invoice.customer_id}`);
        console.log(`   Status: ${invoice.status}`);
        console.log(`   Total: Rp ${invoice.total_amount.toLocaleString('id-ID')}`);
        console.log(`   Paid: Rp ${invoice.paid_amount.toLocaleString('id-ID')}`);
        console.log(`   Remaining: Rp ${invoice.remaining_amount.toLocaleString('id-ID')}`);
        console.log('');

        // Check payments
        const [payments] = await connection.query(
            'SELECT * FROM payments WHERE invoice_id = ?',
            [invoice.id]
        );
        console.log(`💰 Payments: ${payments.length} record(s)`);
        payments.forEach((p, i) => {
            console.log(`   ${i + 1}. Amount: Rp ${p.amount.toLocaleString('id-ID')} - Method: ${p.payment_method} - Status: ${p.status}`);
        });
        console.log('');

        // Check invoice items
        const [items] = await connection.query(
            'SELECT * FROM invoice_items WHERE invoice_id = ?',
            [invoice.id]
        );
        console.log(`📋 Invoice Items: ${items.length} record(s)`);
        items.forEach((item, i) => {
            console.log(`   ${i + 1}. ${item.description} - Rp ${item.total_price.toLocaleString('id-ID')}`);
        });
        console.log('');

        // Check discounts
        const [discounts] = await connection.query(
            'SELECT * FROM discounts WHERE invoice_id = ?',
            [invoice.id]
        );
        console.log(`🎫 Discounts: ${discounts.length} record(s)`);
        console.log('');

        // Check debt tracking
        const [debts] = await connection.query(
            'SELECT * FROM debt_tracking WHERE invoice_id = ?',
            [invoice.id]
        );
        console.log(`⚠️  Debt Tracking: ${debts.length} record(s)`);
        console.log('');

        // Check foreign key constraints
        console.log('🔒 Foreign Key Constraints:');
        const [fkPayments] = await connection.query(`
            SELECT 
                CONSTRAINT_NAME, 
                TABLE_NAME, 
                REFERENCED_TABLE_NAME,
                DELETE_RULE
            FROM information_schema.REFERENTIAL_CONSTRAINTS 
            WHERE TABLE_SCHEMA = 'billing' 
            AND REFERENCED_TABLE_NAME = 'invoices'
        `);

        if (fkPayments.length > 0) {
            console.log('   Tables referencing invoices:');
            fkPayments.forEach(fk => {
                console.log(`   - ${fk.TABLE_NAME} (${fk.CONSTRAINT_NAME}) - ON DELETE: ${fk.DELETE_RULE}`);
            });
        } else {
            console.log('   No foreign key constraints found');
        }
        console.log('');

        // Try to simulate deletion
        console.log('🧪 Simulating deletion process...');
        await connection.beginTransaction();

        try {
            await connection.query('DELETE FROM payments WHERE invoice_id = ?', [invoice.id]);
            console.log('   ✓ Payments deletion would succeed');

            await connection.query('DELETE FROM discounts WHERE invoice_id = ?', [invoice.id]);
            console.log('   ✓ Discounts deletion would succeed');

            await connection.query('DELETE FROM debt_tracking WHERE invoice_id = ?', [invoice.id]);
            console.log('   ✓ Debt tracking deletion would succeed');

            await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
            console.log('   ✓ Invoice items deletion would succeed');

            await connection.query('DELETE FROM invoices WHERE id = ?', [invoice.id]);
            console.log('   ✓ Invoice deletion would succeed');

            await connection.rollback();
            console.log('\n✅ RESULT: Invoice CAN be deleted (simulation successful)');
            console.log('   All related records can be removed without constraint violations.');

        } catch (error) {
            await connection.rollback();
            console.log(`\n❌ RESULT: Invoice CANNOT be deleted`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Code: ${error.code}`);
            if (error.sqlMessage) {
                console.log(`   SQL Message: ${error.sqlMessage}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkInvoice().catch(console.error);
