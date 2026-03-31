"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPppoePackageFull = isPppoePackageFull;
exports.isStaticIpPackageFull = isStaticIpPackageFull;
const pool_1 = require("../db/pool");
/**
 * Checks if a PPPoE package has reached its maximum client limit
 */
async function isPppoePackageFull(packageId) {
    const [packages] = await pool_1.databasePool.query('SELECT max_clients FROM pppoe_packages WHERE id = ?', [packageId]);
    if (packages.length === 0)
        return false;
    const maxClients = packages[0].max_clients;
    if (!maxClients || maxClients <= 0)
        return false;
    // Count active connections from customers table
    // (In this system, active PPPoE customers might be tracked in the customers table directly or via subscriptions)
    const [countResult] = await pool_1.databasePool.query(`SELECT COUNT(*) as count 
         FROM customers 
         WHERE status = 'active' AND connection_type = 'pppoe' 
         AND id IN (SELECT customer_id FROM subscriptions WHERE package_id = ? AND status = 'active')`, [packageId]);
    const currentClients = countResult[0].count;
    return currentClients >= maxClients;
}
/**
 * Checks if a Static IP package has reached its maximum client limit
 */
async function isStaticIpPackageFull(packageId) {
    const [packages] = await pool_1.databasePool.query('SELECT max_clients FROM static_ip_packages WHERE id = ?', [packageId]);
    if (packages.length === 0)
        return false;
    const maxClients = packages[0].max_clients;
    if (!maxClients || maxClients <= 0)
        return false;
    // Count active clients for Static IP
    const [countResult] = await pool_1.databasePool.query(`SELECT COUNT(*) as count 
         FROM static_ip_clients 
         WHERE package_id = ?`, [packageId]);
    const currentClients = countResult[0].count;
    return currentClients >= maxClients;
}
//# sourceMappingURL=packageLimit.js.map