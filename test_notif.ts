
import CustomerNotificationService from './src/services/customer/CustomerNotificationService';
import { databasePool } from './src/db/pool';

async function testNotification() {
    console.log('Testing Customer Notification...');
    try {
        const result = await CustomerNotificationService.notifyNewCustomer({
            customerId: 999999, // Fake ID - make sure this ID won't crash DB lookups if code actually checks DB
            customerName: 'Test User Antigravity',
            customerCode: 'TEST-001',
            phone: '08123456789', // Use a dummy number or your own testing number if permitted
            connectionType: 'pppoe',
            packageName: 'Test Package'
        });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error('Test failed:', error.message);
        console.error(error.stack);
    } finally {
        // Close pool to exit
        // databasePool.end(); // If end method exists
        process.exit(0);
    }
}

testNotification();
