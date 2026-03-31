import { databasePool } from '../db/pool';
import { PaymentController } from '../controllers/billing/paymentController';

/**
 * MOCKING Request and Response for testing Controller method directly
 */
const mockReq: any = {
    session: {
        username: 'admin'
    }
};

async function testPayment() {
    console.log("Simulating payment for Invoice 847...");
    const conn = await databasePool.getConnection();
    try {
        // We'll simulate what the controller does in processPaymentTransaction
        // (but without many of the Express-specific ceremony)
        
        // Let's just call the actual controller instance if we can
        const controller = new PaymentController();
        
        // Note: processPaymentTransaction is PRIVATE, so we'll have to use @ts-ignore or make a hack
        // For testing, I'll just copy the logic or use a script that does the same steps.
        
        console.log("Acquired connection. Starting simulation...");
        
        const customerId = 847; // Wait, invoice ID is 847, customer ID for 847 is?
        // Let's find customer_id for invoice 847
        const [invs]: any = await conn.query('SELECT customer_id, remaining_amount FROM invoices WHERE id = ?', [847]);
        if (invs.length === 0) {
            console.error("Invoice 847 not found!");
            return;
        }
        const custId = invs[0].customer_id;
        const remaining = parseFloat(invs[0].remaining_amount);
        console.log(`Invoice 847 belongs to Customer ${custId}. Remaining: ${remaining}`);

        // Call the internal transaction logic (via @ts-ignore for testing only)
        // @ts-ignore
        const result = await (controller as any).processPaymentTransaction({
            conn,
            customerId: custId,
            selectedInvoiceIds: [847],
            amount: remaining,
            paymentMethod: 'cash',
            paymentDateStr: new Date().toISOString().split('T')[0],
            paymentType: 'lunas',
            notes: 'SYSTEM VERIFICATION TEST',
            kasirName: 'admin'
        });

        console.log("RESULT:", JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error("FAILURE:", err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        conn.release();
        await databasePool.end();
    }
}

testPayment();
