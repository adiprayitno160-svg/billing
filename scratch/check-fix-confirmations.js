const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkAndFix() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    try {
        // 1. Cek semua payment_confirmations
        console.log('=== PAYMENT CONFIRMATIONS (Semua) ===');
        const [confirmations] = await pool.query(`
            SELECT pc.*, c.name as customer_name, c.isolation_enabled, c.is_isolated,
                   i.status as invoice_status, i.remaining_amount, i.period, i.due_date as inv_due_date
            FROM payment_confirmations pc
            JOIN customers c ON pc.customer_id = c.id
            LEFT JOIN invoices i ON pc.invoice_id = i.id
            ORDER BY pc.created_at DESC
            LIMIT 20
        `);

        for (const conf of confirmations) {
            console.log(`\n--- ${conf.customer_name} ---`);
            console.log(`  Confirmation ID: ${conf.id}`);
            console.log(`  Type: ${conf.type}`);
            console.log(`  Amount: Rp ${parseFloat(conf.amount).toLocaleString('id-ID')}`);
            console.log(`  Status Konfirmasi: ${conf.status}`);
            console.log(`  Due Date Janji: ${conf.due_date}`);
            console.log(`  Created: ${conf.created_at}`);
            console.log(`  Updated: ${conf.updated_at}`);
            console.log(`  --- Invoice ---`);
            console.log(`  Invoice Status: ${conf.invoice_status}`);
            console.log(`  Invoice Period: ${conf.period}`);
            console.log(`  Remaining: Rp ${parseFloat(conf.remaining_amount || 0).toLocaleString('id-ID')}`);
            console.log(`  Invoice Due Date: ${conf.inv_due_date}`);
            console.log(`  --- Customer ---`);
            console.log(`  Isolation Enabled: ${conf.isolation_enabled}`);
            console.log(`  Is Isolated: ${conf.is_isolated}`);
        }

        // 2. Cari yang sudah approved tapi invoice belum update
        console.log('\n\n=== PERLU DIFIX: approved tapi invoice belum janji_bayar ===');
        const [needFix] = await pool.query(`
            SELECT pc.*, c.name as customer_name, c.id as cust_id, c.isolation_enabled,
                   i.status as invoice_status, i.id as inv_id, pc.due_date as janji_due
            FROM payment_confirmations pc
            JOIN customers c ON pc.customer_id = c.id
            LEFT JOIN invoices i ON pc.invoice_id = i.id
            WHERE pc.status = 'approved' 
            AND pc.type = 'janji_bayar'
            AND i.status NOT IN ('janji_bayar', 'paid')
        `);

        if (needFix.length === 0) {
            console.log('Tidak ada yang perlu difix.');
        } else {
            for (const fix of needFix) {
                console.log(`\n  FIXING: ${fix.customer_name}`);
                console.log(`    Invoice #${fix.inv_id} status: "${fix.invoice_status}" -> "janji_bayar"`);
                console.log(`    Due date janji: ${fix.janji_due}`);
                
                // Fix invoice status
                await pool.query('UPDATE invoices SET status = ?, due_date = ?, updated_at = NOW() WHERE id = ?',
                    ['janji_bayar', fix.janji_due, fix.inv_id]);
                
                // Fix isolation_enabled
                await pool.query('UPDATE customers SET isolation_enabled = 1, updated_at = NOW() WHERE id = ?',
                    [fix.cust_id]);
                
                console.log(`    ✅ Fixed!`);
            }
        }

        // 3. Cari yang masih pending
        console.log('\n\n=== MASIH PENDING (belum balas SETUJU) ===');
        const [pending] = await pool.query(`
            SELECT pc.*, c.name as customer_name
            FROM payment_confirmations pc
            JOIN customers c ON pc.customer_id = c.id
            WHERE pc.status = 'pending'
            ORDER BY pc.created_at DESC
        `);

        if (pending.length === 0) {
            console.log('Tidak ada yang pending.');
        }
        for (const p of pending) {
            console.log(`  ${p.customer_name} - Type: ${p.type} - Rp ${parseFloat(p.amount).toLocaleString('id-ID')} - Created: ${p.created_at}`);
        }

        // 4. Cek WA message "setuju"
        console.log('\n\n=== PESAN WA "SETUJU" TERCATAT ===');
        const [waMessages] = await pool.query(`
            SELECT wbm.*, c.name as customer_name
            FROM whatsapp_bot_messages wbm
            LEFT JOIN customers c ON wbm.customer_id = c.id
            WHERE LOWER(wbm.message_content) LIKE '%setuju%'
            AND wbm.direction = 'inbound'
            ORDER BY wbm.created_at DESC
            LIMIT 10
        `);

        if (waMessages.length === 0) {
            console.log('Tidak ada pesan SETUJU tercatat.');
        }
        for (const msg of waMessages) {
            console.log(`  ${msg.customer_name || msg.phone_number} - "${msg.message_content}" - ${msg.created_at}`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkAndFix();
