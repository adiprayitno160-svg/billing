/**
 * Telegram Database Cleanup Script
 * 
 * Removes all telegram bot related data from database
 * 
 * Usage: node scripts/cleanup-telegram.js
 */

const mysql = require('mysql2/promise');

async function cleanupTelegramData() {
    let connection;
    
    try {
        console.log('🔌 Connecting to database...');
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('✅ Connected to database');
        console.log('');
        console.log('🧹 Starting Telegram data cleanup...');
        console.log('━'.repeat(60));
        console.log('');
        
        // List of telegram related tables to clean
        const tablesToClean = [
            'telegram_users',
            'telegram_messages',
            'telegram_sessions',
            'telegram_notifications',
            'telegram_commands',
            'telegram_subscriptions'
        ];
        
        let totalDeleted = 0;
        
        for (const table of tablesToClean) {
            try {
                // Check if table exists
                const [tables] = await connection.execute(
                    `SHOW TABLES LIKE ?`,
                    [table]
                );
                
                if (tables.length === 0) {
                    console.log(`⏭️  Table '${table}' not found - skipping`);
                    continue;
                }
                
                // Count records before delete
                const [countResult] = await connection.execute(
                    `SELECT COUNT(*) as count FROM ${table}`
                );
                const count = countResult[0].count;
                
                if (count === 0) {
                    console.log(`✓  Table '${table}' already empty`);
                    continue;
                }
                
                // Delete all records
                await connection.execute(`DELETE FROM ${table}`);
                
                // Reset auto_increment
                await connection.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
                
                totalDeleted += count;
                console.log(`✅ Cleaned '${table}': ${count} records deleted`);
                
            } catch (err) {
                console.log(`⚠️  Error cleaning '${table}': ${err.message}`);
            }
        }
        
        console.log('');
        console.log('━'.repeat(60));
        console.log(`\n✅ CLEANUP COMPLETE!`);
        console.log(`📊 Total records deleted: ${totalDeleted}`);
        console.log('');
        console.log('📝 Summary:');
        console.log('   - All telegram user data removed');
        console.log('   - All telegram messages removed');
        console.log('   - All telegram sessions cleared');
        console.log('   - Database tables reset');
        console.log('');
        console.log('🔄 Next steps:');
        console.log('   1. Restart application: pm2 restart billing-app');
        console.log('   2. Telegram bot will start fresh');
        console.log('   3. Users need to re-register with bot');
        console.log('');
        
    } catch (error) {
        console.error('');
        console.error('❌ Fatal error:');
        console.error('   ', error.message);
        console.error('');
        console.error('💡 Troubleshooting:');
        console.error('   - Check database connection settings');
        console.error('   - Ensure database exists');
        console.error('   - Verify database permissions');
        console.error('');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
            console.log('');
        }
    }
}

// Confirm before running
console.log('');
console.log('⚠️  WARNING: Telegram Database Cleanup');
console.log('━'.repeat(60));
console.log('');
console.log('This will DELETE ALL telegram bot data including:');
console.log('  • User registrations');
console.log('  • Chat history');
console.log('  • Sessions');
console.log('  • Notifications');
console.log('');
console.log('This action CANNOT be undone!');
console.log('');
console.log('Starting cleanup in 3 seconds...');
console.log('Press Ctrl+C to cancel');
console.log('');

setTimeout(() => {
    cleanupTelegramData();
}, 3000);


