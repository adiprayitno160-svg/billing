"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.DISABLE_WHATSAPP = 'false';
const pool_1 = require("../db/pool");
const isolationService_1 = require("../services/billing/isolationService");
const PaymentShortageService_1 = require("../services/billing/PaymentShortageService");
const UnifiedNotificationService_1 = require("../services/notification/UnifiedNotificationService");
async function main() {
    const TAGEN_ID = 179;
    console.log("=== STARTING TEST FOR CUSTOMER: TAGEN (ID: 179) ===");
    try {
        // 0. Ensure Templates
        console.log("0. Ensuring Templates...");
        // Clean old ones to handle duplicate keys if logic differs (or rely on template_code unique)
        // Better to rely on ON DUPLICATE KEY UPDATE if needed, but IGNORE is fine for test if codes match
        await pool_1.databasePool.query(`
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
        await pool_1.databasePool.query("UPDATE customers SET is_isolated = 0, status = 'active' WHERE id = ?", [TAGEN_ID]);
        await pool_1.databasePool.query("DELETE FROM invoices WHERE customer_id = ? AND invoice_number = 'INV-TEST-TAGEN'", [TAGEN_ID]);
        await pool_1.databasePool.query("DELETE FROM invoices WHERE customer_id = ? AND status != 'paid'", [TAGEN_ID]);
        await pool_1.databasePool.query("DELETE FROM unified_notifications_queue WHERE customer_id = ?", [TAGEN_ID]);
        // Clean up payments related to test invoice if any exist (though we deleted invoice, cascade might not be on)
        // Just safe check
        // 2. Create Overdue Invoice
        console.log("\n2. Creating Overdue Invoice...");
        const invoiceRes = await pool_1.databasePool.query("INSERT INTO invoices (customer_id, invoice_number, period, total_amount, remaining_amount, due_date, status) VALUES (?, 'INV-TEST-TAGEN', '2025-10', 100000, 100000, DATE_SUB(NOW(), INTERVAL 2 MONTH), 'overdue')", [TAGEN_ID]);
        const invoiceId = invoiceRes[0].insertId;
        console.log("   Invoice Created ID:", invoiceId);
        // 3. Test Notification: Reminder
        console.log("\n3. Testing Reminder Notification...");
        await UnifiedNotificationService_1.UnifiedNotificationService.notifyInvoiceReminder(invoiceId);
        console.log("   Method called.");
        await checkQueue(TAGEN_ID, 'invoice_reminder');
        // 4. Test Isolation
        console.log("\n4. Testing Manual Isolation...");
        const isoResult = await isolationService_1.IsolationService.isolateCustomer({
            customer_id: TAGEN_ID,
            action: 'isolate',
            reason: 'TEST AUTOMATION'
        });
        console.log("   Isolation Result:", isoResult);
        const [isoStatus] = await pool_1.databasePool.query("SELECT is_isolated FROM customers WHERE id = ?", [TAGEN_ID]);
        console.log("   DB Isolation Status:", isoStatus[0].is_isolated);
        await checkQueue(TAGEN_ID, 'service_blocked');
        // 5. Test Partial Payment & Shortage Warning
        console.log("\n5. Testing Partial Payment (Shortage)...");
        await pool_1.databasePool.query("INSERT INTO payments (invoice_id, amount, payment_date, payment_method) VALUES (?, 50000, NOW(), 'cash')", [invoiceId]);
        await pool_1.databasePool.query("UPDATE invoices SET paid_amount = 50000, remaining_amount = 50000, status = 'partial' WHERE id = ?", [invoiceId]);
        // Force shortage check. PaymentShortageService checks active customers, so we temporarily un-isolate in DB
        await pool_1.databasePool.query("UPDATE customers SET is_isolated = 0 WHERE id = ?", [TAGEN_ID]);
        await PaymentShortageService_1.PaymentShortageService.checkAndNotifyShortages(0);
        console.log("   Shortage Check Complete.");
        await checkQueue(TAGEN_ID, 'payment_shortage_warning');
        // 6. Test Full Payment & Auto Unisolation
        console.log("\n6. Testing Full Payment & Auto Restore...");
        // Re-isolate to test restore
        await pool_1.databasePool.query("UPDATE customers SET is_isolated = 1 WHERE id = ?", [TAGEN_ID]);
        await pool_1.databasePool.query("INSERT INTO payments (invoice_id, amount, payment_date, payment_method) VALUES (?, 50000, NOW(), 'cash')", [invoiceId]);
        await pool_1.databasePool.query("UPDATE invoices SET paid_amount = 100000, remaining_amount = 0, status = 'paid' WHERE id = ?", [invoiceId]);
        // Run auto restore
        const restoreResult = await isolationService_1.IsolationService.autoRestorePaidCustomers();
        console.log("   Auto Restore Result:", restoreResult);
        const [isoStatus2] = await pool_1.databasePool.query("SELECT is_isolated FROM customers WHERE id = ?", [TAGEN_ID]);
        console.log("   DB Isolation Status After Restore:", isoStatus2[0].is_isolated);
        await checkQueue(TAGEN_ID, 'service_unblocked');
    }
    catch (e) {
        console.error("ERROR:", e);
    }
    finally {
        // Cleanup optional? Maybe keep for user to inspect
        process.exit();
    }
}
async function checkQueue(customerId, type) {
    const [queue] = await pool_1.databasePool.query("SELECT id, notification_type, channel, status FROM unified_notifications_queue WHERE customer_id = ? AND notification_type = ? ORDER BY id DESC LIMIT 1", [customerId, type]);
    if (queue.length > 0) {
        console.log(`   ✅ QUEUE CHECK: Found '${type}' status '${queue[0].status}'`);
    }
    else {
        console.log(`   ❌ QUEUE CHECK: '${type}' NOT FOUND!`);
    }
}
main();
//# sourceMappingURL=test_automation_tagen.js.map