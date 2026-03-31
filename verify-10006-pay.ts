import * as mysql from 'mysql2/promise';
import { PaymentController } from './src/controllers/billing/paymentController';

async function verify() {
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'billing'
    });
    
    try {
        console.log('--- AUTO-APPROVE TEST (CUSTOMER 10006) ---');
        const [customer] = await conn.query<any[]>('SELECT id, name, is_isolated FROM customers WHERE id = 10006');
        console.log(`Target: ${customer[0].name} (Isolated: ${customer[0].is_isolated})`);
        
        const [invoices] = await conn.query<any[]>('SELECT id, remaining_amount, status FROM invoices WHERE id = 8905');
        const inv = invoices[0];
        console.log(`Processing invoice ID ${inv.id} for Rp ${inv.remaining_amount}`);
        
        const controller = new PaymentController();
        const mockReq = {
            ip: '127.0.0.1',
            session: { username: 'AI-Tester' },
            body: {
                invoice_id: inv.id,
                payment_amount: inv.remaining_amount,
                payment_method: 'cash',
                payment_type: 'full',
                notes: 'AUTO-APPROVE LUNAS VERIFICATION'
            }
        } as any;
        
        const mockRes = {
            status: (code: number) => ({ json: (data: any) => console.log(`Response ${code}:`, data) }),
            json: (data: any) => console.log('Response 200:', data)
        } as any;

        await (controller as any).processPayment(mockReq, mockRes);
        
        console.log('Waiting for background auto-restore (2s)...');
        await new Promise(r => setTimeout(r, 2000));
        
        const [customerFinal] = await conn.query<any[]>('SELECT is_isolated FROM customers WHERE id = 10006');
        console.log(`Final is_isolated status: ${customerFinal[0].is_isolated}`);
        
        await conn.end();
        process.exit(0);
    } catch (e: any) {
        console.error('TEST FAILED:', e.message);
        process.exit(1);
    }
}

verify();
