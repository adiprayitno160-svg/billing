
process.env.DISABLE_WHATSAPP = 'false';

import { databasePool } from '../db/pool';
import { IsolationService } from '../services/billing/isolationService';
import { PaymentShortageService } from '../services/billing/PaymentShortageService';
import { UnifiedNotificationService } from '../services/notification/UnifiedNotificationService';

async function main() {
    const TAGEN_ID = 179;

    console.log("=== STARTING TEST FOR CUSTOMER: TAGEN (ID: 179) ===");

    try {
        // 0. Ensure Templates
        console.log("0. Ensuring Templates...");
        // Clean old ones to handle duplicate keys if logic differs (or rely on template_code unique)
        // Better to rely on ON DUPLICATE KEY UPDATE if needed, but IGNORE is fine for test if codes match
        await databasePool.query(`
            INSERT IGNORE INTO notification_templates 
            (template_code, template_name, notification_type, channel, title_template, message_template, is_active) 
            VALUES 
            ('remind-auto-1', 'Invoice Reminder Test', 'invoice_reminder', 'whatsapp', 'Pengingat Tagihan', 'Halo {{customer_name}}, ini pengingat tagihan {{invoice_number}} sebesar Rp {{total_amount}} jatuh tempo pada {{due_date}}.', 1),
            ('block-auto-1', 'Service Blocked Test', 'service_blocked', 'whatsapp', 'Layanan Diblokir', 'Halo {{customer_name}}, Layanan internet Anda DIBLOKIR sementara karena tagihan belum lunas. {{details}}', 1),
            ('shortage-auto-1', 'Shortage Warning Test', 'payment_shortage_warning', 'whatsapp', 'Peringatan Kurang Bayar', 'Halo {{customer_name}}, Pembayaran diterima sebagian (Rp {{paid_amount}}). Sisa tagihan Rp {{remaining_amount}} mohon segera dilunasi.', 1),
            ('unblock-auto-1', 'Service Unblocked Test', 'service_unblocked', 'whatsapp', 'Layanan Aktif', 'Halo {{customer_name}}, Pembayaran diterima. Layanan internet Anda telah AKTIF kembali. {{details}}', 1)
        `);

        // 1. Reset State
        console.log("\n1. Resetting State...");
        await databasePool.query("UPDATE customers SET is_isolated = 0, status = 'active' WHERE id = ?", [TAGEN_ID]);
        await databasePool.query("DELETE FROM invoices WHERE customer_id = ? AND invoice_number = 'INV-TEST-TAGEN'", [TAGEN_ID]);
        await databasePool.query("DELETE FROM invoices WHERE customer_id = ? AND status != 'paid'", [TAGEN_ID]);
        await databasePool.query("DELETE FROM unified_notifications_queue WHERE customer_id = ?", [TAGEN_ID]);

        // Clean up payments related to test invoice if any exist (though we deleted invoice, cascade might not be on)
        // Just safe check

        // 2. Create Overdue Invoice
        console.log("\n2. Creating Overdue Invoice...");
        const invoiceRes = await databasePool.query("INSERT INTO invoices (customer_id, invoice_number, period, total_amount, remaining_amount, due_date, status) VALUES (?, 'INV-TEST-TAGEN', '2025-10', 100000, 100000, DATE_SUB(NOW(), INTERVAL 2 MONTH), 'overdue')", [TAGEN_ID]);
        const invoiceId = (invoiceRes[0] as any).insertId;
        console.log("   Invoice Created ID:", invoiceId);

        // 3. Test Notification: Reminder
        console.log("\n3. Testing Reminder Notification...");
        await UnifiedNotificationService.notifyInvoiceReminder(invoiceId);
        console.log("   Method called.");
        await checkQueue(TAGEN_ID, 'invoice_reminder');

        // 4. Test Isolation
        console.log("\n4. Testing Manual Isolation...");
        const isoResult = await IsolationService.isolateCustomer({
            customer_id: TAGEN_ID,
            action: 'isolate',
            reason: 'TEST AUTOMATION'
        });
        console.log("   Isolation Result:", isoResult);

        const [isoStatus] = await databasePool.query("SELECT is_isolated FROM customers WHERE id = ?", [TAGEN_ID]);
        console.log("   DB Isolation Status:", (isoStatus as any)[0].is_isolated);
        await checkQueue(TAGEN_ID, 'service_blocked');

        // 5. Test Partial Payment & Shortage Warning
        console.log("\n5. Testing Partial Payment (Shortage)...");
        await databasePool.query("INSERT INTO payments (invoice_id, amount, payment_date, payment_method) VALUES (?, 50000, NOW(), 'cash')", [invoiceId]);
        await databasePool.query("UPDATE invoices SET paid_amount = 50000, remaining_amount = 50000, status = 'partial' WHERE id = ?", [invoiceId]);

        // Force shortage check. PaymentShortageService checks active customers, so we temporarily un-isolate in DB
        await databasePool.query("UPDATE customers SET is_isolated = 0 WHERE id = ?", [TAGEN_ID]);

        await PaymentShortageService.checkAndNotifyShortages(0);
        console.log("   Shortage Check Complete.");
        await checkQueue(TAGEN_ID, 'payment_shortage_warning');

        // 6. Test Full Payment & Auto Unisolation
        console.log("\n6. Testing Full Payment & Auto Restore...");
        // Re-isolate to test restore
        await databasePool.query("UPDATE customers SET is_isolated = 1 WHERE id = ?", [TAGEN_ID]);

        await databasePool.query("INSERT INTO payments (invoice_id, amount, payment_date, payment_method) VALUES (?, 50000, NOW(), 'cash')", [invoiceId]);
        await databasePool.query("UPDATE invoices SET paid_amount = 100000, remaining_amount = 0, status = 'paid' WHERE id = ?", [invoiceId]);

        // Run auto restore
        const restoreResult = await IsolationService.autoRestorePaidCustomers();
        console.log("   Auto Restore Result:", restoreResult);

        const [isoStatus2] = await databasePool.query("SELECT is_isolated FROM customers WHERE id = ?", [TAGEN_ID]);
        console.log("   DB Isolation Status After Restore:", (isoStatus2 as any)[0].is_isolated);
        await checkQueue(TAGEN_ID, 'service_unblocked');

    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        // Cleanup optional? Maybe keep for user to inspect
        process.exit();
    }
}

async function checkQueue(customerId: number, type: string) {
    const [queue] = await databasePool.query(
        "SELECT id, notification_type, channel, status FROM unified_notifications_queue WHERE customer_id = ? AND notification_type = ? ORDER BY id DESC LIMIT 1",
        [customerId, type]
    );
    if ((queue as any[]).length > 0) {
        console.log(`   ✅ QUEUE CHECK: Found '${type}' status '${(queue as any)[0].status}'`);
    } else {
        console.log(`   ❌ QUEUE CHECK: '${type}' NOT FOUND!`);
    }
}

main();
