"use strict";
/**
 * Test script untuk migration dari postpaid ke prepaid
 * Menggunakan MigrationServiceSimple
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../db/pool"));
const MigrationServiceSimple_1 = __importDefault(require("../services/customer/MigrationServiceSimple"));
async function testMigration() {
    console.log('🧪 Starting migration test...');
    console.log('');
    try {
        // Find a postpaid customer with static IP
        const [customers] = await pool_1.default.query(`
      SELECT c.id, c.name, c.billing_mode, c.connection_type
      FROM customers c
      WHERE c.billing_mode = 'postpaid' 
        AND c.connection_type = 'static_ip'
      LIMIT 1
    `);
        if (customers.length === 0) {
            console.log('⚠️  No postpaid static IP customers found');
            console.log('');
            console.log('Checking for prepaid customers that can be reset...');
            // Check for prepaid customers without portal
            const [prepaidCustomers] = await pool_1.default.query(`
        SELECT c.id, c.name, c.billing_mode, c.connection_type
        FROM customers c
        LEFT JOIN portal_customers pc ON c.id = pc.customer_id
        WHERE c.billing_mode = 'prepaid'
          AND c.connection_type = 'static_ip'
          AND pc.portal_id IS NULL
        LIMIT 1
      `);
            if (prepaidCustomers.length === 0) {
                console.log('❌ No suitable customers found for testing');
                console.log('');
                console.log('Please create or find a customer with:');
                console.log('  - billing_mode = postpaid');
                console.log('  - connection_type = static_ip');
                console.log('  - has entry in static_ip_clients table');
                process.exit(1);
            }
            else {
                console.log(`✅ Found candidate: ${prepaidCustomers[0].name} (ID: ${prepaidCustomers[0].id})`);
                console.log('   (Will reset to postpaid first)');
                const customer = prepaidCustomers[0];
                // Reset to postpaid first
                await pool_1.default.query('UPDATE customers SET billing_mode = ? WHERE id = ?', ['postpaid', customer.id]);
                console.log('✅ Reset to postpaid');
                console.log('');
                // Now test migration
                console.log('🔄 Testing migration to prepaid...');
                const result = await MigrationServiceSimple_1.default.migrateToPrepaid(customer.id, 1);
                console.log('');
                console.log('📊 Migration Result:');
                console.log('   Success:', result.success);
                console.log('   Message:', result.message);
                if (result.portal_id) {
                    console.log('   Portal ID:', result.portal_id);
                    if (result.portal_pin) {
                        console.log('   Portal PIN:', result.portal_pin);
                    }
                }
                process.exit(0);
            }
        }
        const customer = customers[0];
        console.log(`✅ Found test customer: ${customer.name} (ID: ${customer.id})`);
        console.log('');
        // Check if has static IP
        const [staticIp] = await pool_1.default.query(`
      SELECT ip_address FROM static_ip_clients WHERE customer_id = ? AND status = 'active' LIMIT 1
    `, [customer.id]);
        if (staticIp.length === 0) {
            console.log('⚠️  Customer has no active static IP');
            console.log('   Migration will still work, but Mikrotik setup will skip');
        }
        else {
            console.log(`✅ Customer has static IP: ${staticIp[0].ip_address}`);
        }
        console.log('');
        // Run migration
        console.log('🔄 Running migration...');
        console.log('');
        const result = await MigrationServiceSimple_1.default.migrateToPrepaid(customer.id, 1);
        console.log('');
        console.log('📊 Migration Result:');
        console.log('   Success:', result.success);
        console.log('   Message:', result.message);
        if (result.portal_id) {
            console.log('   Portal ID:', result.portal_id);
            if (result.portal_pin) {
                console.log('   Portal PIN:', result.portal_pin);
            }
        }
        if (result.error) {
            console.log('   Error:', result.error);
        }
        console.log('');
        if (result.success) {
            console.log('✅ Migration test PASSED');
        }
        else {
            console.log('❌ Migration test FAILED');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('');
        console.error('❌ Test error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
    finally {
        process.exit(0);
    }
}
// Run test
testMigration();
//# sourceMappingURL=test-migration-from-simple.js.map