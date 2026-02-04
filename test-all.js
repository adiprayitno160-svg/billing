require('dotenv').config();
const { IsolationService } = require('./dist/services/billing/isolationService');
const { InvoiceSchedulerService } = require('./dist/services/billing/invoiceSchedulerService');
const { databasePool } = require('./dist/db/pool');

async function run() {
    console.log('--- COMPREHENSIVE SSH TEST ---');
    console.log('Current Time:', new Date().toString());

    try {
        // [SETTINGS CHECK]
        const [settingsRows] = await databasePool.query("SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'");
        const config = settingsRows[0] ? (typeof settingsRows[0].config === 'string' ? JSON.parse(settingsRows[0].config) : settingsRows[0].config) : {};
        console.log('Isolation Date Setting:', config.isolir_date || '1 (Default)');

        // [1] Testing H-1 Isolation Warning Logic
        console.log('\n[1] Check: H-1 Isolation Warning Action...');
        const resultH1 = await IsolationService.sendIsolationH1Warnings();
        console.log('Execution Detail:', resultH1.skipped || 'Executed successfully');
        console.log('Result Summary:', JSON.stringify({ warned: resultH1.warned, failed: resultH1.failed }));

        // [2] Check Reminder Logic (22, 24, 26, 28, 30)
        console.log('\n[2] Check: Auto-Reminder Interval (Every 2 days from 22nd)...');
        const todayDay = new Date().getDate();
        const isTargetDay = (todayDay >= 22 && todayDay % 2 === 0);
        console.log(`Current Day: ${todayDay}. Is even & >= 22? ${isTargetDay}`);

        const [draftInvoices] = await databasePool.query('SELECT COUNT(*) as c FROM invoices WHERE status = "draft"');
        console.log(`Draft invoices found in DB: ${draftInvoices[0].c}`);

        if (isTargetDay) {
            console.log('Triggering InvoiceSchedulerService.runInvoiceReminders()...');
            // This will execute the actual logic (sending reminders if drafts exist)
            await InvoiceSchedulerService.runInvoiceReminders();
            console.log('Reminder function call finished.');
        } else {
            console.log('Skipping reminder execution (Not a scheduled day).');
        }
    } catch (e) {
        console.error('\n❌ CRITICAL ERROR DURING TEST:', e);
    }

    console.log('\n--- ALL TESTS FINISHED ---');
    process.exit(0);
}

run();
