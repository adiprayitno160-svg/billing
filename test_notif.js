
const { default: CustomerNotificationService } = require('./src/services/customer/CustomerNotificationService');
const { databasePool } = require('./src/db/pool');

async function testNotification() {
    console.log('Testing Customer Notification...');
    try {
        const result = await CustomerNotificationService.notifyNewCustomer({
            customerId: 999999, // Fake ID
            customerName: 'Test User Antigravity',
            customerCode: 'TEST-001',
            phone: '08123456789', // Replace with a valid test number if possible, or use a safe dummy
            connectionType: 'pppoe',
            packageName: 'Test Package'
        });
        console.log('Result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // process.exit(0); // Pool might keep it open
    }
}

testNotification();
