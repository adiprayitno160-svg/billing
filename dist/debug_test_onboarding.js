"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./db/pool");
const CustomerNotificationService_1 = __importDefault(require("./services/customer/CustomerNotificationService"));
const WhatsAppSessionService_1 = require("./services/whatsapp/WhatsAppSessionService");
async function testOnboardingFlow() {
    console.log('🚀 Starting Onboarding Flow Test...');
    try {
        // 1. Create a mock customer for testing
        const testCode = 'TEST-' + Math.floor(Math.random() * 10000);
        const testPhone = '6281234567890';
        console.log(`Step 1: Creating test customer ${testCode}...`);
        const [customerResult] = await pool_1.databasePool.execute('INSERT INTO customers (name, phone, customer_code, connection_type, status, address) VALUES (?, ?, ?, ?, ?, ?)', ['Pelanggan Test', testPhone, testCode, 'pppoe', 'active', 'Alamat Test Lama']);
        const customerId = customerResult.insertId;
        // 2. Trigger Welcome Notification
        console.log(`Step 2: Triggering welcome notification for ID ${customerId}...`);
        await CustomerNotificationService_1.default.sendWelcomeNotification({
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
        const session = await WhatsAppSessionService_1.WhatsAppSessionService.getSession(testPhone);
        if (session && session.step === 'waiting_welcome_confirmation') {
            console.log('✅ Success: Session created with correct step.');
            console.log('Session Data:', JSON.stringify(session.data));
        }
        else {
            throw new Error(`❌ Failure: Session not found or wrong step. Got: ${session?.step}`);
        }
        // 4. Verify Notification Queue
        const [notifRows] = await pool_1.databasePool.execute('SELECT * FROM unified_notifications_queue WHERE customer_id = ? AND notification_type = "customer_created" ORDER BY id DESC LIMIT 1', [customerId]);
        if (notifRows.length > 0) {
            console.log('✅ Success: Notification queued.');
            console.log('Message Preview:', notifRows[0].message?.substring(0, 100) + '...');
        }
        else {
            throw new Error('❌ Failure: Notification not found in queue.');
        }
        // 5. Clean up
        console.log('Step 3: Cleaning up test data...');
        await pool_1.databasePool.execute('DELETE FROM customers WHERE id = ?', [customerId]);
        await pool_1.databasePool.execute('DELETE FROM unified_notifications_queue WHERE customer_id = ?', [customerId]);
        await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(testPhone);
        console.log('✨ TEST FINISHED: Backend logic for onboarding is OK.');
    }
    catch (error) {
        console.error('❌ TEST FAILED:', error);
    }
    finally {
        process.exit(0);
    }
}
testOnboardingFlow();
//# sourceMappingURL=debug_test_onboarding.js.map