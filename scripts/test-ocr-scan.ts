
import { databasePool } from '../src/db/pool';
import { PaymentVerificationService } from '../src/services/whatsapp/PaymentVerificationService';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
    console.log('🚀 Starting OCR AI verification test...');

    try {
        // 1. Setup Test Data
        console.log('📝 Setting up test data...');
        const testCustomerId = 9991;
        const testInvoiceId = 8881;
        const testAmount = 110000;

        // Ensure AI is enabled for testing
        await databasePool.query('UPDATE ai_settings SET enabled = 1 WHERE provider = "gemini"');
        console.log('✅ AI settings enabled for test');

        // Upsert test customer
        await databasePool.query(`
            INSERT INTO customers (id, name, phone, billing_mode, address) 
            VALUES (?, 'Test User OCR', '6289678630707', 'postpaid', 'Jl. Test No. 123')
            ON DUPLICATE KEY UPDATE name='Test User OCR'
        `, [testCustomerId]);

        // Create a fake subscription if needed (to satisfy foreign keys)
        // Check if there's a package first
        let packageId = 1;
        try {
            const [packages] = await databasePool.query<any[]>('SELECT id FROM pppoe_packages LIMIT 1');
            if (packages.length > 0) packageId = packages[0].id;
        } catch (e) {
            console.log('⚠️ Could not query pppoe_packages, using default ID 1');
        }

        await databasePool.query(`
            INSERT INTO subscriptions (id, customer_id, package_id, package_name, price, billing_cycle, start_date, end_date, status)
            VALUES (7771, ?, ?, 'Test Plan', 110000, 'monthly', NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), 'active')
            ON DUPLICATE KEY UPDATE status='active'
        `, [testCustomerId, packageId]);

        // Upsert test invoice
        await databasePool.query(`
            INSERT INTO invoices (id, invoice_number, customer_id, subscription_id, period, total_amount, paid_amount, remaining_amount, status, due_date)
            VALUES (?, 'INV/TEST/OCR/001', ?, 7771, '2026-01', ?, 0, ?, 'sent', NOW())
            ON DUPLICATE KEY UPDATE total_amount=?, remaining_amount=?, status='sent'
        `, [testInvoiceId, testCustomerId, testAmount, testAmount, testAmount, testAmount]);

        console.log(`✅ Test data prepared: Customer ${testCustomerId}, Invoice ${testInvoiceId}, Amount ${testAmount}`);

        // 2. Load test image
        const imagePath = path.join(__dirname, '../public/uploads/payments/proof-6289678630707-1768699497499.jpg');
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Test image not found at ${imagePath}`);
        }
        const imageBuffer = fs.readFileSync(imagePath);

        // 3. Run Automated Verification
        console.log('🔍 Running PaymentVerificationService.verifyPaymentProofAuto...');
        const result = await PaymentVerificationService.verifyPaymentProofAuto(
            { data: imageBuffer, mimetype: 'image/jpeg' },
            testCustomerId
        );

        console.log('\n📊 TEST RESULT:');
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ SUCCESS: Automatic verification worked!');
        } else {
            console.log('\n❌ FAILED: Automatic verification failed.');
            console.log('Error:', result.error);
        }

        // 4. Cleanup (Optional, but let's check invoice status first)
        const [invoiceStatus] = await databasePool.query<any[]>('SELECT status, paid_amount, remaining_amount FROM invoices WHERE id = ?', [testInvoiceId]);
        console.log('\n📄 Final Invoice Status:', invoiceStatus[0]);

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        process.exit();
    }
}

runTest();
