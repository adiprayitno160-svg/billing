"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const invoiceService_1 = require("../services/billing/invoiceService");
async function run() {
    try {
        console.log('Starting manual generation for 2026-03...');
        const ids = await invoiceService_1.InvoiceService.generateMonthlyInvoices('2026-03', undefined, true);
        console.log(`Success! Created ${ids.length} invoices.`);
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
run();
//# sourceMappingURL=test-gen.js.map