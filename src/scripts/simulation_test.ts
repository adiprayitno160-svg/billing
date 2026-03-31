
process.env.DISABLE_WHATSAPP = 'false'; // Set to true if you don't want actual WA attempts, but user asked for "simulasi notif"

import { databasePool } from '../db/pool';
import { UnifiedNotificationService } from '../services/notification/UnifiedNotificationService';
import { IsolationService } from '../services/billing/isolationService';
import { InvoiceService } from '../services/billing/invoiceService'; // Assuming this exists for helper
// If InvoiceService generic helper doesn't exist, we do direct DB

async function main() {
    console.log("==================================================================");
    console.log("   BILLING SYSTEM SIMULATION: BROADCAST, BLOCK, UNBLOCK, NOTIF    ");
    console.log("==================================================================");

    // 1. Setup Test Data
    console.log("\n[1/5] Setting up Test Customers...");
    const customerIds = await setupTestCustomers();
    console.log(`Created/Reset Test Customers: ${customerIds.join(', ')}`);

    // 2. Simulate Mass Billing Notification (New Invoice)
    console.log("\n[2/5] Simulating Mass Billing Notification (Invoice Created)...");
    const invoiceIds = await createInvoices(customerIds, 'new');
    console.log(`Created Invoices: ${invoiceIds.join(', ')}`);

    for (const invId of invoiceIds) {
        process.stdout.write(`   - Queuing 'Invoice Created' for ID ${invId}... `);
        await UnifiedNotificationService.notifyInvoiceCreated(invId);
        console.log("Done.");
    }

    console.log("   > Processing Queue (Sending)...");
    const sendResult1 = await UnifiedNotificationService.sendPendingNotifications();
    console.log("   > Result:", sendResult1);

    // 3. Simulate Pre-Due Reminder (H-3)
    console.log("\n[3/5] Simulating Pre-Due Reminder (H-3)...");
    await updateInvoicesDate(invoiceIds, 3); // Due in 3 days

    for (const invId of invoiceIds) {
        process.stdout.write(`   - Queuing 'Invoice Reminder' for ID ${invId}... `);
        await UnifiedNotificationService.notifyInvoiceReminder(invId);
        console.log("Done.");
    }

    console.log("   > Processing Queue (Sending)...");
    const sendResult2 = await UnifiedNotificationService.sendPendingNotifications();
    console.log("   > Result:", sendResult2);

    // 4. Simulate Overdue & Blocking (Jatuh Tempo & Blokir)
    console.log("\n[4/5] Simulating Overdue & Mass Blocking...");
    await updateInvoicesDate(invoiceIds, -5); // Overdue by 5 days
    // Force status to overdue
    await databasePool.query("UPDATE invoices SET status = 'overdue' WHERE id IN (?)", [invoiceIds]);

    // a) Overdue Notification
    console.log("   a) Sending Overdue Notifications...");
    for (const invId of invoiceIds) {
        process.stdout.write(`      - Queuing 'Invoice Overdue' for ID ${invId}... `);
        await UnifiedNotificationService.notifyInvoiceOverdue(invId);
        console.log("Done.");
    }
    await UnifiedNotificationService.sendPendingNotifications();

    // b) Mass Blocking
    console.log("   b) Running Mass Blocking (Auto Isolation)...");
    // Ensure customers are not isolated initially
    await databasePool.query("UPDATE customers SET is_isolated = 0 WHERE id IN (?)", [customerIds]);

    // NOTE: IsolationService.autoIsolateOverdueCustomers checks for >= 2 unpaid invoices usually, 
    // or specific grace period rules. Depending on implementation.
    // Let's create a SECOND overdue invoice to ensure they trigger the 2-invoice rule if exists.
    const invoiceIds2 = await createInvoices(customerIds, 'overdue_old');

    const blockResult = await IsolationService.autoIsolateOverdueCustomers();
    console.log("   > Block Result:", blockResult);

    // Verify Isolation
    const [custAfterBlock] = await databasePool.query("SELECT id, name, is_isolated FROM customers WHERE id IN (?)", [customerIds]);
    console.table(custAfterBlock);

    // 5. Simulate Payment & Unblocking
    console.log("\n[5/5] Simulating Payment & Mass Unblocking...");

    // Pay all invoices
    const allInvoices = [...invoiceIds, ...invoiceIds2];
    console.log(`   Paying invoices: ${allInvoices.join(', ')}...`);
    await databasePool.query("UPDATE invoices SET status = 'paid', remaining_amount = 0, paid_amount = total_amount WHERE id IN (?)", [allInvoices]);

    // Run Auto Restore
    console.log("   > Running Auto Restore...");
    const restoreResult = await IsolationService.autoRestorePaidCustomers();
    console.log("   > Restore Result:", restoreResult);

    // Verify Restoration
    const [custAfterRestore] = await databasePool.query("SELECT id, name, is_isolated FROM customers WHERE id IN (?)", [customerIds]);
    console.table(custAfterRestore);

    console.log("\n==================================================================");
    console.log("   SIMULATION COMPLETE");
    console.log("==================================================================");
    process.exit(0);
}

// --- Helpers ---

async function setupTestCustomers() {
    const customers = [
        { name: 'Simulasi User 1', email: 'sim1@example.com', phone: '628100000001', address: 'Test Addr 1' },
        { name: 'Simulasi User 2', email: 'sim2@example.com', phone: '628100000002', address: 'Test Addr 2' }
    ];
    const ids: number[] = [];

    for (const c of customers) {
        // Try to find
        const [rows]: any = await databasePool.query("SELECT id FROM customers WHERE email = ?", [c.email]);
        if (rows.length > 0) {
            ids.push(rows[0].id);
            // Reset status
            await databasePool.query("UPDATE customers SET status = 'active', is_isolated = 0 WHERE id = ?", [rows[0].id]);
            // Clean invoices
            await databasePool.query("DELETE FROM invoices WHERE customer_id = ?", [rows[0].id]);
        } else {
            const [res]: any = await databasePool.query(
                "INSERT INTO customers (name, email, phone, address, status, is_isolated, created_at) VALUES (?, ?, ?, ?, 'active', 0, NOW())",
                [c.name, c.email, c.phone, c.address]
            );
            ids.push(res.insertId);
        }
    }
    return ids;
}

async function createInvoices(customerIds: number[], type: 'new' | 'overdue_old') {
    const ids: number[] = [];
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // For 'overdue_old', use last month
    let targetPeriod = period;
    let dueDate = new Date();
    let status = 'unpaid';

    if (type === 'overdue_old') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        targetPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() - 35); // 35 days ago
        status = 'overdue';
    } else {
        dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days
    }

    for (const cid of customerIds) {
        const invNum = `INV-SIM-${type.toUpperCase()}-${cid}-${Date.now()}`;
        const [res]: any = await databasePool.query(
            "INSERT INTO invoices (customer_id, invoice_number, period, total_amount, remaining_amount, due_date, status, created_at) VALUES (?, ?, ?, 100000, 100000, ?, ?, NOW())",
            [cid, invNum, targetPeriod, dueDate, status]
        );
        ids.push(res.insertId);
    }
    return ids;
}

async function updateInvoicesDate(invoiceIds: number[], daysFromNow: number) {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysFromNow);
    await databasePool.query("UPDATE invoices SET due_date = ? WHERE id IN (?)", [newDate, invoiceIds]);
}

main().catch(console.error);
