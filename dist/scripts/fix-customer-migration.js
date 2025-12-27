"use strict";
/**
 * Script untuk fix migrasi customer ke prepaid
 * Khusus untuk customer "ponakane kevin" dengan IP 192.168.5.2
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
const mikrotikConfigHelper_1 = require("../utils/mikrotikConfigHelper");
const MikrotikAddressListService_1 = __importDefault(require("../services/mikrotik/MikrotikAddressListService"));
async function fixCustomerMigration() {
    const customerId = 52; // ID untuk "Ponakanae kevin"
    const targetIP = '192.168.5.2';
    console.log('🔧 Starting migration fix for customer ID:', customerId);
    console.log('📌 Target IP:', targetIP);
    console.log('');
    try {
        // 1. Get customer info
        const [customerRows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (customerRows.length === 0) {
            throw new Error('Customer tidak ditemukan');
        }
        const customer = customerRows[0];
        console.log('✅ Customer found:');
        console.log('   Name:', customer.name);
        console.log('   Connection Type:', customer.connection_type);
        console.log('   Billing Mode:', customer.billing_mode);
        console.log('');
        // 2. Update atau tambahkan IP di static_ip_clients jika perlu
        const [ipRows] = await pool_1.databasePool.query('SELECT * FROM static_ip_clients WHERE customer_id = ? AND status = "active"', [customerId]);
        if (ipRows.length > 0) {
            console.log('📋 Current IP in database:', ipRows[0].ip_address);
            // IP sudah ada, lanjutkan dengan address list
        }
        else {
            console.log('⚠️  No IP found in static_ip_clients, akan menggunakan IP yang diberikan');
        }
        // 3. Get MikroTik config
        const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
        if (!config) {
            throw new Error('MikroTik configuration not found');
        }
        console.log('✅ MikroTik config found:', config.host);
        console.log('');
        // 4. Create address list service
        const addressListService = new MikrotikAddressListService_1.default({
            host: config.host,
            username: config.username,
            password: config.password,
            port: (config.api_port ?? config.port ?? 8728)
        });
        // 5. Normalize IP (remove CIDR if present)
        const ipOnly = targetIP.split('/')[0].trim();
        console.log('🔄 Normalized IP:', ipOnly);
        console.log('');
        // 6. Check current status
        console.log('📊 Checking current address list status...');
        const inNoPackage = await addressListService.isInAddressList('prepaid-no-package', ipOnly);
        const inActive = await addressListService.isInAddressList('prepaid-active', ipOnly);
        console.log('   In prepaid-no-package:', inNoPackage);
        console.log('   In prepaid-active:', inActive);
        console.log('');
        // 7. Remove from wrong list first
        if (inActive) {
            console.log('🧹 Removing IP from prepaid-active...');
            try {
                await addressListService.removeFromAddressList('prepaid-active', ipOnly);
                console.log('   ✅ Removed from prepaid-active');
            }
            catch (error) {
                console.warn('   ⚠️  Error removing from prepaid-active:', error.message);
            }
        }
        // 8. Add to prepaid-no-package if not already there
        if (!inNoPackage) {
            console.log('📝 Adding IP to prepaid-no-package...');
            try {
                const success = await addressListService.addToAddressList('prepaid-no-package', ipOnly, `Prepaid-Migrated - ${customer.name} - Portal: ${customer.portal_id || 'N/A'}`);
                if (success) {
                    console.log('   ✅ Successfully added to prepaid-no-package');
                    // Wait and verify
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const verified = await addressListService.isInAddressList('prepaid-no-package', ipOnly);
                    if (verified) {
                        console.log('   ✅ Verified: IP is now in prepaid-no-package list');
                    }
                    else {
                        console.warn('   ⚠️  Verification failed - but may be added');
                    }
                }
                else {
                    console.error('   ❌ Failed to add IP to prepaid-no-package');
                }
            }
            catch (error) {
                console.error('   ❌ Error adding IP:', error.message);
                throw error;
            }
        }
        else {
            console.log('✅ IP already in prepaid-no-package list');
        }
        console.log('');
        console.log('🎉 Migration fix completed!');
        console.log('');
        console.log('📌 Next steps:');
        console.log('   1. Customer harus refresh browser atau buka browser baru');
        console.log('   2. Browser akan otomatis redirect ke portal prepaid');
        console.log('   3. Customer login dengan Portal ID & PIN');
        console.log('   4. Customer pilih dan beli paket');
        console.log('');
        // 9. Get portal info if exists
        const [portalRows] = await pool_1.databasePool.query('SELECT portal_id FROM portal_customers WHERE customer_id = ?', [customerId]);
        if (portalRows.length > 0 && portalRows[0]) {
            console.log('📋 Portal Information:');
            console.log('   Portal ID:', portalRows[0].portal_id);
            console.log('   Portal URL: http://localhost:3000/prepaid/portal/login');
        }
        else {
            console.log('⚠️  No portal access found - customer may need portal ID & PIN generated');
        }
    }
    catch (error) {
        console.error('');
        console.error('❌ Error:', error.message);
        console.error('');
        process.exit(1);
    }
    finally {
        await pool_1.databasePool.end();
    }
}
// Run the script
fixCustomerMigration().catch(console.error);
//# sourceMappingURL=fix-customer-migration.js.map