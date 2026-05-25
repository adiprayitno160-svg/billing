import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env') });
process.env.DB_HOST = '127.0.0.1'; // Fix IPv6 issue in Node

import { InvoicePdfService } from './src/services/invoice/InvoicePdfService';

async function test() {
    try {
        console.log('Generating PDF...');
        const path = await InvoicePdfService.generateInvoicePdf(1);
        console.log('Success:', path);
    } catch (e) {
        console.error('Failed:', e);
    }
    process.exit(0);
}

test();
