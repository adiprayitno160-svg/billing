import { PaymentController } from './src/controllers/billing/paymentController';
import { databasePool } from './src/db/pool';

async function verify() {
    const controller = new PaymentController();
    
    // Simulate a request for customer 847
    // Need to find an UNPAID invoice for them first
    try {
        const [invoices] = await databasePool.query<any[]>(
            "SELECT id, remaining_amount FROM invoices WHERE customer_id = 847 AND status != 'paid' LIMIT 1"
        );
        
        if (invoices.length === 0) {
            console.log('Customer 847 has no unpaid invoices.');
            process.exit(0);
        }
        
        const inv = invoices[0];
        console.log(`Found unpaid invoice ${inv.id} with remaining ${inv.remaining_amount}`);
        
        const mockReq = {
            ip: '127.0.0.1',
            session: { username: 'test-admin' },
            body: {
                invoice_id: inv.id,
                payment_amount: inv.remaining_amount,
                payment_method: 'cash',
                payment_type: 'full',
                notes: 'Verification test'
            }
        } as any;
        
        const mockRes = {
            status: (code: number) => ({ json: (data: any) => console.log(`Response ${code}:`, data) }),
            json: (data: any) => console.log('Response 200:', data)
        } as any;
        
        console.log('Processing payment...');
        await (controller as any).processPayment(mockReq, mockRes);
        console.log('Payment processed.');
        
        // Wait a bit for background tasks
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        process.exit(0);
    } catch (error: any) {
        console.error('Verification failed:', error.message);
        process.exit(1);
    }
}

verify();
