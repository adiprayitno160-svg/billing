/**
 * Hotfix 2.1.0.1: Customer Code Database Schema Fix
 * 
 * Issue: customer_code field doesn't allow NULL, causing import failures
 * Solution: Modify field to allow NULL with default value
 * 
 * Usage: node hotfix/2.1.0.1-fix.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function applyHotfix() {
    let connection;
    
    try {
        console.log('🔧 Hotfix 2.1.0.1: Customer Code Schema Fix');
        console.log('━'.repeat(60));
        console.log('');
        
        // Read database config from environment or use defaults
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        };
        
        console.log('🔌 Connecting to database...');
        console.log(`   Host: ${dbConfig.host}`);
        console.log(`   Database: ${dbConfig.database}`);
        console.log('');
        
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected successfully');
        console.log('');
        
        // Check current schema
        console.log('📋 Checking current schema...');
        const [currentSchema] = await connection.execute(`
            SELECT 
                COLUMN_NAME,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_KEY,
                COLUMN_DEFAULT
            FROM 
                INFORMATION_SCHEMA.COLUMNS
            WHERE 
                TABLE_SCHEMA = ?
                AND TABLE_NAME = 'customers'
                AND COLUMN_NAME = 'customer_code'
        `, [dbConfig.database]);
        
        if (currentSchema.length === 0) {
            throw new Error('customer_code column not found!');
        }
        
        const current = currentSchema[0];
        console.log('   Current state:');
        console.log(`   - Type: ${current.COLUMN_TYPE}`);
        console.log(`   - Nullable: ${current.IS_NULLABLE}`);
        console.log(`   - Key: ${current.COLUMN_KEY}`);
        console.log(`   - Default: ${current.COLUMN_DEFAULT || '(none)'}`);
        console.log('');
        
        // Check if fix is needed
        if (current.IS_NULLABLE === 'YES' && current.COLUMN_DEFAULT === null) {
            console.log('✅ Schema already fixed! No action needed.');
            console.log('');
            await connection.end();
            return;
        }
        
        // Apply fix
        console.log('🔧 Applying schema fix...');
        console.log('   Running: ALTER TABLE customers MODIFY COLUMN...');
        console.log('');
        
        await connection.execute(`
            ALTER TABLE customers 
            MODIFY COLUMN customer_code VARCHAR(191) UNIQUE NULL DEFAULT NULL
        `);
        
        console.log('✅ Schema modified successfully!');
        console.log('');
        
        // Verify the change
        console.log('🔍 Verifying changes...');
        const [newSchema] = await connection.execute(`
            SELECT 
                COLUMN_NAME,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_KEY,
                COLUMN_DEFAULT
            FROM 
                INFORMATION_SCHEMA.COLUMNS
            WHERE 
                TABLE_SCHEMA = ?
                AND TABLE_NAME = 'customers'
                AND COLUMN_NAME = 'customer_code'
        `, [dbConfig.database]);
        
        const updated = newSchema[0];
        console.log('   New state:');
        console.log(`   - Type: ${updated.COLUMN_TYPE}`);
        console.log(`   - Nullable: ${updated.IS_NULLABLE} ✅`);
        console.log(`   - Key: ${updated.COLUMN_KEY}`);
        console.log(`   - Default: ${updated.COLUMN_DEFAULT} ✅`);
        console.log('');
        
        // Update VERSION_HOTFIX file
        const versionFile = path.join(__dirname, '..', 'VERSION_HOTFIX');
        fs.writeFileSync(versionFile, '2.1.0.1\n');
        console.log('✅ VERSION_HOTFIX updated to 2.1.0.1');
        console.log('');
        
        console.log('━'.repeat(60));
        console.log('✅ Hotfix 2.1.0.1 applied successfully!');
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Restart application: pm2 restart billing-app');
        console.log('   2. Test Excel import with sample data');
        console.log('   3. Verify no errors in pm2 logs');
        console.log('');
        
    } catch (error) {
        console.error('');
        console.error('❌ Error applying hotfix:');
        console.error('   ', error.message);
        console.error('');
        console.error('📞 Support:');
        console.error('   - Check database connection settings');
        console.error('   - Ensure you have ALTER privileges');
        console.error('   - Try running SQL manually: hotfix/2.1.0.1-fix.sql');
        console.error('');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run hotfix
console.log('');
applyHotfix().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});


