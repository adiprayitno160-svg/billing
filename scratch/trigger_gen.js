require('dotenv').config();
const { InvoiceSchedulerService } = require('./dist/services/billing/invoiceSchedulerService');
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        console.log('🚀 Manually triggering invoice generation for 2026-05...');
        const result = await InvoiceSchedulerService.triggerManualGeneration('2026-05');
        console.log('✅ Result:', JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

run();
