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
import { getPppoeActiveConnections, getArpList } from '../mikrotikService';
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
    customerStatusCache: Map<number, MonitoringStatus>;
    odpOfflineCustomers: Map<number, Set<number>>; // ODP ID -> Set of offline customer IDs
    odpAlertSent: Map<number, boolean>; // ODP ID -> whether ODP alert has been sent
    odcAlertSent: Map<number, boolean>; // ODC ID -> whether ODC alert has been sent
    pppoeOfflineCandidates: Map<number, number>;
    staticIpOfflineCandidates: Map<number, number>;
    lastRefresh: Date | null;
    refreshInterval: number; // ms
} = {
    pppoeOnlineSessions: new Map(),
    customerStatusCache: new Map(),
    odpOfflineCustomers: new Map(),
    odpAlertSent: new Map(),
    odcAlertSent: new Map(),
    pppoeOfflineCandidates: new Map(),
    staticIpOfflineCandidates: new Map(),
    lastRefresh: null,
    refreshInterval: 10000 // Reduced to 10s for better "Live" feel
};

let refreshPromise: Promise<void> | null = null;

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
                    c.address,
                    c.odp_id,
                    odp.name as odp_name,
                    odp.latitude as odp_latitude,
                    odp.longitude as odp_longitude,
                    odp.total_ports as odp_total_ports,
                    odp.used_ports as odp_used_ports,
                    odp.location as odp_location,
                    odc.latitude as odc_latitude,
                    odc.longitude as odc_longitude,
                    nd.metadata as device_metadata,
                    COALESCE(s.package_name, pp.name) as package_name,
                    c.parent_customer_id,
                    parent.name as parent_name,
                    parent.latitude as parent_latitude,
                    parent.longitude as parent_longitude
                FROM customers c
                LEFT JOIN customers parent ON c.parent_customer_id = parent.id
                LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                LEFT JOIN ftth_odc odc ON odp.odc_id = odc.id
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
                LEFT JOIN network_devices nd ON (nd.genieacs_serial = c.serial_number OR nd.genieacs_id = c.serial_number) AND nd.device_type = 'ont'
                WHERE c.status = 'active'
            `;

            if (requireCoordinates) {
                query += ` AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL`;
            }

            query += ` ORDER BY c.name`;

            const [customers] = await databasePool.query(query) as [RowDataPacket[], any];

            // Get Offline timestamps and status from DB efficiently for all customers
            const [offlineData] = await databasePool.query(`
                SELECT customer_id, status, last_online_at, last_offline_at, last_check 
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
                    // Try pppoe_username first, then customer_code as fallback
                    let isOnline = false;
                    const identifiers = [customer.pppoe_username, customer.customer_code].filter(Boolean);
                    
                    for (const identifier of identifiers) {
                        if (isOnline) break;
                        const searchTarget = identifier.toLowerCase();
                        // First try direct lookup for performance
                        if (monitoringCache.pppoeOnlineSessions.has(identifier)) {
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
                    
                    if (isOnline) {
                        status = 'online';
                    } else {
                        // Jika tidak ada di active sessions = OFFLINE (untuk PPPoE)
                        // Jangan fallback ke DB karena DB bisa stale
                        status = 'offline';
                    }
                } else if (customer.connection_type === 'static_ip') {
                    // Check Static IP status from cache
                    const cachedStatus = monitoringCache.customerStatusCache.get(customer.id);
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
                    phone: customer.phone,
                    connection_type: customer.connection_type,
                    latitude: customer.latitude ? parseFloat(customer.latitude) : null,
                    longitude: customer.longitude ? parseFloat(customer.longitude) : null,
                    status,
                    last_offline_at: lastOfflineAt,
                    last_check: lastCheck,
                    odp_name: customer.odp_name,
                    odp_latitude: customer.odp_latitude ? parseFloat(customer.odp_latitude) : null,
                    odp_longitude: customer.odp_longitude ? parseFloat(customer.odp_longitude) : null,
                    odc_latitude: customer.odc_latitude ? parseFloat(customer.odc_latitude) : null,
                    odc_longitude: customer.odc_longitude ? parseFloat(customer.odc_longitude) : null,
                    device_metadata: customer.device_metadata,
                    package_name: customer.package_name,
                    area: customer.area,
                    address: customer.address,
                    odp_id: customer.odp_id,
                    odp_total_ports: customer.odp_total_ports,
                    odp_used_ports: customer.odp_used_ports,
                    odp_location: customer.odp_location,
                    parent_customer_id: customer.parent_customer_id,
                    parent_name: customer.parent_name,
                    parent_latitude: customer.parent_latitude ? parseFloat(customer.parent_latitude) : null,
                    parent_longitude: customer.parent_longitude ? parseFloat(customer.parent_longitude) : null
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
        odc_olt_links?: any[];
        all_odps?: any[];
    }> {
        if (forceRefresh) {
            await this.refreshCache();
        }
        const result = await this.getAllCustomersWithStatus(true);
        
        let odc_olt_links = [];
        try {
            const [odcs] = await databasePool.query(`
                SELECT 
                    odc.id as odc_id, odc.name as odc_name, odc.latitude as odc_lat, odc.longitude as odc_lng,
                    olt.id as olt_id, olt.name as olt_name, olt.latitude as olt_lat, olt.longitude as olt_lng
                FROM ftth_odc odc
                JOIN ftth_olt olt ON odc.olt_id = olt.id
                WHERE odc.latitude IS NOT NULL AND odc.longitude IS NOT NULL
                  AND olt.latitude IS NOT NULL AND olt.longitude IS NOT NULL
            `) as [import('mysql2').RowDataPacket[], any];
            odc_olt_links = odcs as any[];
        } catch (e) {
            console.error('Error fetching odc_olt_links:', e);
        }

        let all_odps = [];
        try {
            const [odps] = await databasePool.query(`
                SELECT 
                    o.id, o.name, o.latitude, o.longitude, o.location, o.total_ports,
                    (SELECT COUNT(*) FROM customers WHERE odp_id = o.id AND status = 'active' AND parent_customer_id IS NULL) as used_ports
                FROM ftth_odp o
                WHERE o.latitude IS NOT NULL AND o.longitude IS NOT NULL
            `) as [import('mysql2').RowDataPacket[], any];
            all_odps = odps as any[];
        } catch (e) {
            console.error('Error fetching all_odps:', e);
        }

        return { ...result, odc_olt_links, all_odps };
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
                    const cachedStatus = monitoringCache.customerStatusCache.get(customer.id);
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
     * Initialize NMS cache from database (survives restarts)
     */
    static async initializeNmsCache(): Promise<void> {
        try {
            console.log('[AMS-NMS] Initializing cache from database...');
            // 1. Initialize customerStatusCache from static_ip_ping_status (excluding isolated customers)
            const [dbStatuses] = await databasePool.query(`
                SELECT sips.customer_id, sips.status, sips.last_check, sips.response_time_ms 
                FROM static_ip_ping_status sips
                JOIN customers c ON sips.customer_id = c.id
                WHERE (c.is_isolated = 0 OR c.is_isolated IS NULL)
            `) as [RowDataPacket[], any];

            dbStatuses.forEach((s: any) => {
                monitoringCache.customerStatusCache.set(s.customer_id, {
                    customer_id: s.customer_id,
                    status: s.status || 'unknown',
                    last_check: s.last_check || new Date(),
                    response_time_ms: s.response_time_ms
                });
            });

            // 2. Initialize odpOfflineCustomers by looking up active offline customers
            const [offlineRows] = await databasePool.query<RowDataPacket[]>(`
                SELECT c.id, c.odp_id 
                FROM customers c
                JOIN static_ip_ping_status s ON c.id = s.customer_id
                WHERE c.status = 'active' 
                  AND (c.is_isolated = 0 OR c.is_isolated IS NULL)
                  AND s.status = 'offline'
                  AND c.odp_id IS NOT NULL
            `);

            monitoringCache.odpOfflineCustomers.clear();
            offlineRows.forEach((r: any) => {
                if (!monitoringCache.odpOfflineCustomers.has(r.odp_id)) {
                    monitoringCache.odpOfflineCustomers.set(r.odp_id, new Set());
                }
                monitoringCache.odpOfflineCustomers.get(r.odp_id)!.add(r.id);
            });

            // 3. Initialize alert sent maps from active outages in DB
            const [activeOutages] = await databasePool.query<RowDataPacket[]>(`
                SELECT type, odp_id, odc_id FROM nms_odp_outages WHERE status = 'active'
            `);

            monitoringCache.odpAlertSent.clear();
            monitoringCache.odcAlertSent.clear();
            activeOutages.forEach((outage: any) => {
                if (outage.type === 'ODP' && outage.odp_id) {
                    monitoringCache.odpAlertSent.set(outage.odp_id, true);
                } else if (outage.type === 'ODC' && outage.odc_id) {
                    monitoringCache.odcAlertSent.set(outage.odc_id, true);
                }
            });

            console.log(`[AMS-NMS] Cache initialized: ${monitoringCache.customerStatusCache.size} customers, ` +
                        `${offlineRows.length} offline, ${activeOutages.length} active alerts.`);
        } catch (error) {
            console.error('[AMS-NMS] Error initializing cache:', error);
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
                try {
                    const sessions = await getPppoeActiveConnections(mikrotikConfig);
                    if (Array.isArray(sessions)) {
                        const newSessions = new Map();
                        sessions.forEach((session: any) => {
                            newSessions.set(session.name, session);
                        });
                        monitoringCache.pppoeOnlineSessions = newSessions; // Atomic swap
                        console.log(`[AdvancedMonitoringService] Cached ${sessions.length} PPPoE sessions`);
                    }
                } catch (e) {
                    console.error('[AdvancedMonitoringService] Failed to get PPPoE sessions in refreshCache:', e);
                    // Do not clear the cache here. Retain the last known good state to prevent 
                    // a mass "offline" false positive if Mikrotik is temporarily unreachable.
                }
            }

            // Refresh Static IP status from database (excluding isolated customers)
            const [customerStatusCache] = await databasePool.query(`
                SELECT 
                    sips.customer_id,
                    sips.status,
                    sips.response_time_ms,
                    sips.last_check
                FROM static_ip_ping_status sips
                JOIN customers c ON sips.customer_id = c.id
                WHERE (c.is_isolated = 0 OR c.is_isolated IS NULL)
            `) as [RowDataPacket[], any];

            // Instead of clearing, we update the existing map to preserve history for transition detection
            customerStatusCache.forEach((status: any) => {
                monitoringCache.customerStatusCache.set(status.customer_id, {
                    customer_id: status.customer_id,
                    status: status.status || 'unknown',
                    last_check: status.last_check,
                    response_time_ms: status.response_time_ms
                });
            });
            console.log(`[AdvancedMonitoringService] Updated ${customerStatusCache.length} Static IP statuses in cache`);

            monitoringCache.lastRefresh = new Date();
        } catch (error) {
            console.error('[AdvancedMonitoringService] Error refreshing cache:', error);
        }
    }

    /**
     * Refresh cache if stale
     */
    static async refreshCacheIfNeeded(): Promise<void> {
        if (refreshPromise) return refreshPromise;

        const now = Date.now();
        const lastRefresh = monitoringCache.lastRefresh?.getTime() || 0;

        if (now - lastRefresh > monitoringCache.refreshInterval) {
            refreshPromise = this.refreshCache().finally(() => {
                refreshPromise = null;
            });
            await refreshPromise;
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
            // First Priority: Initialize cache from DB if empty to prevent false notifications on restart
            if (monitoringCache.customerStatusCache.size === 0) {
                await this.initializeNmsCache();
            }

            const mikrotikConfig = await getMikrotikConfig();

            if (mikrotikConfig) {
                try {
                    const sessions = await getPppoeActiveConnections(mikrotikConfig);
                    if (Array.isArray(sessions)) {
                        const newSessions = new Map();
                        sessions.forEach((session: any) => {
                            newSessions.set(session.name, session);
                        });
                        monitoringCache.pppoeOnlineSessions = newSessions; // Atomic swap
                        result.pppoe_checked = sessions.length;
                    }
                } catch (err) {
                    console.error('[AdvancedMonitoringService] Failed to get PPPoE sessions:', err);
                    // DO NOT clear cache on error to prevent mass false-offline alerts
                    // if Mikrotik API is temporarily unreachable or timing out.
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
                    s.status as db_status
                FROM customers c
                LEFT JOIN static_ip_ping_status s ON c.id = s.customer_id
                WHERE c.connection_type = 'static_ip'
                    AND c.status = 'active'
                    AND c.static_ip IS NOT NULL
                    AND (c.is_isolated = 0 OR c.is_isolated IS NULL)
            `) as [RowDataPacket[], any];
            console.log(`[AMS] Got ${staticIPCustomers.length} static IP customers to check`);

            // 3. Batch check Static IPs via ARP
            if (staticIPCustomers.length > 0) {
                console.log('[AMS] 3. Checking ARP list starting...');
                let arpList: string[] = [];
                if (mikrotikConfig) {
                    arpList = await getArpList(mikrotikConfig);
                }
                const activeIPs = new Set(arpList);

                // Update database
                for (const customer of staticIPCustomers) {
                    let status = 'offline';

                    if (activeIPs.has(customer.static_ip)) {
                        // ARP entry exists (dynamic + complete) = device is communicating
                        // on the network at Layer 2. This is reliable evidence of connectivity.
                        // Many customer routers/ONUs block ICMP ping but still work fine
                        // for internet access, so we trust ARP without requiring ping.
                        status = 'online';
                    } else {
                        // Fallback to PingService's last known status in DB
                        // This prevents flip-flops if ARP cache expires or API fails
                        status = customer.db_status || 'offline';
                    }

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

                    // Centralized status management with grace period
                    const cached = monitoringCache.customerStatusCache.get(customer.id);
                    if (status === 'online') {
                        if (monitoringCache.staticIpOfflineCandidates.has(customer.id)) {
                            monitoringCache.staticIpOfflineCandidates.delete(customer.id);
                        }
                        if (!cached || cached.status !== 'online') {
                            await this.handleStatusTransition(customer.id, 'static_ip', 'online');
                        }
                    } else {
                        if (!cached || cached.status !== 'offline') {
                            const currentCount = monitoringCache.staticIpOfflineCandidates.get(customer.id) || 0;
                            if (currentCount >= 30) { // 30 cycles * 10s = 5 minutes
                                console.log(`[AMS] Static IP Transition detected: ${customer.static_ip} -> offline (Grace period exceeded)`);
                                await this.handleStatusTransition(customer.id, 'static_ip', 'offline');
                            } else {
                                monitoringCache.staticIpOfflineCandidates.set(customer.id, currentCount + 1);
                            }
                        }
                    }
                }
                result.static_ip_checked = staticIPCustomers.length;
            }

            // 4. Check for PPPoE transitions (newly offline)
            await this.checkPPPoETransitions();

            // Store current state to database for persistent tracking (PPPoE & Static)
            // Get PPPoE customers to match with sessions
            const [pppoeCustomers] = await databasePool.query(`SELECT id, pppoe_username, customer_code FROM customers WHERE connection_type = 'pppoe' AND status = 'active'`) as [any[], any];

            for (const [username, session] of monitoringCache.pppoeOnlineSessions) {
                // Match by pppoe_username OR customer_code (case-insensitive)
                const usernameLower = username.toLowerCase();
                const customer = pppoeCustomers.find((c: any) => {
                    if (c.pppoe_username && c.pppoe_username.toLowerCase() === usernameLower) return true;
                    if (c.customer_code && c.customer_code.toLowerCase() === usernameLower) return true;
                    return false;
                });
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

            // Clean up isolated customers from ODP offline lists to avoid false alerts
            try {
                const [isolatedCustomers] = await databasePool.query<RowDataPacket[]>(
                    `SELECT c.id, c.odp_id, odp.name as odp_name, odp.odc_id, odc.name as odc_name
                     FROM customers c
                     LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                     LEFT JOIN ftth_odc odc ON odp.odc_id = odc.id
                     WHERE c.is_isolated = 1`
                );
                for (const c of isolatedCustomers) {
                    // Remove from candidates lists
                    if (monitoringCache.staticIpOfflineCandidates.has(c.id)) {
                        monitoringCache.staticIpOfflineCandidates.delete(c.id);
                    }
                    if (monitoringCache.pppoeOfflineCandidates.has(c.id)) {
                        monitoringCache.pppoeOfflineCandidates.delete(c.id);
                    }

                    // Clear offline status in cache to avoid false alerts
                    const cached = monitoringCache.customerStatusCache.get(c.id);
                    if (cached && cached.status === 'offline') {
                        monitoringCache.customerStatusCache.set(c.id, {
                            customer_id: c.id,
                            status: 'online',
                            last_check: new Date()
                        });
                    }

                    if (c.odp_id && monitoringCache.odpOfflineCustomers.has(c.odp_id)) {
                        const offlineSet = monitoringCache.odpOfflineCustomers.get(c.odp_id)!;
                        if (offlineSet.has(c.id)) {
                            console.log(`[AMS-NMS] Proactively removing isolated customer ${c.id} from ODP ${c.odp_id} offline list.`);
                            offlineSet.delete(c.id);
                            
                            // Check recovery for ODP/ODC
                            await this.checkOdpOdcRecovery(c.id, c.odp_id, c);
                        }
                    }
                }
            } catch (cleanupErr) {
                console.error('[AMS-NMS] Error cleaning up isolated customers from cache:', cleanupErr);
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
            const previous = monitoringCache.customerStatusCache.get(customerId);
            if (previous && previous.status === newStatus) return;

            // Get full customer info for notification (includes address and ODP/ODC name)
            const [customers] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    c.id, c.name, c.customer_code, c.phone, c.connection_type, 
                    c.pppoe_username, c.static_ip, c.address, c.odp_id,
                    odp.name as odp_name, odp.odc_id, odc.name as odc_name
                 FROM customers c
                 LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                 LEFT JOIN ftth_odc odc ON odp.odc_id = odc.id
                 WHERE c.id = ?`,
                [customerId]
            );

            if (customers.length > 0) {
                const customer = customers[0] as any;
                const odpId = customer.odp_id;
                const odpName = customer.odp_name || (odpId ? `ODP-${odpId}` : null);

                // Update Cache immediately
                monitoringCache.customerStatusCache.set(customerId, {
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

                        // Count total active, non-isolated customers on this ODP
                        const [totalRes] = await databasePool.query<RowDataPacket[]>(
                            `SELECT COUNT(*) as cnt FROM customers 
                             WHERE odp_id = ? AND status = 'active' AND (is_isolated = 0 OR is_isolated IS NULL)`,
                            [odpId]
                        );
                        const totalCount = totalRes[0].cnt;

                        if (totalCount > 0 && (offlineCount / totalCount) >= 0.50) {
                            const odcId = customer.odc_id;
                            const odcName = customer.odc_name || (odcId ? `ODC-${odcId}` : null);

                            // Check Cascade Logic: Is the ODC down?
                            let odcIsDown = false;
                            let odcTotalCustomers = 0;
                            let odcOfflineCustomers = 0;

                            if (odcId) {
                                // Get all ODPs under this ODC
                                const [odps] = await databasePool.query<RowDataPacket[]>(
                                    `SELECT id FROM ftth_odp WHERE odc_id = ?`,
                                    [odcId]
                                );

                                if (odps.length > 0) {
                                    let checkedOdpsCount = 0;
                                    let downOdpsCount = 0;

                                    for (const o of odps) {
                                        const [oTotal] = await databasePool.query<RowDataPacket[]>(
                                            `SELECT COUNT(*) as cnt FROM customers 
                                             WHERE odp_id = ? AND status = 'active' AND (is_isolated = 0 OR is_isolated IS NULL)`,
                                            [o.id]
                                        );
                                        const oTotalCount = oTotal[0].cnt;
                                        if (oTotalCount > 0) {
                                            checkedOdpsCount++;
                                            odcTotalCustomers += oTotalCount;
                                            const oOfflineSet = monitoringCache.odpOfflineCustomers.get(o.id);
                                            const oOfflineCount = oOfflineSet ? oOfflineSet.size : 0;
                                            odcOfflineCustomers += oOfflineCount;
                                            if ((oOfflineCount / oTotalCount) >= 0.50) {
                                                downOdpsCount++;
                                            }
                                        }
                                    }

                                    // If all ODPs that have active customers under the ODC are down, then ODC is down
                                    if (checkedOdpsCount > 0 && downOdpsCount === checkedOdpsCount) {
                                        odcIsDown = true;
                                    }
                                }
                            }

                            if (odcIsDown && odcId) {
                                // ODC DOWN Alert
                                if (!monitoringCache.odcAlertSent.get(odcId)) {
                                    // Check if active alert already in DB to avoid duplicate
                                    const [activeOdcAlert] = await databasePool.query<RowDataPacket[]>(
                                        `SELECT id FROM nms_odp_outages WHERE odc_id = ? AND type = 'ODC' AND status = 'active' LIMIT 1`,
                                        [odcId]
                                    );

                                    if (activeOdcAlert.length === 0) {
                                        console.log(`[NMS] ODC ${odcName} is DOWN. Sending alert.`);
                                        
                                        // Save ODC Outage to DB
                                        await databasePool.query(
                                            `INSERT INTO nms_odp_outages (type, odc_id, odc_name, total_customers, offline_customers, offline_percent, alert_sent_at, status)
                                             VALUES ('ODC', ?, ?, ?, ?, ?, NOW(), 'active')`,
                                            [odcId, odcName, odcTotalCustomers, odcOfflineCustomers, (odcOfflineCustomers / odcTotalCustomers) * 100]
                                        );

                                        await CustomerNotificationService.broadcastInfrastructureIssue(
                                            odcName!, 'ODC', 'offline', odcOfflineCustomers, {
                                                totalCount: odcTotalCustomers
                                            }
                                        );
                                    }
                                    monitoringCache.odcAlertSent.set(odcId, true);
                                }
                            } else {
                                // ODP DOWN Alert (Only if parent ODC is not down)
                                if (!monitoringCache.odpAlertSent.get(odpId)) {
                                    // Check if active outage already exists in DB
                                    const [activeOdpAlert] = await databasePool.query<RowDataPacket[]>(
                                        `SELECT id FROM nms_odp_outages WHERE odp_id = ? AND type = 'ODP' AND status = 'active' LIMIT 1`,
                                        [odpId]
                                    );

                                    // Check cooldown (30 mins cooldown to prevent notification flapping)
                                    const [recentCooldown] = await databasePool.query<RowDataPacket[]>(
                                        `SELECT id FROM nms_odp_outages 
                                         WHERE odp_id = ? AND type = 'ODP' AND alert_sent_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
                                         LIMIT 1`,
                                        [odpId]
                                    );

                                    if (activeOdpAlert.length === 0 && recentCooldown.length === 0) {
                                        console.log(`[NMS] ODP ${odpName} has ${offlineCount}/${totalCount} offline. Sending alert.`);
                                        
                                        // Find names of offline customers on this ODP
                                        const [offlineCustNames] = await databasePool.query<RowDataPacket[]>(
                                            `SELECT c.name FROM customers c
                                             JOIN static_ip_ping_status s ON c.id = s.customer_id
                                             WHERE c.odp_id = ? AND c.status = 'active' 
                                               AND (c.is_isolated = 0 OR c.is_isolated IS NULL)
                                               AND s.status = 'offline'`,
                                            [odpId]
                                        );
                                        const affectedNames = offlineCustNames.map(c => c.name);

                                        // Save ODP Outage to DB
                                        await databasePool.query(
                                            `INSERT INTO nms_odp_outages (type, odp_id, odc_id, odp_name, odc_name, total_customers, offline_customers, offline_percent, alert_sent_at, status, affected_customers)
                                             VALUES ('ODP', ?, ?, ?, ?, ?, ?, ?, NOW(), 'active', ?)`,
                                            [odpId, odcId, odpName, odcName, totalCount, offlineCount, (offlineCount / totalCount) * 100, JSON.stringify(affectedNames)]
                                        );

                                        await CustomerNotificationService.broadcastInfrastructureIssue(
                                            odpName!, 'ODP', 'offline', offlineCount, {
                                                odcName: odcName || undefined,
                                                totalCount: totalCount,
                                                affectedCustomers: affectedNames
                                            }
                                        );
                                    }
                                    monitoringCache.odpAlertSent.set(odpId, true);
                                }
                            }
                        }
                    }

                } else if (newStatus === 'online') {
                    // Start of 'online' logic - Only notify if previously offline
                    const wasOffline = previous && previous.status === 'offline';

                    if (!wasOffline) {
                        console.log(`[Status-Transition] Customer ${customer.name} detected ONLINE (Initial/Unknown -> Online). Suppressed.`);
                    } else {
                        console.log(`[Status-Transition] Customer ${customer.name} is back ONLINE.`);

                        await databasePool.query(`
                            UPDATE static_ip_ping_status SET status = 'online', last_check = NOW(), last_online_at = NOW() WHERE customer_id = ?
                        `, [customerId]);

                        // Notify Admins
                        await CustomerNotificationService.broadcastCustomerStatusToAdmins(customer, 'online');

                        // Notify Customer (Recovered)
                        await CustomerNotificationService.sendTroubleNotification(
                            customer, 'recovered'
                        );
                    }

                    // NMS Outage Recovery Detection
                    if (odpId && monitoringCache.odpOfflineCustomers.has(odpId)) {
                        monitoringCache.odpOfflineCustomers.get(odpId)!.delete(customerId);
                        await this.checkOdpOdcRecovery(customerId, odpId, customer);
                    }
                }
            }
        } catch (error) {
            console.error('[Status-Transition] Error:', error);
        }
    }

    /**
     * Helper to detect ODP / ODC recovery based on remaining offline count
     */
    private static async checkOdpOdcRecovery(customerId: number, odpId: number, customer: any): Promise<void> {
        const remainingOffline = monitoringCache.odpOfflineCustomers.get(odpId) ? monitoringCache.odpOfflineCustomers.get(odpId)!.size : 0;

        const odcId = customer.odc_id;
        const odcName = customer.odc_name || (odcId ? `ODC-${odcId}` : null);
        const odpName = customer.odp_name || (odpId ? `ODP-${odpId}` : null);

        // A. Check ODC Recovery (All ODPs under ODC must have 0 offline)
        if (odcId && monitoringCache.odcAlertSent.get(odcId)) {
            const [odps] = await databasePool.query<RowDataPacket[]>(
                `SELECT id FROM ftth_odp WHERE odc_id = ?`,
                [odcId]
            );
            
            let totalOdcOffline = 0;
            for (const o of odps) {
                const oOfflineSet = monitoringCache.odpOfflineCustomers.get(o.id);
                totalOdcOffline += oOfflineSet ? oOfflineSet.size : 0;
            }

            if (totalOdcOffline === 0) {
                console.log(`[NMS] ODC ${odcName} recovered fully.`);
                
                // Find active ODC outage in DB
                const [activeOdcOutage] = await databasePool.query<RowDataPacket[]>(
                    `SELECT id, alert_sent_at FROM nms_odp_outages 
                     WHERE odc_id = ? AND type = 'ODC' AND status = 'active'
                     ORDER BY alert_sent_at DESC LIMIT 1`,
                    [odcId]
                );

                let durationMinutes = 0;
                if (activeOdcOutage.length > 0) {
                    const alertTime = new Date(activeOdcOutage[0].alert_sent_at);
                    durationMinutes = Math.round((Date.now() - alertTime.getTime()) / 60000);

                    await databasePool.query(
                        `UPDATE nms_odp_outages 
                         SET status = 'recovered', recovered_at = NOW(), duration_minutes = ?
                         WHERE id = ?`,
                        [durationMinutes, activeOdcOutage[0].id]
                    );
                }

                await CustomerNotificationService.broadcastInfrastructureIssue(
                    odcName!, 'ODC', 'online', 0, {
                        durationMinutes: durationMinutes
                    }
                );

                monitoringCache.odcAlertSent.set(odcId, false);
            }
        }

        // B. Check ODP Recovery (remainingOffline === 0)
        if (remainingOffline === 0 && monitoringCache.odpAlertSent.get(odpId)) {
            console.log(`[NMS] ODP ${odpName} recovered fully.`);

            // Find active ODP outage in DB
            const [activeOdpOutage] = await databasePool.query<RowDataPacket[]>(
                `SELECT id, alert_sent_at FROM nms_odp_outages 
                 WHERE odp_id = ? AND type = 'ODP' AND status = 'active'
                 ORDER BY alert_sent_at DESC LIMIT 1`,
                [odpId]
            );

            let durationMinutes = 0;
            if (activeOdpOutage.length > 0) {
                const alertTime = new Date(activeOdpOutage[0].alert_sent_at);
                durationMinutes = Math.round((Date.now() - alertTime.getTime()) / 60000);

                await databasePool.query(
                    `UPDATE nms_odp_outages 
                     SET status = 'recovered', recovered_at = NOW(), duration_minutes = ?
                     WHERE id = ?`,
                    [durationMinutes, activeOdpOutage[0].id]
                );
            }

            await CustomerNotificationService.broadcastInfrastructureIssue(
                odpName!, 'ODP', 'online', 0, {
                    durationMinutes: durationMinutes
                }
            );

            monitoringCache.odpAlertSent.set(odpId, false);
        }

        // Cleanup sets in memory
        if (remainingOffline === 0) {
            monitoringCache.odpOfflineCustomers.delete(odpId);
            monitoringCache.odpAlertSent.delete(odpId);
        }
    }

    /**
     * Check for PPPoE customers that just went offline
     */
    private static async checkPPPoETransitions(): Promise<void> {
        try {
            // Find active pppoe customers
            const [pppoeCustomers] = await databasePool.query(`
                SELECT id, name, pppoe_username, customer_code 
                FROM customers 
                WHERE connection_type = 'pppoe' 
                    AND status = 'active'
                    AND (is_isolated = 0 OR is_isolated IS NULL)
            `) as [RowDataPacket[], any];

            for (const customer of pppoeCustomers) {
                // Case-insensitive check with customer_code fallback
                let isOnline = false;
                const identifiers = [customer.pppoe_username, customer.customer_code].filter(Boolean);
                
                for (const identifier of identifiers) {
                    if (isOnline) break;
                    const searchTarget = identifier.toLowerCase();
                    if (monitoringCache.pppoeOnlineSessions.has(identifier)) {
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
                const cached = monitoringCache.customerStatusCache.get(customer.id);

                if (isOnline) {
                    if (monitoringCache.pppoeOfflineCandidates.has(customer.id)) {
                        monitoringCache.pppoeOfflineCandidates.delete(customer.id);
                    }
                    if (!cached || cached.status !== 'online') {
                        console.log(`[AMS] PPPoE Transition detected: ${customer.name} (${customer.pppoe_username || customer.customer_code}) -> online`);
                        await this.handleStatusTransition(customer.id, 'pppoe', 'online');
                    }
                } else {
                    if (!cached || cached.status !== 'offline') {
                        const currentCount = monitoringCache.pppoeOfflineCandidates.get(customer.id) || 0;
                        if (currentCount >= 30) {
                            console.log(`[AMS] PPPoE Transition detected: ${customer.name} (${customer.pppoe_username || customer.customer_code}) -> offline (Grace period exceeded)`);
                            await this.handleStatusTransition(customer.id, 'pppoe', 'offline');
                        } else {
                            monitoringCache.pppoeOfflineCandidates.set(customer.id, currentCount + 1);
                        }
                    }
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
            static_ip_statuses: monitoringCache.customerStatusCache.size,
            last_refresh: monitoringCache.lastRefresh
        };
    }

    /**
     * Get cached PPPoE sessions directly
     */
    static getCachedPppoeSessions(): Map<string, any> {
        return monitoringCache.pppoeOnlineSessions;
    }

    /**
     * Get the full monitoring cache for debugging and tests
     */
    static getMonitoringCache(): any {
        return monitoringCache;
    }
}

export default AdvancedMonitoringService;
