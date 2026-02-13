/**
 * Advanced Monitoring Service
 * Handles optimized PPPoE and Static IP monitoring with:
 * - Efficient caching for performance
 * - Real-time offline detection (excluding isolated customers)
 * - Map clustering for nearby customers
 * - Audio notification triggers for offline alerts
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import CustomerNotificationService from './CustomerNotificationService';
import { getMikrotikConfig } from '../pppoeService';
import { getPppoeActiveConnections } from '../mikrotikService';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MonitoringCustomer {
    id: number;
    name: string;
    customer_code: string;
    connection_type: 'pppoe' | 'static_ip';
    latitude: number | null;
    longitude: number | null;
    is_isolated: boolean;
    pppoe_username?: string;
    static_ip?: string;
    phone?: string;
    area?: string;
    odp_name?: string;
    package_name?: string;
}

interface MonitoringStatus {
    customer_id: number;
    status: 'online' | 'offline' | 'degraded' | 'isolated' | 'unknown';
    last_check: Date;
    response_time_ms?: number;
    extra_info?: any;
}

interface OfflineAlertCustomer {
    id: number;
    name: string;
    customer_code: string;
    connection_type: string;
    status: string;
    offline_since?: Date;
    phone?: string;
    latitude?: number;
    longitude?: number;
}

// Cache for monitoring data
let monitoringCache: {
    pppoeOnlineSessions: Map<string, any>;
    staticIPStatus: Map<number, MonitoringStatus>;
    odpOfflineCustomers: Map<number, Set<number>>; // ODP ID -> Set of offline customer IDs
    odpAlertSent: Map<number, boolean>; // ODP ID -> whether mass alert has been sent
    lastRefresh: Date | null;
    refreshInterval: number; // ms
} = {
    pppoeOnlineSessions: new Map(),
    staticIPStatus: new Map(),
    odpOfflineCustomers: new Map(),
    odpAlertSent: new Map(),
    lastRefresh: null,
    refreshInterval: 10000 // Reduced to 10s for better "Live" feel
};

export class AdvancedMonitoringService {

    /**
     * Get all customers with status (Helper for both Map and ODP Problems)
     * Optimized for performance with caching
     */
    static async getAllCustomersWithStatus(requireCoordinates = false): Promise<{
        customers: any[];
        stats: {
            total: number;
            online: number;
            offline: number;
            isolated: number;
            pppoe: { total: number; online: number; offline: number };
            static_ip: { total: number; online: number; offline: number };
        };
    }> {
        try {
            await this.refreshCacheIfNeeded();

            let query = `
                SELECT 
                    c.id,
                    c.name,
                    c.customer_code,
                    c.connection_type,
                    c.latitude,
                    c.longitude,
                    c.is_isolated,
                    c.pppoe_username,
                    c.static_ip,
                    c.phone,
                    c.area,
                    c.odp_id,
                    odp.name as odp_name,
                    odp.latitude as odp_latitude,
                    odp.longitude as odp_longitude,
                    COALESCE(s.package_name, pp.name) as package_name
                FROM customers c
                LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
                WHERE c.status = 'active'
            `;

            if (requireCoordinates) {
                query += ` AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL`;
            }

            query += ` ORDER BY c.name`;

            const [customers] = await databasePool.query(query) as [RowDataPacket[], any];

            // Get Offline timestamps from DB efficiently for all customers
            const [offlineData] = await databasePool.query(`
                SELECT customer_id, last_online_at, last_offline_at, last_check 
                FROM static_ip_ping_status
            `) as [RowDataPacket[], any];

            const offlineMap = new Map();
            offlineData.forEach(d => offlineMap.set(d.customer_id, d));

            // Calculate status for each customer
            const customersWithStatus: any[] = customers.map((customer: any) => {
                let status: MonitoringStatus['status'] = 'unknown';
                let lastOfflineAt = null;
                let lastCheck = null;

                const dbOffline = offlineMap.get(customer.id);
                if (dbOffline) {
                    lastOfflineAt = dbOffline.last_offline_at;
                    lastCheck = dbOffline.last_check;
                }

                if (customer.is_isolated) {
                    status = 'isolated';
                } else if (customer.connection_type === 'pppoe') {
                    // Check PPPoE status from cache - CASE INSENSITIVE
                    let isOnline = false;
                    if (customer.pppoe_username) {
                        const searchTarget = customer.pppoe_username.toLowerCase();
                        // First try direct lookup for performance
                        if (monitoringCache.pppoeOnlineSessions.has(customer.pppoe_username)) {
                            isOnline = true;
                        } else {
                            // Scan for case-mismatch
                            for (const name of monitoringCache.pppoeOnlineSessions.keys()) {
                                if (name.toLowerCase() === searchTarget) {
                                    isOnline = true;
                                    break;
                                }
                            }
                        }
                    }
                    status = isOnline ? 'online' : 'offline';
                } else if (customer.connection_type === 'static_ip') {
                    // Check Static IP status from cache
                    const cachedStatus = monitoringCache.staticIPStatus.get(customer.id);
                    status = cachedStatus?.status || (dbOffline?.status as any) || 'unknown';
                    if (cachedStatus) lastCheck = cachedStatus.last_check;
                } else {
                    // Default for others
                    status = 'offline';
                }

                return {
                    id: customer.id,
                    name: customer.name,
                    customer_code: customer.customer_code,
                    pppoe_username: customer.pppoe_username,
                    connection_type: customer.connection_type,
                    latitude: customer.latitude ? parseFloat(customer.latitude) : null,
                    longitude: customer.longitude ? parseFloat(customer.longitude) : null,
                    status,
                    last_offline_at: lastOfflineAt,
                    last_check: lastCheck,
                    odp_name: customer.odp_name,
                    odp_latitude: customer.odp_latitude ? parseFloat(customer.odp_latitude) : null,
                    odp_longitude: customer.odp_longitude ? parseFloat(customer.odp_longitude) : null,
                    package_name: customer.package_name,
                    area: customer.area
                };
            });

            // Calculate stats
            const stats = {
                total: customersWithStatus.length,
                online: customersWithStatus.filter((c: any) => c.status === 'online').length,
                offline: customersWithStatus.filter((c: any) => c.status === 'offline' && !c.is_isolated).length,
                isolated: customersWithStatus.filter((c: any) => c.is_isolated).length,
                pppoe: {
                    total: customersWithStatus.filter((c: any) => c.connection_type === 'pppoe').length,
                    online: customersWithStatus.filter((c: any) => c.connection_type === 'pppoe' && c.status === 'online').length,
                    offline: customersWithStatus.filter((c: any) => c.connection_type === 'pppoe' && c.status === 'offline' && !c.is_isolated).length
                },
                static_ip: {
                    total: customersWithStatus.filter((c: any) => c.connection_type === 'static_ip').length,
                    online: customersWithStatus.filter((c: any) => c.connection_type === 'static_ip' && c.status === 'online').length,
                    offline: customersWithStatus.filter((c: any) => c.connection_type === 'static_ip' && c.status === 'offline' && !c.is_isolated).length
                }
            };

            return { customers: customersWithStatus, stats };
        } catch (error) {
            console.error('Error getting all customers with status:', error);
            throw error;
        }
    }

    /**
     * Get all customers for map display with status
     * Optimized for performance with caching
     */
    static async getCustomersForMap(forceRefresh = false): Promise<{
        customers: any[];
        stats: any;
    }> {
        if (forceRefresh) {
            await this.refreshCache();
        }
        return this.getAllCustomersWithStatus(true);
    }

    /**
     * Get offline customers for alarm notification
     * EXCLUDES isolated customers - they should not trigger alarms
     */
    static async getOfflineCustomersForAlarm(): Promise<OfflineAlertCustomer[]> {
        try {
            await this.refreshCacheIfNeeded();

            const [customers] = await databasePool.query(`
                SELECT 
                    c.id,
                    c.name,
                    c.customer_code,
                    c.connection_type,
                    c.latitude,
                    c.longitude,
                    c.phone,
                    c.pppoe_username,
                    c.static_ip,
                    sips.last_offline_at as static_ip_offline_since
                FROM customers c
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                WHERE c.status = 'active' 
                    AND (c.is_isolated = 0 OR c.is_isolated IS NULL)
            `) as [RowDataPacket[], any];

            const offlineCustomers: OfflineAlertCustomer[] = [];

            for (const customer of customers) {
                let isOffline = false;
                let offlineSince: Date | undefined;

                if (customer.connection_type === 'pppoe') {
                    // Check PPPoE status - CASE INSENSITIVE
                    let isOnline = false;
                    if (customer.pppoe_username) {
                        const searchTarget = customer.pppoe_username.toLowerCase();
                        if (monitoringCache.pppoeOnlineSessions.has(customer.pppoe_username)) {
                            isOnline = true;
                        } else {
                            for (const name of monitoringCache.pppoeOnlineSessions.keys()) {
                                if (name.toLowerCase() === searchTarget) {
                                    isOnline = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (isOnline) {
                        isOffline = false;
                    } else {
                        isOffline = true;
                    }
                } else if (customer.connection_type === 'static_ip') {
                    // Check Static IP status
                    const cachedStatus = monitoringCache.staticIPStatus.get(customer.id);
                    if (cachedStatus?.status === 'offline') {
                        isOffline = true;
                        offlineSince = customer.static_ip_offline_since;
                    }
                }

                if (isOffline) {
                    offlineCustomers.push({
                        id: customer.id,
                        name: customer.name,
                        customer_code: customer.customer_code,
                        connection_type: customer.connection_type,
                        status: 'offline',
                        offline_since: offlineSince,
                        phone: customer.phone,
                        latitude: customer.latitude,
                        longitude: customer.longitude
                    });
                }
            }

            return offlineCustomers;
        } catch (error) {
            console.error('Error getting offline customers for alarm:', error);
            return [];
        }
    }

    /**
     * Get nearby customers to a specific location
     * For map "fly to nearest customer" feature
     */
    static async getNearbyCustomers(
        latitude: number,
        longitude: number,
        radiusKm: number = 1,
        limit: number = 10
    ): Promise<any[]> {
        try {
            // Using Haversine formula for distance calculation
            const [customers] = await databasePool.query(`
                SELECT 
                    c.*,
                    odp.name as odp_name,
                    (
                        6371 * acos(
                            cos(radians(?)) * cos(radians(c.latitude)) * 
                            cos(radians(c.longitude) - radians(?)) + 
                            sin(radians(?)) * sin(radians(c.latitude))
                        )
                    ) AS distance_km
                FROM customers c
                LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                WHERE c.latitude IS NOT NULL 
                    AND c.longitude IS NOT NULL
                HAVING distance_km <= ?
                ORDER BY distance_km ASC
                LIMIT ?
            `, [latitude, longitude, latitude, radiusKm, limit]) as [RowDataPacket[], any];

            return customers;
        } catch (error) {
            console.error('Error getting nearby customers:', error);
            return [];
        }
    }

    /**
     * Force refresh monitoring cache
     */
    static async refreshCache(): Promise<void> {
        console.log('[AdvancedMonitoringService] Refreshing monitoring cache...');

        try {
            // Refresh PPPoE sessions
            const mikrotikConfig = await getMikrotikConfig();
            if (mikrotikConfig) {
                const sessions = await getPppoeActiveConnections(mikrotikConfig);
                monitoringCache.pppoeOnlineSessions.clear();
                sessions.forEach((session: any) => {
                    monitoringCache.pppoeOnlineSessions.set(session.name, session);
                });
                console.log(`[AdvancedMonitoringService] Cached ${sessions.length} PPPoE sessions`);
            }

            // Refresh Static IP status from database
            const [staticIPStatus] = await databasePool.query(`
                SELECT 
                    customer_id,
                    status,
                    response_time_ms,
                    last_check
                FROM static_ip_ping_status
            `) as [RowDataPacket[], any];

            monitoringCache.staticIPStatus.clear();
            staticIPStatus.forEach((status: any) => {
                monitoringCache.staticIPStatus.set(status.customer_id, {
                    customer_id: status.customer_id,
                    status: status.status || 'unknown',
                    last_check: status.last_check,
                    response_time_ms: status.response_time_ms
                });
            });
            console.log(`[AdvancedMonitoringService] Cached ${staticIPStatus.length} Static IP statuses`);

            monitoringCache.lastRefresh = new Date();
        } catch (error) {
            console.error('[AdvancedMonitoringService] Error refreshing cache:', error);
        }
    }

    /**
     * Refresh cache if stale
     */
    static async refreshCacheIfNeeded(): Promise<void> {
        const now = Date.now();
        const lastRefresh = monitoringCache.lastRefresh?.getTime() || 0;

        if (now - lastRefresh > monitoringCache.refreshInterval) {
            await this.refreshCache();
        }
    }

    /**
     * Batch ping multiple IPs for Static IP monitoring
     * More efficient than doing one-by-one
     */
    static async batchPingStaticIPs(ips: string[]): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>();
        const isWindows = process.platform === 'win32';

        // Process in parallel batches of 10
        const batchSize = 10;
        for (let i = 0; i < ips.length; i += batchSize) {
            const batch = ips.slice(i, i + batchSize);

            await Promise.all(batch.map(async (ip) => {
                try {
                    const pingCommand = isWindows
                        ? `ping -n 1 -w 2000 ${ip}`
                        : `ping -c 1 -W 2 ${ip}`;

                    const { stdout } = await execAsync(pingCommand, { timeout: 5000 });
                    const output = stdout.toLowerCase();
                    const success = output.includes('ttl=') ||
                        (output.includes('reply from') && !output.includes('unreachable'));

                    results.set(ip, success);
                } catch (error) {
                    results.set(ip, false);
                }
            }));
        }

        return results;
    }

    /**
     * Run optimized monitoring cycle
     */
    static async runOptimizedMonitoringCycle(): Promise<{
        pppoe_checked: number;
        static_ip_checked: number;
        offline_alerts: number;
    }> {

        const startTime = Date.now();
        const result = {
            pppoe_checked: 0,
            static_ip_checked: 0,
            offline_alerts: 0
        };

        try {
            const mikrotikConfig = await getMikrotikConfig();

            if (mikrotikConfig) {
                try {
                    const sessions = await getPppoeActiveConnections(mikrotikConfig);
                    monitoringCache.pppoeOnlineSessions.clear();
                    if (Array.isArray(sessions)) {
                        sessions.forEach((session: any) => {
                            monitoringCache.pppoeOnlineSessions.set(session.name, session);
                        });
                        result.pppoe_checked = sessions.length;
                    }
                } catch (err) {
                    console.error('[AdvancedMonitoringService] Failed to get PPPoE sessions:', err);
                    // Clear cache on error to avoid stale "online" status
                    monitoringCache.pppoeOnlineSessions.clear();
                }
            } else {
                // No config = no one is online via PPPoE
                monitoringCache.pppoeOnlineSessions.clear();
            }

            // 2. Get Static IP customers that need checking
            console.log('[AMS] 2. Fetching Static IP customers...');
            const [staticIPCustomers] = await databasePool.query(`
                SELECT 
                    c.id,
                    c.static_ip,
                    c.is_isolated,
                    sips.last_check
                FROM customers c
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                WHERE c.connection_type = 'static_ip'
                    AND c.status = 'active'
                    AND c.static_ip IS NOT NULL
                    AND (c.is_isolated = 0 OR c.is_isolated IS NULL)
                    AND (sips.last_check IS NULL OR sips.last_check < DATE_SUB(NOW(), INTERVAL 1 MINUTE))
                ORDER BY sips.last_check ASC
                LIMIT 100
            `) as [RowDataPacket[], any];
            console.log(`[AMS] Got ${staticIPCustomers.length} static IP customers to check`);

            // 3. Batch ping Static IPs
            if (staticIPCustomers.length > 0) {
                console.log('[AMS] 3. Batch pings starting...');
                const ips = staticIPCustomers.map((c: any) => c.static_ip);
                const pingResults = await this.batchPingStaticIPs(ips);

                // Update database
                for (const customer of staticIPCustomers) {
                    const isOnline = pingResults.get(customer.static_ip) || false;
                    const status = isOnline ? 'online' : 'offline';

                    await databasePool.query(`
                        INSERT INTO static_ip_ping_status (customer_id, ip_address, status, last_check, last_online_at, last_offline_at)
                        VALUES (?, ?, ?, NOW(), 
                            CASE WHEN ? = 'online' THEN NOW() ELSE NULL END,
                            CASE WHEN ? = 'offline' THEN NOW() ELSE NULL END
                        )
                        ON DUPLICATE KEY UPDATE
                            ip_address = VALUES(ip_address),
                            status = VALUES(status),
                            last_check = NOW(),
                            last_online_at = CASE WHEN ? = 'online' THEN NOW() ELSE last_online_at END,
                            last_offline_at = CASE WHEN ? = 'offline' AND status != 'offline' THEN NOW() ELSE last_offline_at END
                    `, [customer.id, customer.static_ip, status, status, status, status, status]);

                    monitoringCache.staticIPStatus.set(customer.id, {
                        customer_id: customer.id,
                        status: status,
                        last_check: new Date()
                    });

                    // Trigger AI Notification if status changed to offline
                    if (status === 'offline') {
                        await this.handleStatusTransition(customer.id, 'static_ip', status);
                    }
                }
                result.static_ip_checked = staticIPCustomers.length;
            }

            // 4. Check for PPPoE transitions (newly offline)
            await this.checkPPPoETransitions();

            // Store current state to database for persistent tracking (PPPoE & Static)
            // Get PPPoE customers to match with sessions
            const [pppoeCustomers] = await databasePool.query(`SELECT id, pppoe_username FROM customers WHERE connection_type = 'pppoe' AND status = 'active'`) as [any[], any];

            for (const [username, session] of monitoringCache.pppoeOnlineSessions) {
                const customer = pppoeCustomers.find((c: any) => c.pppoe_username === username);
                if (customer) {
                    const ipAddress = session.address || session['caller-id'] || '0.0.0.0'; // Fallback
                    await databasePool.query(`
                        INSERT INTO static_ip_ping_status (customer_id, ip_address, status, last_check, last_online_at)
                        VALUES (?, ?, 'online', NOW(), NOW())
                        ON DUPLICATE KEY UPDATE 
                            ip_address = VALUES(ip_address),
                            status = 'online', last_check = NOW(), last_online_at = NOW()
                    `, [customer.id, ipAddress]);
                }
            }

            // 5. Count offline alerts (excluding isolated)
            const offlineCustomers = await this.getOfflineCustomersForAlarm();
            result.offline_alerts = offlineCustomers.length;

            monitoringCache.lastRefresh = new Date();

            const duration = Date.now() - startTime;
            console.log(`[AdvancedMonitoringService] Monitoring cycle completed in ${duration}ms`);
            console.log(`  - PPPoE checked: ${result.pppoe_checked}`);
            console.log(`  - Static IP checked: ${result.static_ip_checked}`);
            console.log(`  - Offline alerts: ${result.offline_alerts}`);

        } catch (error) {
            console.error('[AdvancedMonitoringService] Error in monitoring cycle:', error);
        }

        return result;
    }

    /**
     * Handle customer status transition and trigger AI support if needed
     */
    private static readonly MASS_OUTAGE_THRESHOLD = 3; // Min offline customers to trigger mass alert

    private static async handleStatusTransition(customerId: number, type: string, newStatus: string): Promise<void> {
        try {
            // Check previous status in cache to avoid duplicate notifications
            const previous = monitoringCache.staticIPStatus.get(customerId);
            if (previous && previous.status === newStatus) return;

            // Get full customer info for notification (includes address and ODP name)
            const [customers] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    c.id, c.name, c.customer_code, c.phone, c.connection_type, 
                    c.pppoe_username, c.static_ip, c.address, c.odp_id,
                    odp.name as odp_name
                 FROM customers c
                 LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                 WHERE c.id = ?`,
                [customerId]
            );

            if (customers.length > 0) {
                const customer = customers[0] as any;
                const odpId = customer.odp_id;
                const odpName = customer.odp_name || (odpId ? `ODP-${odpId}` : null);

                // Update Cache immediately
                monitoringCache.staticIPStatus.set(customerId, {
                    customer_id: customerId,
                    status: newStatus as any,
                    last_check: new Date()
                });

                if (newStatus === 'offline') {
                    console.log(`[Status-Transition] Customer ${customer.name} is now OFFLINE.`);

                    // Persistent Update for Offline timestamp
                    const ipAddress = customer.static_ip || '0.0.0.0';
                    await databasePool.query(`
                        INSERT INTO static_ip_ping_status (customer_id, ip_address, status, last_check, last_offline_at)
                        VALUES (?, ?, 'offline', NOW(), NOW())
                        ON DUPLICATE KEY UPDATE 
                            status = 'offline', 
                            last_check = NOW(), 
                            last_offline_at = CASE WHEN status != 'offline' THEN NOW() ELSE last_offline_at END
                    `, [customerId, ipAddress]);

                    // 1. Always notify Customer (AI Troubleshooting)
                    await CustomerNotificationService.sendAIAutomatedTroubleshooting(customer, 'offline');

                    // 2. Always send individual alert to Admins & Operators
                    await CustomerNotificationService.broadcastCustomerStatusToAdmins(customer, 'offline');

                    // 3. Additionally: Mass Outage Detection for ODP
                    if (odpId) {
                        if (!monitoringCache.odpOfflineCustomers.has(odpId)) {
                            monitoringCache.odpOfflineCustomers.set(odpId, new Set());
                        }
                        monitoringCache.odpOfflineCustomers.get(odpId)!.add(customerId);

                        const offlineCount = monitoringCache.odpOfflineCustomers.get(odpId)!.size;

                        if (offlineCount >= this.MASS_OUTAGE_THRESHOLD && !monitoringCache.odpAlertSent.get(odpId)) {
                            console.log(`[Mass-Outage] ODP ${odpName} has ${offlineCount} offline customers. Sending mass alert.`);
                            await CustomerNotificationService.broadcastInfrastructureIssue(
                                odpName!, 'ODP', 'offline', offlineCount
                            );
                            monitoringCache.odpAlertSent.set(odpId, true);
                        }
                    }

                } else if (newStatus === 'online') {
                    console.log(`[Status-Transition] Customer ${customer.name} is back ONLINE.`);

                    await databasePool.query(`
                        UPDATE static_ip_ping_status SET status = 'online', last_check = NOW(), last_online_at = NOW() WHERE customer_id = ?
                    `, [customerId]);

                    // Mass Outage Recovery Detection
                    if (odpId && monitoringCache.odpOfflineCustomers.has(odpId)) {
                        monitoringCache.odpOfflineCustomers.get(odpId)!.delete(customerId);
                        const remainingOffline = monitoringCache.odpOfflineCustomers.get(odpId)!.size;

                        // If ODP was in mass outage and now recovered below threshold
                        if (remainingOffline < this.MASS_OUTAGE_THRESHOLD && monitoringCache.odpAlertSent.get(odpId)) {
                            console.log(`[Mass-Outage] ODP ${odpName} recovered. ${remainingOffline} still offline.`);
                            await CustomerNotificationService.broadcastInfrastructureIssue(
                                odpName!, 'ODP', 'online', remainingOffline
                            );
                            monitoringCache.odpAlertSent.set(odpId, false);
                        }

                        // Cleanup empty sets
                        if (remainingOffline === 0) {
                            monitoringCache.odpOfflineCustomers.delete(odpId);
                            monitoringCache.odpAlertSent.delete(odpId);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Status-Transition] Error:', error);
        }
    }

    /**
     * Check for PPPoE customers that just went offline
     */
    private static async checkPPPoETransitions(): Promise<void> {
        try {
            // Find active pppoe customers
            const [pppoeCustomers] = await databasePool.query(`
                SELECT id, name, pppoe_username 
                FROM customers 
                WHERE connection_type = 'pppoe' 
                    AND status = 'active'
                    AND (is_isolated = 0 OR is_isolated IS NULL)
            `) as [RowDataPacket[], any];

            for (const customer of pppoeCustomers) {
                // Case-insensitive check
                let isOnline = false;
                if (customer.pppoe_username) {
                    const searchTarget = customer.pppoe_username.toLowerCase();
                    if (monitoringCache.pppoeOnlineSessions.has(customer.pppoe_username)) {
                        isOnline = true;
                    } else {
                        for (const name of monitoringCache.pppoeOnlineSessions.keys()) {
                            if (name.toLowerCase() === searchTarget) {
                                isOnline = true;
                                break;
                            }
                        }
                    }
                }

                const currentStatus = isOnline ? 'online' : 'offline';

                // Only handle transition if status changed
                const cached = monitoringCache.staticIPStatus.get(customer.id);
                if (!cached || cached.status !== currentStatus) {
                    console.log(`[AMS] PPPoE Transition detected: ${customer.name} (${customer.pppoe_username}) -> ${currentStatus}`);
                    await this.handleStatusTransition(customer.id, 'pppoe', currentStatus);
                }
            }
        } catch (error) {
            console.error('[PPPoE-Transitions] Error:', error);
        }
    }

    /**
     * Get cache statistics for debugging
     */
    static getCacheStats(): {
        pppoe_sessions: number;
        static_ip_statuses: number;
        last_refresh: Date | null;
    } {
        return {
            pppoe_sessions: monitoringCache.pppoeOnlineSessions.size,
            static_ip_statuses: monitoringCache.staticIPStatus.size,
            last_refresh: monitoringCache.lastRefresh
        };
    }
    /**
     * Get ODP/Area problem analysis
     * Returns list of ODPs sorted by offline percentage/count
     */
    static async getODPProblems(): Promise<{
        odp_name: string;
        area: string;
        total_customers: number;
        offline_count: number;
        offline_percentage: number;
        offline_customers: { id: number; name: string; status: string }[];
    }[]> {
        try {
            // Use getAllCustomersWithStatus without filtering for coordinates
            // This ensures all ODP customers are counted, not just those on map
            const mapData = await this.getAllCustomersWithStatus(false);
            const customers = mapData.customers;

            // Group by ODP
            const odpMap = new Map<string, {
                odp_name: string;
                area: string;
                total: number;
                offline: number;
                customers: any[];
            }>();

            // Also group customers without ODP into 'Unknown/Direct'

            for (const customer of customers) {
                // Skip isolated customers from "problem" calculation? 
                // Usually yes, we only care about real network issues.
                if (customer.status === 'isolated') continue;

                const odpName = customer.odp_name || 'No ODP / Direct';
                const area = customer.area || 'Unknown Area';
                const key = `${odpName}|${area}`;

                if (!odpMap.has(key)) {
                    odpMap.set(key, {
                        odp_name: odpName,
                        area: area,
                        total: 0,
                        offline: 0,
                        customers: []
                    });
                }

                const entry = odpMap.get(key)!;
                entry.total++;

                if (customer.status === 'offline') {
                    entry.offline++;
                    entry.customers.push({
                        id: customer.id,
                        name: customer.name,
                        status: customer.status,
                        last_check: customer.last_check || new Date()
                    });
                }
            }

            // Convert map to array and calculate percentage
            const result = Array.from(odpMap.values()).map(odp => ({
                odp_name: odp.odp_name,
                area: odp.area,
                total_customers: odp.total,
                offline_count: odp.offline,
                offline_percentage: odp.total > 0 ? (odp.offline / odp.total) * 100 : 0,
                offline_customers: odp.customers
            }));

            // Sort by offline percentage (desc) then offline count (desc)
            // Filter to show only problematic ones (offline > 0) or just sort all
            return result
                .filter(r => r.offline_count > 0) // Only show ODPs with issues
                .sort((a, b) => {
                    if (b.offline_percentage !== a.offline_percentage) {
                        return b.offline_percentage - a.offline_percentage;
                    }
                    return b.offline_count - a.offline_count;
                });

        } catch (error) {
            console.error('Error getting ODP problems:', error);
            throw error;
        }
    }
}

export default AdvancedMonitoringService;
