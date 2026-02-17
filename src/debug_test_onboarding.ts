
import { databasePool } from './db/pool';
import CustomerNotificationService from './services/customer/CustomerNotificationService';
import { WhatsAppSessionService } from './services/whatsapp/WhatsAppSessionService';
import { WhatsAppHandler } from './services/whatsapp/WhatsAppHandler';
import { UnifiedNotificationService } from './services/notification/UnifiedNotificationService';

async function testOnboardingFlow() {
    console.log('🚀 Starting Onboarding Flow Test...');

    try {
        // 1. Create a mock customer for testing
        const testCode = 'TEST-' + Math.floor(Math.random() * 10000);
        const testPhone = '6281234567890';

        console.log(`Step 1: Creating test customer ${testCode}...`);
        const [customerResult]: any = await databasePool.execute(
            'INSERT INTO customers (name, phone, customer_code, connection_type, status, address) VALUES (?, ?, ?, ?, ?, ?)',
            ['Pelanggan Test', testPhone, testCode, 'pppoe', 'active', 'Alamat Test Lama']
        );
        const customerId = customerResult.insertId;

        // 2. Trigger Welcome Notification
        console.log(`Step 2: Triggering welcome notification for ID ${customerId}...`);
        await CustomerNotificationService.sendWelcomeNotification({
            customerId,
            customerName: 'Pelanggan Test',
            customerCode: testCode,
            phone: testPhone,
            connectionType: 'pppoe',
            pppoeUsername: testCode,
            pppoePassword: 'password123',
            packageName: 'Paket 10Mbps'
        });

        // 3. Verify Session exists
        const session = await WhatsAppSessionService.getSession(testPhone);
        if (session && session.step === 'waiting_welcome_confirmation') {
            console.log('✅ Success: Session created with correct step.');
            console.log('Session Data:', JSON.stringify(session.data));
        } else {
            throw new Error(`❌ Failure: Session not found or wrong step. Got: ${session?.step}`);
        }

        // 4. Verify Notification Queue
        const [notifRows]: any = await databasePool.execute(
            'SELECT * FROM unified_notifications_queue WHERE customer_id = ? AND notification_type = "customer_created" ORDER BY id DESC LIMIT 1',
            [customerId]
        );
        if (notifRows.length > 0) {
            console.log('✅ Success: Notification queued.');
            console.log('Message Preview:', notifRows[0].message?.substring(0, 100) + '...');
        } else {
            throw new Error('❌ Failure: Notification not found in queue.');
        }

        // 5. Clean up
        console.log('Step 3: Cleaning up test data...');
        await databasePool.execute('DELETE FROM customers WHERE id = ?', [customerId]);
        await databasePool.execute('DELETE FROM unified_notifications_queue WHERE customer_id = ?', [customerId]);
        await WhatsAppSessionService.clearSession(testPhone);

        console.log('✨ TEST FINISHED: Backend logic for onboarding is OK.');
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
    } finally {
        process.exit(0);
    }
}

testOnboardingFlow();
