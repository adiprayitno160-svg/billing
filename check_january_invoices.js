const mysql = require('mysql2/promise');

async function checkInvoices() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    try {
        console.log('=== Checking Invoices for January 2026 ===\n');

        // Get all invoices for January 2026
        const [invoices] = await connection.query(`
            SELECT 
                id, invoice_number, customer_id, status, 
                total_amount, paid_amount, remaining_amount,
                period, created_at
            FROM invoices 
            WHERE invoice_number LIKE 'INV/2026/01/%'
            ORDER BY invoice_number
        `);

        console.log(`Found ${invoices.length} invoice(s) for January 2026:\n`);

        if (invoices.length === 0) {
            console.log('No invoices found for this period.');
        } else {
            invoices.forEach((inv, i) => {
                console.log(`${i + 1}. ${inv.invoice_number}`);
                console.log(`   ID: ${inv.id}`);
                console.log(`   Customer ID: ${inv.customer_id}`);
                console.log(`   Status: ${inv.status}`);
                console.log(`   Total: Rp ${inv.total_amount.toLocaleString('id-ID')}`);
                console.log(`   Created: ${inv.created_at}`);
                console.log('');
            });
        }

        // Check specifically for INV/2026/01/0002
        console.log('\n=== Checking for INV/2026/01/0002 specifically ===');
        const [specific] = await connection.query(
            'SELECT * FROM invoices WHERE invoice_number = ?',
            ['INV/2026/01/0002']
        );

        if (specific.length === 0) {
            console.log('❌ INV/2026/01/0002 NOT FOUND in database');
            console.log('\nPossible reasons:');
            console.log('1. Invoice was already deleted');
            console.log('2. Invoice never existed');
            console.log('3. Invoice number is different (typo?)');
        } else {
            console.log('✓ Found INV/2026/01/0002');
        }

        // Check payments table for orphaned records
        console.log('\n=== Checking for orphaned payment records ===');
        const [orphanedPayments] = await connection.query(`
            SELECT p.* 
            FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            WHERE i.id IS NULL
            AND p.created_at >= '2026-01-01'
        `);

        if (orphanedPayments.length > 0) {
            console.log(`⚠️  Found ${orphanedPayments.length} orphaned payment(s):`);
            orphanedPayments.forEach(p => {
                console.log(`   Payment ID: ${p.id}, Invoice ID: ${p.invoice_id}, Amount: Rp ${p.amount.toLocaleString('id-ID')}`);
            });
        } else {
            console.log('✓ No orphaned payments found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkInvoices().catch(console.error);
