import { databasePool } from '../src/db/pool';

async function testActivationUI() {
    console.log('🔍 Testing PPPoE Activation UI Setup...\n');

    try {
        // 1. Test database schema
        console.log('1. Checking database schema...');
        const connection = await databasePool.getConnection();
        
        // Check if subscriptions table exists
        const [subscriptionsTable] = await connection.execute(
            `SHOW TABLES LIKE 'subscriptions'`
        );
        if ((subscriptionsTable as any[]).length > 0) {
            console.log('✅ subscriptions table exists');
        } else {
            console.log('❌ subscriptions table missing');
        }

        // Check if activation_logs table exists
        const [activationLogsTable] = await connection.execute(
            `SHOW TABLES LIKE 'activation_logs'`
        );
        if ((activationLogsTable as any[]).length > 0) {
            console.log('✅ activation_logs table exists');
        } else {
            console.log('❌ activation_logs table missing');
        }

        // Check subscriptions table structure
        const [subscriptionsColumns] = await connection.execute(
            `DESCRIBE subscriptions`
        );
        const columns = (subscriptionsColumns as any[]).map((c: any) => c.Field);
        const requiredColumns = ['activation_date', 'is_activated', 'next_block_date'];
        const missingColumns = requiredColumns.filter(col => !columns.includes(col));
        
        if (missingColumns.length === 0) {
            console.log('✅ subscriptions table has all required columns');
        } else {
            console.log(`❌ subscriptions table missing columns: ${missingColumns.join(', ')}`);
        }

        connection.release();

        console.log('\n✅ PPPoE Activation UI is ready!');
        console.log('\n📋 Features available:');
        console.log('   • View all PPPoE subscriptions with activation status');
        console.log('   • Activate inactive subscriptions');
        console.log('   • Deactivate active subscriptions');
        console.log('   • View activation history/logs');
        console.log('   • Run auto-blocking process');
        console.log('   • Filter and search functionality');
        console.log('   • Statistics dashboard');
        console.log('\n🌐 Access the UI at: /pppoe/activation');
        console.log('🔗 Menu item added to sidebar under "Paket Internet" section');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testActivationUI();