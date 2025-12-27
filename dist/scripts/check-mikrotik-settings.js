"use strict";
/**
 * Script untuk check dan fix Mikrotik settings di database
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../db/pool"));
async function checkAndFixMikrotikSettings() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 CHECK & FIX MIKROTIK SETTINGS');
    console.log('='.repeat(60) + '\n');
    try {
        // Step 1: Check all settings
        console.log('1. Checking all Mikrotik settings...\n');
        const [allSettings] = await pool_1.default.query('SELECT id, host, port, api_port, username, is_active, created_at FROM mikrotik_settings ORDER BY id DESC');
        console.log(`Found ${allSettings.length} settings:\n`);
        allSettings.forEach((s, idx) => {
            const isWrongIP = s.host === '192.168.5.1' || s.host?.startsWith('192.168.5.');
            const indicator = isWrongIP ? '❌' : (s.is_active ? '✅' : '⚪');
            console.log(`${indicator} #${idx + 1}: ID=${s.id}`);
            console.log(`   Host: ${s.host}`);
            console.log(`   Port: ${s.port || 'NULL'}`);
            console.log(`   API Port: ${s.api_port || 'NULL'}`);
            console.log(`   Username: ${s.username}`);
            console.log(`   Is Active: ${s.is_active}`);
            console.log(`   Created: ${s.created_at}`);
            if (isWrongIP) {
                console.log(`   ⚠️  WARNING: This IP looks like customer gateway IP (should be Mikrotik router IP)`);
            }
            console.log('');
        });
        // Step 2: Check active setting
        console.log('\n2. Checking active setting...\n');
        const [activeSettings] = await pool_1.default.query('SELECT * FROM mikrotik_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
        if (activeSettings.length === 0) {
            console.log('❌ No active Mikrotik setting found!\n');
            console.log('🔧 Attempting to fix...\n');
            // Activate latest setting
            if (allSettings.length > 0) {
                const latest = allSettings[0];
                await pool_1.default.query('UPDATE mikrotik_settings SET is_active = 1 WHERE id = ?', [latest.id]);
                console.log(`✅ Activated setting ID ${latest.id}`);
                // Check if IP is wrong
                if (latest.host === '192.168.5.1' || latest.host?.startsWith('192.168.5.')) {
                    console.log(`\n⚠️  Setting ID ${latest.id} has wrong IP (${latest.host})`);
                    console.log('   Need to update IP to correct Mikrotik router IP');
                    console.log('   Current IP looks like customer gateway, not Mikrotik router\n');
                }
            }
            else {
                console.log('❌ No settings found at all! Need to create one.\n');
            }
        }
        else {
            const active = activeSettings[0];
            console.log(`✅ Active setting found:\n`);
            console.log(`   ID: ${active.id}`);
            console.log(`   Host: ${active.host}`);
            console.log(`   Port: ${active.port || 'NULL'}`);
            console.log(`   API Port: ${active.api_port || 'NULL'}`);
            console.log(`   Username: ${active.username}\n`);
            // Check if IP is wrong
            const isWrongIP = active.host === '192.168.5.1' || active.host?.startsWith('192.168.5.');
            if (isWrongIP) {
                console.log('❌ PROBLEM DETECTED: Active setting has wrong IP!\n');
                console.log(`   Current IP: ${active.host}`);
                console.log(`   Issue: This looks like customer gateway IP, not Mikrotik router IP\n`);
                console.log('💡 SOLUTION:\n');
                console.log('   Run this SQL to fix:');
                console.log(`   UPDATE mikrotik_settings SET host = '192.168.239.222' WHERE id = ${active.id};\n`);
                console.log('   (Replace 192.168.239.222 with your actual Mikrotik router IP)\n');
            }
            else {
                console.log('✅ IP looks correct\n');
            }
        }
        // Step 3: Summary
        console.log('='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Settings: ${allSettings.length}`);
        console.log(`Active Settings: ${activeSettings.length}`);
        const wrongIPs = allSettings.filter((s) => s.host === '192.168.5.1' || s.host?.startsWith('192.168.5.'));
        if (wrongIPs.length > 0) {
            console.log(`❌ Settings with wrong IP: ${wrongIPs.length}`);
            wrongIPs.forEach((s) => {
                console.log(`   - ID ${s.id}: ${s.host} (${s.is_active ? 'ACTIVE' : 'inactive'})`);
            });
            console.log('\n⚠️  ACTION REQUIRED: Update IP Mikrotik di database!');
        }
        else {
            console.log('✅ No wrong IPs found');
        }
        console.log('='.repeat(60) + '\n');
    }
    catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
    finally {
        await pool_1.default.end();
        process.exit(0);
    }
}
checkAndFixMikrotikSettings().catch(console.error);
//# sourceMappingURL=check-mikrotik-settings.js.map