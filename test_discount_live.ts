import { DiscountService } from './src/services/billing/discountService';
import { databasePool } from './src/db/pool';

async function test() {
    try {
        console.log('Testing DiscountService.applyDowntimeDiscount on invoice 352...');
        await DiscountService.applyDowntimeDiscount(352, 1, 'Test Diskon Gangguan via Script');
        console.log('Successfully applied discount!');

        const [rows]: any = await databasePool.query('SELECT discount_amount, total_amount, remaining_amount FROM invoices WHERE id = 352');
        console.log('Updated Invoice:', rows[0]);

        const [discountRows]: any = await databasePool.query('SELECT * FROM discounts WHERE invoice_id = 352');
        console.log('Discount Record:', discountRows[discountRows.length - 1]);

        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

test();
