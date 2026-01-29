
import { createPool } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { getMikrotikConfig, removeIpAddress, removeMangleRulesForClient, getInterfaces, findIpAddressId } from './src/services/mikrotikService';

dotenv.config();

const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billing_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function run() {
    try {
        console.log('Searching for duplicate "Citra Diah" clients...');
        const [rows] = await pool.query<any[]>('SELECT * FROM static_ip_clients WHERE client_name LIKE ?', ['%Citra Diah%']);

        console.log(`Found ${rows.length} records.`);
        rows.forEach(r => console.log(`ID: ${r.id}, Name: ${r.client_name}, IP: ${r.ip_address}, Created: ${r.created_at}`));

        if (rows.length < 2) {
            console.log('No duplicates found/already fixed.');
            process.exit(0);
        }

        // Sort by ID descending (Latest first)
        const sorted = rows.sort((a, b) => b.id - a.id);
        const toDelete = sorted[0]; // Delete the newest one
        const keep = sorted[1]; // Keep the older one

        console.log(`\nDeleting Duplicate Client with ID: ${toDelete.id} (Latest)`);
        console.log(`Keeping Client with ID: ${keep.id}`);

        // 1. Delete from DB
        await pool.query('DELETE FROM static_ip_clients WHERE id = ?', [toDelete.id]);
        console.log('✅ Deleted from Database.');

        // 2. Mikrotik Cleanup (Optional: Check if we need to remove anything excessive)
        // Since it's a duplicate IP, both records likely point to the same Mikrotik Config.
        // We SHOULD NOT delete the IP/Queue from Mikrotik because the "Keep" client still needs it!
        // So just DB deletion is sufficient for duplicates of the SAME IP.

        if (toDelete.ip_address !== keep.ip_address) {
            console.log('⚠️ IPs are different! Attempting to clean up Mikrotik for the deleted IP...');
            const cfg = await getMikrotikConfig();
            if (cfg) {
                // Try remove IP specific to deleted client if different
                const ipId = await findIpAddressId(cfg, toDelete.ip_address);
                if (ipId) await removeIpAddress(cfg, ipId);
            }
        } else {
            console.log('ℹ️ IP Addresses are identical. Skipping Mikrotik deletion to preserve the active client.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
