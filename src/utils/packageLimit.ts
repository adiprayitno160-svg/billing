import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * Checks if a PPPoE package has reached its maximum client limit
 */
export async function isPppoePackageFull(packageId: number): Promise<boolean> {
    const [packages] = await databasePool.query<RowDataPacket[]>(
        'SELECT max_clients FROM pppoe_packages WHERE id = ?',
        [packageId]
    );

    if (packages.length === 0) return false;
    const maxClients = packages[0].max_clients;
    if (!maxClients || maxClients <= 0) return false;

    // Count active connections from customers table
    // (In this system, active PPPoE customers might be tracked in the customers table directly or via subscriptions)
    const [countResult] = await databasePool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count 
         FROM customers 
         WHERE status = 'active' AND connection_type = 'pppoe' 
         AND id IN (SELECT customer_id FROM subscriptions WHERE package_id = ? AND status = 'active')`,
        [packageId]
    );

    const currentClients = (countResult as any)[0].count;
    return currentClients >= maxClients;
}

/**
 * Checks if a Static IP package has reached its maximum client limit
 */
export async function isStaticIpPackageFull(packageId: number): Promise<boolean> {
    const [packages] = await databasePool.query<RowDataPacket[]>(
        'SELECT max_clients FROM static_ip_packages WHERE id = ?',
        [packageId]
    );

    if (packages.length === 0) return false;
    const maxClients = packages[0].max_clients;
    if (!maxClients || maxClients <= 0) return false;

    // Count active clients for Static IP
    const [countResult] = await databasePool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count 
         FROM static_ip_clients 
         WHERE package_id = ?`,
        [packageId]
    );

    const currentClients = (countResult as any)[0].count;
    return currentClients >= maxClients;
}
