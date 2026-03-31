"use strict";
/**
 * Advanced Monitoring Service
 * Handles optimized PPPoE and Static IP monitoring with:
 * - Efficient caching for performance
 * - Real-time offline detection (excluding isolated customers)
 * - Map clustering for nearby customers
 * - Audio notification triggers for offline alerts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedMonitoringService = void 0;
const pool_1 = require("../../db/pool");
const CustomerNotificationService_1 = __importDefault(require("./CustomerNotificationService"));
const pppoeService_1 = require("../pppoeService");
const mikrotikService_1 = require("../mikrotikService");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Cache for monitoring data
let monitoringCache = {
    pppoeOnlineSessions: new Map(),
    staticIPStatus: new Map(),
    odpOfflineCustomers: new Map(),
    odpAlertSent: new Map(),
    lastRefresh: null,
    refreshInterval: 10000 // Reduced to 10s for better "Live" feel
};
let refreshPromise = null;
class AdvancedMonitoringService {
    /**
     * Get all customers with status (Helper for both Map and ODP Problems)
     * Optimized for performance with caching
     */
    static async getAllCustomersWithStatus(requireCoordinates = false) {
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
            const [customers] = await pool_1.databasePool.query(query);
            // Get Offline timestamps from DB efficiently for all customers
            const [offlineData] = await pool_1.databasePool.query(`
                SELECT customer_id, last_online_at, last_offline_at, last_check 
                FROM static_ip_ping_status
            `);
            const offlineMap = new Map();
            offlineData.forEach(d => offlineMap.set(d.customer_id, d));
            // Calculate status for each customer
            const customersWithStatus = customers.map((customer) => {
                let status = 'unknown';
                let lastOfflineAt = null;
                let lastCheck = null;
                const dbOffline = offlineMap.get(customer.id);
                if (dbOffline) {
                    lastOfflineAt = dbOffline.last_offline_at;
                    lastCheck = dbOffline.last_check;
                }
                if (customer.is_isolated) {
                    status = 'isolated';
                }
                else if (customer.connection_type === 'pppoe') {
                    // Check PPPoE status from cache - CASE INSENSITIVE
                    let isOnline = false;
                    if (customer.pppoe_username) {
                        const searchTarget = customer.pppoe_username.toLowerCase();
                        // First try direct lookup for performance
                        if (monitoringCache.pppoeOnlineSessions.has(customer.pppoe_username)) {
                            isOnline = true;
                        }
                        else {
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
                }
                else if (customer.connection_type === 'static_ip') {
                    // Check Static IP status from cache
                    const cachedStatus = monitoringCache.staticIPStatus.get(customer.id);
                    status = cachedStatus?.status || dbOffline?.status || 'unknown';
                    if (cachedStatus)
                        lastCheck = cachedStatus.last_check;
                }
                else {
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
                online: customersWithStatus.filter((c) => c.status === 'online').length,
                offline: customersWithStatus.filter((c) => c.status === 'offline' && !c.is_isolated).length,
                isolated: customersWithStatus.filter((c) => c.is_isolated).length,
                pppoe: {
                    total: customersWithStatus.filter((c) => c.connection_type === 'pppoe').length,
                    online: customersWithStatus.filter((c) => c.connection_type === 'pppoe' && c.status === 'online').length,
                    offline: customersWithStatus.filter((c) => c.connection_type === 'pppoe' && c.status === 'offline' && !c.is_isolated).length
                },
                static_ip: {
                    total: customersWithStatus.filter((c) => c.connection_type === 'static_ip').length,
                    online: customersWithStatus.filter((c) => c.connection_type === 'static_ip' && c.status === 'online').length,
                    offline: customersWithStatus.filter((c) => c.connection_type === 'static_ip' && c.status === 'offline' && !c.is_isolated).length
                }
            };
            return { customers: customersWithStatus, stats };
        }
        catch (error) {
            console.error('Error getting all customers with status:', error);
            throw error;
        }
    }
    /**
     * Get all customers for map display with status
     * Optimized for performance with caching
     */
    static async getCustomersForMap(forceRefresh = false) {
        if (forceRefresh) {
            await this.refreshCache();
        }
        return this.getAllCustomersWithStatus(true);
    }
    /**
     * Get offline customers for alarm notification
     * EXCLUDES isolated customers - they should not trigger alarms
     */
    static async getOfflineCustomersForAlarm() {
        try {
            await this.refreshCacheIfNeeded();
            const [customers] = await pool_1.databasePool.query(`
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
            `);
            const offlineCustomers = [];
            for (const customer of customers) {
                let isOffline = false;
                let offlineSince;
                if (customer.connection_type === 'pppoe') {
                    // Check PPPoE status - CASE INSENSITIVE
                    let isOnline = false;
                    if (customer.pppoe_username) {
                        const searchTarget = customer.pppoe_username.toLowerCase();
                        if (monitoringCache.pppoeOnlineSessions.has(customer.pppoe_username)) {
                            isOnline = true;
                        }
                        else {
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
                    }
                    else {
                        isOffline = true;
                    }
                }
                else if (customer.connection_type === 'static_ip') {
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
        }
        catch (error) {
            console.error('Error getting offline customers for alarm:', error);
            return [];
        }
    }
    /**
     * Get nearby customers to a specific location
     * For map "fly to nearest customer" feature
     */
    static async getNearbyCustomers(latitude, longitude, radiusKm = 1, limit = 10) {
        try {
            // Using Haversine formula for distance calculation
            const [customers] = await pool_1.databasePool.query(`
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
            `, [latitude, longitude, latitude, radiusKm, limit]);
            return customers;
        }
        catch (error) {
            console.error('Error getting nearby customers:', error);
            return [];
        }
    }
    /**
     * Force refresh monitoring cache
     */
    static async refreshCache() {
        console.log('[AdvancedMonitoringService] Refreshing monitoring cache...');
        try {
            // Refresh PPPoE sessions
            const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
            if (mikrotikConfig) {
                const sessions = await (0, mikrotikService_1.getPppoeActiveConnections)(mikrotikConfig);
                monitoringCache.pppoeOnlineSessions.clear();
                sessions.forEach((session) => {
                    monitoringCache.pppoeOnlineSessions.set(session.name, session);
                });
                console.log(`[AdvancedMonitoringService] Cached ${sessions.length} PPPoE sessions`);
            }
            // Refresh Static IP status from database
            const [staticIPStatus] = await pool_1.databasePool.query(`
                SELECT 
                    customer_id,
                    status,
                    response_time_ms,
                    last_check
                FROM static_ip_ping_status
            `);
            // Instead of clearing, we update the existing map to preserve history for transition detection
            staticIPStatus.forEach((status) => {
                monitoringCache.staticIPStatus.set(status.customer_id, {
                    customer_id: status.customer_id,
                    status: status.status || 'unknown',
                    last_check: status.last_check,
                    response_time_ms: status.response_time_ms
                });
            });
            console.log(`[AdvancedMonitoringService] Updated ${staticIPStatus.length} Static IP statuses in cache`);
            monitoringCache.lastRefresh = new Date();
        }
        catch (error) {
            console.error('[AdvancedMonitoringService] Error refreshing cache:', error);
        }
    }
    /**
     * Refresh cache if stale
     */
    static async refreshCacheIfNeeded() {
        if (refreshPromise)
            return refreshPromise;
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
    static async batchPingStaticIPs(ips) {
        const results = new Map();
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
                }
                catch (error) {
                    results.set(ip, false);
                }
            }));
        }
        return results;
    }
    /**
     * Run optimized monitoring cycle
     */
    static async runOptimizedMonitoringCycle() {
        const startTime = Date.now();
        const result = {
            pppoe_checked: 0,
            static_ip_checked: 0,
            offline_alerts: 0
        };
        try {
            // First Priority: Initialize cache from DB if empty to prevent false notifications on restart
            if (monitoringCache.staticIPStatus.size === 0) {
                console.log('[AMS] Initializing cache from database...');
                const [dbStatuses] = await pool_1.databasePool.query(`
                    SELECT customer_id, status, last_check, response_time_ms 
                    FROM static_ip_ping_status
                `);
                dbStatuses.forEach((s) => {
                    monitoringCache.staticIPStatus.set(s.customer_id, {
                        customer_id: s.customer_id,
                        status: s.status || 'unknown',
                        last_check: s.last_check,
                        response_time_ms: s.response_time_ms
                    });
                });
                console.log(`[AMS] Cache initialized with ${dbStatuses.length} customer statuses.`);
            }
            const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
            if (mikrotikConfig) {
                try {
                    const sessions = await (0, mikrotikService_1.getPppoeActiveConnections)(mikrotikConfig);
                    monitoringCache.pppoeOnlineSessions.clear();
                    if (Array.isArray(sessions)) {
                        sessions.forEach((session) => {
                            monitoringCache.pppoeOnlineSessions.set(session.name, session);
                        });
                        result.pppoe_checked = sessions.length;
                    }
                }
                catch (err) {
                    console.error('[AdvancedMonitoringService] Failed to get PPPoE sessions:', err);
                    // Clear cache on error to avoid stale "online" status
                    monitoringCache.pppoeOnlineSessions.clear();
                }
            }
            else {
                // No config = no one is online via PPPoE
                monitoringCache.pppoeOnlineSessions.clear();
            }
            // 2. Get Static IP customers that need checking
            console.log('[AMS] 2. Fetching Static IP customers...');
            const [staticIPCustomers] = await pool_1.databasePool.query(`
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
            `);
            console.log(`[AMS] Got ${staticIPCustomers.length} static IP customers to check`);
            // 3. Batch ping Static IPs
            if (staticIPCustomers.length > 0) {
                console.log('[AMS] 3. Batch pings starting...');
                const ips = staticIPCustomers.map((c) => c.static_ip);
                const pingResults = await this.batchPingStaticIPs(ips);
                // Update database
                for (const customer of staticIPCustomers) {
                    const isOnline = pingResults.get(customer.static_ip) || false;
                    const status = isOnline ? 'online' : 'offline';
                    await pool_1.databasePool.query(`
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
                    // Centralized status management
                    // checking previous status logic is handled inside handleStatusTransition
                    await this.handleStatusTransition(customer.id, 'static_ip', status);
                }
                result.static_ip_checked = staticIPCustomers.length;
            }
            // 4. Check for PPPoE transitions (newly offline)
            await this.checkPPPoETransitions();
            // Store current state to database for persistent tracking (PPPoE & Static)
            // Get PPPoE customers to match with sessions
            const [pppoeCustomers] = await pool_1.databasePool.query(`SELECT id, pppoe_username FROM customers WHERE connection_type = 'pppoe' AND status = 'active'`);
            for (const [username, session] of monitoringCache.pppoeOnlineSessions) {
                const customer = pppoeCustomers.find((c) => c.pppoe_username === username);
                if (customer) {
                    const ipAddress = session.address || session['caller-id'] || '0.0.0.0'; // Fallback
                    await pool_1.databasePool.query(`
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
        }
        catch (error) {
            console.error('[AdvancedMonitoringService] Error in monitoring cycle:', error);
        }
        return result;
    }
    static async handleStatusTransition(customerId, type, newStatus) {
        try {
            // Check previous status in cache to avoid duplicate notifications
            const previous = monitoringCache.staticIPStatus.get(customerId);
            if (previous && previous.status === newStatus)
                return;
            // Get full customer info for notification (includes address and ODP name)
            const [customers] = await pool_1.databasePool.query(`SELECT 
                    c.id, c.name, c.customer_code, c.phone, c.connection_type, 
                    c.pppoe_username, c.static_ip, c.address, c.odp_id,
                    odp.name as odp_name
                 FROM customers c
                 LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                 WHERE c.id = ?`, [customerId]);
            if (customers.length > 0) {
                const customer = customers[0];
                const odpId = customer.odp_id;
                const odpName = customer.odp_name || (odpId ? `ODP-${odpId}` : null);
                // Update Cache immediately
                monitoringCache.staticIPStatus.set(customerId, {
                    customer_id: customerId,
                    status: newStatus,
                    last_check: new Date()
                });
                if (newStatus === 'offline') {
                    console.log(`[Status-Transition] Customer ${customer.name} is now OFFLINE.`);
                    // Persistent Update for Offline timestamp
                    const ipAddress = customer.static_ip || '0.0.0.0';
                    await pool_1.databasePool.query(`
                        INSERT INTO static_ip_ping_status (customer_id, ip_address, status, last_check, last_offline_at)
                        VALUES (?, ?, 'offline', NOW(), NOW())
                        ON DUPLICATE KEY UPDATE 
                            status = 'offline', 
                            last_check = NOW(), 
                            last_offline_at = CASE WHEN status != 'offline' THEN NOW() ELSE last_offline_at END
                    `, [customerId, ipAddress]);
                    // 1. Always notify Customer (AI Troubleshooting)
                    await CustomerNotificationService_1.default.sendAIAutomatedTroubleshooting(customer, 'offline');
                    // 2. Always send individual alert to Admins & Operators
                    await CustomerNotificationService_1.default.broadcastCustomerStatusToAdmins(customer, 'offline');
                    // 3. Additionally: Mass Outage Detection for ODP
                    if (odpId) {
                        if (!monitoringCache.odpOfflineCustomers.has(odpId)) {
                            monitoringCache.odpOfflineCustomers.set(odpId, new Set());
                        }
                        monitoringCache.odpOfflineCustomers.get(odpId).add(customerId);
                        const offlineCount = monitoringCache.odpOfflineCustomers.get(odpId).size;
                        if (offlineCount >= this.MASS_OUTAGE_THRESHOLD && !monitoringCache.odpAlertSent.get(odpId)) {
                            console.log(`[Mass-Outage] ODP ${odpName} has ${offlineCount} offline customers. Sending mass alert.`);
                            await CustomerNotificationService_1.default.broadcastInfrastructureIssue(odpName, 'ODP', 'offline', offlineCount);
                            monitoringCache.odpAlertSent.set(odpId, true);
                        }
                    }
                }
                else if (newStatus === 'online') {
                    // Start of 'online' logic - Only notify if previously offline
                    const wasOffline = previous && previous.status === 'offline';
                    if (!wasOffline) {
                        // If previous status was unknown, undefined, or 'online', do NOT notify 'online'.
                        // This prevents spam on restart/init.
                        console.log(`[Status-Transition] Customer ${customer.name} detected ONLINE (Initial/Unknown -> Online). Notification suppressed.`);
                    }
                    else {
                        console.log(`[Status-Transition] Customer ${customer.name} is back ONLINE (Recovered).`);
                        await pool_1.databasePool.query(`
                            UPDATE static_ip_ping_status SET status = 'online', last_check = NOW(), last_online_at = NOW() WHERE customer_id = ?
                        `, [customerId]);
                        // Notify Admins & Operators that customer is back online
                        await CustomerNotificationService_1.default.broadcastCustomerStatusToAdmins(customer, 'online');
                        // Notify Customer (Recovered)
                        await CustomerNotificationService_1.default.sendTroubleNotification(customer, 'recovered');
                    }
                    // Mass Outage Recovery Detection (Always run logic to clean up ODP state)
                    // Mass Outage Recovery Detection
                    if (odpId && monitoringCache.odpOfflineCustomers.has(odpId)) {
                        monitoringCache.odpOfflineCustomers.get(odpId).delete(customerId);
                        const remainingOffline = monitoringCache.odpOfflineCustomers.get(odpId).size;
                        // If ODP was in mass outage and now recovered below threshold
                        if (remainingOffline < this.MASS_OUTAGE_THRESHOLD && monitoringCache.odpAlertSent.get(odpId)) {
                            console.log(`[Mass-Outage] ODP ${odpName} recovered. ${remainingOffline} still offline.`);
                            await CustomerNotificationService_1.default.broadcastInfrastructureIssue(odpName, 'ODP', 'online', remainingOffline);
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
        }
        catch (error) {
            console.error('[Status-Transition] Error:', error);
        }
    }
    /**
     * Check for PPPoE customers that just went offline
     */
    static async checkPPPoETransitions() {
        try {
            // Find active pppoe customers
            const [pppoeCustomers] = await pool_1.databasePool.query(`
                SELECT id, name, pppoe_username 
                FROM customers 
                WHERE connection_type = 'pppoe' 
                    AND status = 'active'
                    AND (is_isolated = 0 OR is_isolated IS NULL)
            `);
            for (const customer of pppoeCustomers) {
                // Case-insensitive check
                let isOnline = false;
                if (customer.pppoe_username) {
                    const searchTarget = customer.pppoe_username.toLowerCase();
                    if (monitoringCache.pppoeOnlineSessions.has(customer.pppoe_username)) {
                        isOnline = true;
                    }
                    else {
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
        }
        catch (error) {
            console.error('[PPPoE-Transitions] Error:', error);
        }
    }
    /**
     * Get cache statistics for debugging
     */
    static getCacheStats() {
        return {
            pppoe_sessions: monitoringCache.pppoeOnlineSessions.size,
            static_ip_statuses: monitoringCache.staticIPStatus.size,
            last_refresh: monitoringCache.lastRefresh
        };
    }
}
exports.AdvancedMonitoringService = AdvancedMonitoringService;
/**
 * Handle customer status transition and trigger AI support if needed
 */
AdvancedMonitoringService.MASS_OUTAGE_THRESHOLD = 3; // Min offline customers to trigger mass alert
exports.default = AdvancedMonitoringService;
//# sourceMappingURL=AdvancedMonitoringService.js.map