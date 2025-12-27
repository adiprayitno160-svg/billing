"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringController = void 0;
const pool_1 = require("../../db/pool");
const pppoeService_1 = require("../../services/pppoeService");
const mikrotikService_1 = require("../../services/mikrotikService");
const monitoringAnalyticsService_1 = __importDefault(require("../../services/monitoring/monitoringAnalyticsService"));
const incidentAIService_1 = __importDefault(require("../../services/monitoring/incidentAIService"));
const NetworkMonitoringService_1 = __importDefault(require("../../services/monitoring/NetworkMonitoringService"));
class MonitoringController {
    /**
     * Dashboard monitoring - gabungan PPPoE dan Static IP
     */
    async getMonitoringDashboard(req, res) {
        try {
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get PPPoE statistics
                const [pppoeStats] = await conn.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN is_isolated = 1 THEN 1 ELSE 0 END) as isolated
                    FROM customers 
                    WHERE connection_type = 'pppoe'
                `);
                // Get Static IP statistics
                const [staticIpStats] = await conn.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
                    FROM static_ip_clients
                `);
                // Get online sessions from MikroTik
                let onlinePPPoE = 0;
                try {
                    const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
                    if (mikrotikConfig) {
                        const activeSessions = await (0, mikrotikService_1.getPppoeActiveConnections)(mikrotikConfig);
                        onlinePPPoE = activeSessions.length;
                    }
                }
                catch (error) {
                    console.error('Error fetching MikroTik data:', error);
                }
                res.render('monitoring/dashboard', {
                    title: 'Monitor Pelanggan',
                    pppoeStats: pppoeStats[0],
                    staticIpStats: staticIpStats[0],
                    onlinePPPoE
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error loading monitoring dashboard:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat dashboard monitoring'
            });
        }
    }
    /**
     * Monitor Troubled Customers (Full Page)
     */
    async monitorTrouble(req, res) {
        try {
            const troubleCustomers = await NetworkMonitoringService_1.default.getTroubleCustomers();
            res.render('monitoring/trouble', {
                title: 'Monitor Pelanggan Trouble',
                currentPath: '/monitoring/trouble',
                troubleCustomers,
                updatedAt: new Date(),
                fullWidth: true
            });
        }
        catch (error) {
            console.error('Error loading trouble monitoring:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat monitoring trouble: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
    /**
     * Monitor PPPoE Customers
     */
    async monitorPPPoE(req, res) {
        try {
            console.log('=== MONITORING PPPOE REQUEST ===');
            const page = parseInt(req.query.page) || 1;
            const limit = 50;
            const offset = (page - 1) * limit;
            const search = req.query.search || '';
            const status = req.query.status || '';
            const odc_id = req.query.odc_id || '';
            console.log('Query params:', { page, limit, offset, search, status, odc_id });
            // Build query conditions
            const whereConditions = ["connection_type = 'pppoe'"];
            const queryParams = [];
            if (search) {
                whereConditions.push('(c.name LIKE ? OR c.customer_code LIKE ? OR c.pppoe_username LIKE ?)');
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (status) {
                whereConditions.push('c.status = ?');
                queryParams.push(status);
            }
            if (odc_id) {
                whereConditions.push('c.odc_id = ?');
                queryParams.push(odc_id);
            }
            const whereClause = 'WHERE ' + whereConditions.join(' AND ');
            console.log('Where clause:', whereClause);
            // Get customers with package info through subscriptions
            const customersQuery = `
                SELECT 
                    c.*,
                    s.package_name,
                    pp.rate_limit_rx,
                    pp.rate_limit_tx,
                    s.price,
                    odc.name as odc_name,
                    odc.location as odc_location
                FROM customers c
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
                LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
                ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `;
            console.log('Executing customers query...');
            const [customers] = await pool_1.databasePool.query(customersQuery, [...queryParams, limit, offset]);
            console.log(`Found ${customers.length} customers`);
            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM customers c ${whereClause}`;
            console.log('Executing count query...');
            const [countResult] = await pool_1.databasePool.query(countQuery, queryParams);
            const totalCount = countResult[0]?.total || 0;
            console.log('Total count:', totalCount);
            // Get ODC list for filter
            console.log('Fetching ODC list...');
            const [odcList] = await pool_1.databasePool.query('SELECT id, name FROM ftth_odc ORDER BY name');
            console.log(`Found ${odcList.length} ODC entries`);
            // Get online sessions from MikroTik
            let onlineSessions = [];
            try {
                console.log('Fetching MikroTik config...');
                const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
                if (mikrotikConfig) {
                    console.log('MikroTik config found, fetching active connections...');
                    onlineSessions = await (0, mikrotikService_1.getPppoeActiveConnections)(mikrotikConfig);
                    console.log(`Found ${onlineSessions.length} active sessions`);
                }
                else {
                    console.log('⚠️  MikroTik config not found, skipping session check');
                }
            }
            catch (error) {
                console.error('Error fetching active sessions:', error instanceof Error ? error.message : String(error));
            }
            // Merge online status
            console.log('Merging online status with customers...');
            const customersWithStatus = customers.map(customer => ({
                ...customer,
                is_online: onlineSessions.some(session => session.name === customer.pppoe_username),
                session_info: onlineSessions.find(session => session.name === customer.pppoe_username) || null
            }));
            console.log('Rendering view...');
            res.render('monitoring/pppoe', {
                title: 'Monitor PPPoE',
                currentPath: '/monitoring/pppoe',
                customers: customersWithStatus,
                odcList: odcList || [],
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    limit
                },
                filters: { search, status, odc_id }
            });
            console.log('✅ View rendered successfully');
        }
        catch (error) {
            console.error('❌ Error monitoring PPPoE:', error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack trace',
                code: error.code,
                errno: error.errno
            });
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat monitoring PPPoE: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
    /**
     * Monitor Static IP Customers with Real Ping Status
     */
    async monitorStaticIP(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 50;
            const offset = (page - 1) * limit;
            const search = req.query.search || '';
            const status = req.query.status || '';
            const pingStatus = req.query.ping_status || '';
            // Build query
            const whereConditions = [];
            const queryParams = [];
            if (search) {
                whereConditions.push('(sic.client_name LIKE ? OR sic.ip_address LIKE ? OR sic.customer_code LIKE ?)');
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (status) {
                whereConditions.push('sic.status = ?');
                queryParams.push(status);
            }
            if (pingStatus) {
                // Filter by ping status - need to join with ping status table
                if (pingStatus === 'isolated') {
                    whereConditions.push('c.is_isolated = 1');
                }
                else {
                    whereConditions.push('(c.is_isolated = 0 AND sips.status = ?)');
                    queryParams.push(pingStatus);
                }
            }
            const whereClause = whereConditions.length > 0
                ? 'WHERE ' + whereConditions.join(' AND ')
                : '';
            // Get static IP clients with ping status
            const clientsQuery = `
                SELECT 
                    sic.*,
                    pkg.name as package_name,
                    pkg.price,
                    pkg.max_limit_download,
                    pkg.max_limit_upload,
                    odc.name as odc_name,
                    c.is_isolated,
                    sips.status as ping_status,
                    sips.response_time_ms,
                    sips.packet_loss_percent,
                    sips.consecutive_failures,
                    sips.last_check as ping_last_check,
                    sips.last_online_at as ping_last_online,
                    sips.last_offline_at as ping_last_offline,
                    sips.uptime_percent_24h
                FROM static_ip_clients sic
                LEFT JOIN static_ip_packages pkg ON sic.package_id = pkg.id
                LEFT JOIN ftth_odc odc ON sic.odc_id = odc.id
                LEFT JOIN customers c ON sic.customer_id = c.id
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                ${whereClause}
                ORDER BY sic.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const [clients] = await pool_1.databasePool.query(clientsQuery, [...queryParams, limit, offset]);
            // Get total count with same joins and filters
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM static_ip_clients sic 
                LEFT JOIN customers c ON sic.customer_id = c.id
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                ${whereClause}
            `;
            const [countResult] = await pool_1.databasePool.query(countQuery, queryParams);
            const totalCount = countResult[0]?.total || 0;
            // Import utility function untuk menghitung IP client dari CIDR
            const { calculateCustomerIP } = await Promise.resolve().then(() => __importStar(require('../../utils/ipHelper')));
            // Merge with ping status and calculate downtime
            const clientsWithStatus = await Promise.all(clients.map(async (client) => {
                // Calculate peer IP (router client IP) for display
                // IMPORTANT: IP yang disimpan di database adalah gateway IP dengan CIDR (192.168.1.1/30)
                // IP yang ditampilkan ke user harus IP client (192.168.1.2)
                const peerIP = client.ip_address ? calculateCustomerIP(client.ip_address) : '';
                // Get current downtime if offline
                let currentDowntime = null;
                if (client.ping_status === 'offline' && !client.is_isolated) {
                    const [downtimeResult] = await pool_1.databasePool.query(`SELECT 
                            start_time,
                            TIMESTAMPDIFF(MINUTE, start_time, NOW()) as duration_minutes
                        FROM sla_incidents
                        WHERE customer_id = ? 
                            AND status = 'ongoing'
                            AND service_type = 'static_ip'
                        ORDER BY start_time DESC
                        LIMIT 1`, [client.customer_id]);
                    if (downtimeResult.length > 0) {
                        currentDowntime = downtimeResult[0];
                    }
                }
                // Determine actual status
                let actualStatus = 'unknown';
                if (client.is_isolated) {
                    actualStatus = 'isolated';
                }
                else if (client.ping_status === 'online') {
                    actualStatus = 'online';
                }
                else if (client.ping_status === 'offline') {
                    actualStatus = 'offline';
                }
                else if (client.ping_status === 'degraded') {
                    actualStatus = 'degraded';
                }
                return {
                    ...client,
                    actual_status: actualStatus,
                    current_downtime: currentDowntime,
                    peer_ip: peerIP, // Add peer IP for display
                    mikrotik_ip: client.ip_address // Keep original MikroTik IP for reference
                };
            }));
            // Filter by ping status if requested
            let filteredClients = clientsWithStatus;
            if (pingStatus) {
                filteredClients = clientsWithStatus.filter(c => c.actual_status === pingStatus);
            }
            // Calculate stats
            const stats = {
                total: totalCount,
                online: clientsWithStatus.filter(c => c.actual_status === 'online').length,
                offline: clientsWithStatus.filter(c => c.actual_status === 'offline').length,
                degraded: clientsWithStatus.filter(c => c.actual_status === 'degraded').length,
                isolated: clientsWithStatus.filter(c => c.actual_status === 'isolated').length,
                unknown: clientsWithStatus.filter(c => c.actual_status === 'unknown').length
            };
            res.render('monitoring/static-ip', {
                currentPath: '/monitoring/static-ip',
                title: 'Monitor Static IP',
                clients: filteredClients,
                stats,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    limit
                },
                filters: { search, status, ping_status: pingStatus }
            });
        }
        catch (error) {
            console.error('Error monitoring Static IP:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat monitoring Static IP'
            });
        }
    }
    /**
     * Get customer detail with online status
     */
    async getCustomerDetail(req, res) {
        try {
            const { customerId } = req.params;
            // Get customer data with package info through subscriptions
            const [customers] = await pool_1.databasePool.query(`SELECT c.*, 
                        s.package_name, 
                        pp.rate_limit_rx, 
                        pp.rate_limit_tx,
                        s.price,
                        odc.name as odc_name,
                        odc.location as odc_location
                 FROM customers c
                 LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                 LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
                 LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
                 WHERE c.id = ?`, [customerId]);
            if (customers.length === 0) {
                res.status(404).json({ success: false, message: 'Customer not found' });
                return;
            }
            const customer = customers[0];
            if (!customer) {
                res.status(404).json({ success: false, message: 'Customer not found' });
                return;
            }
            // Get online status from MikroTik
            let sessionInfo = null;
            try {
                const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
                if (mikrotikConfig) {
                    const activeSessions = await (0, mikrotikService_1.getPppoeActiveConnections)(mikrotikConfig);
                    sessionInfo = activeSessions.find((s) => s.name === customer.pppoe_username);
                }
            }
            catch (error) {
                console.error('Error fetching session info:', error);
            }
            res.json({
                success: true,
                customer: {
                    ...customer,
                    is_online: !!sessionInfo,
                    session_info: sessionInfo
                }
            });
        }
        catch (error) {
            console.error('Error getting customer detail:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan detail customer'
            });
        }
    }
    /**
     * Disconnect PPPoE session
     */
    async disconnectPPPoESession(req, res) {
        try {
            const { sessionId } = req.body;
            if (!sessionId) {
                res.status(400).json({ success: false, message: 'Session ID required' });
                return;
            }
            const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
            if (!mikrotikConfig) {
                res.status(500).json({ success: false, message: 'MikroTik config not found' });
                return;
            }
            // Import the MikrotikService class
            const { MikrotikService } = await Promise.resolve().then(() => __importStar(require('../../services/mikrotik/MikrotikService')));
            const mikrotik = new MikrotikService(mikrotikConfig);
            await mikrotik.disconnectPPPoESession(sessionId);
            res.json({
                success: true,
                message: 'Session berhasil diputus'
            });
        }
        catch (error) {
            console.error('Error disconnecting session:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal memutus session'
            });
        }
    }
    /**
     * Get real-time traffic statistics
     */
    async getTrafficStats(req, res) {
        try {
            const { username } = req.params;
            const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
            if (!mikrotikConfig) {
                res.json({ success: false, message: 'MikroTik config not found', online: false });
                return;
            }
            const sessions = await (0, mikrotikService_1.getPppoeActiveConnections)(mikrotikConfig);
            const session = sessions.find((s) => s.name === username);
            if (!session) {
                res.json({
                    success: false,
                    message: 'Session not found',
                    online: false
                });
                return;
            }
            res.json({
                success: true,
                online: true,
                data: {
                    upload: session['bytes-in'] || session['bytes_in'] || 0,
                    download: session['bytes-out'] || session['bytes_out'] || 0,
                    uptime: session.uptime || '0s',
                    address: session.address || '-'
                }
            });
        }
        catch (error) {
            console.error('Error getting traffic stats:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan statistik'
            });
        }
    }
    /**
     * Get Static IP ping status and downtime history
     */
    async getStaticIPStatus(req, res) {
        try {
            const { customerId } = req.params;
            // Get customer and ping status - try from static_ip_clients first since customer_id might be in sic table
            // Handle both cases: customer_id from customers table or from static_ip_clients table
            let [customerResult] = await pool_1.databasePool.query(`SELECT 
                    COALESCE(c.id, sic.customer_id) as id,
                    COALESCE(c.name, sic.client_name) as name,
                    COALESCE(c.customer_code, sic.customer_code) as customer_code,
                    COALESCE(c.is_isolated, 0) as is_isolated,
                    sic.ip_address, 
                    sic.client_name,
                    sips.status as ping_status,
                    sips.response_time_ms,
                    sips.packet_loss_percent,
                    sips.consecutive_failures,
                    sips.last_check,
                    sips.last_online_at,
                    sips.last_offline_at,
                    sips.uptime_percent_24h
                FROM static_ip_clients sic
                LEFT JOIN customers c ON sic.customer_id = c.id
                LEFT JOIN static_ip_ping_status sips ON sic.customer_id = sips.customer_id
                WHERE sic.customer_id = ? OR sic.id = ?`, [customerId, customerId]);
            // If not found, try by static_ip_clients.id
            if (customerResult.length === 0) {
                [customerResult] = await pool_1.databasePool.query(`SELECT 
                        sic.customer_id as id,
                        sic.client_name as name,
                        sic.customer_code,
                        0 as is_isolated,
                        sic.ip_address, 
                        sic.client_name,
                        sips.status as ping_status,
                        sips.response_time_ms,
                        sips.packet_loss_percent,
                        sips.consecutive_failures,
                        sips.last_check,
                        sips.last_online_at,
                        sips.last_offline_at,
                        sips.uptime_percent_24h
                    FROM static_ip_clients sic
                    LEFT JOIN static_ip_ping_status sips ON sic.customer_id = sips.customer_id
                    WHERE sic.id = ?`, [customerId]);
            }
            if (customerResult.length === 0) {
                res.status(404).json({ success: false, message: 'Customer not found' });
                return;
            }
            const customer = customerResult[0];
            // customer.id is already COALESCE(c.id, sic.customer_id) from the query
            // Use it for queries that require a valid customer_id from customers table
            const actualCustomerId = customer?.id;
            if (!actualCustomerId) {
                return res.status(404).json({ success: false, error: 'Customer not found' });
            }
            // IMPORTANT: Proses IP address untuk static IP
            // IP yang disimpan di database adalah gateway IP dengan CIDR (192.168.1.1/30)
            // IP yang ditampilkan ke user harus IP client (192.168.1.2)
            const { calculateCustomerIP } = await Promise.resolve().then(() => __importStar(require('../../utils/ipHelper')));
            if (customer.ip_address) {
                customer.ip_address_display = calculateCustomerIP(customer.ip_address);
            }
            // If we don't have a valid customer_id, we can't get downtime history
            // (downtime history is linked to customers.id, not static_ip_clients.id)
            if (!actualCustomerId) {
                res.json({
                    success: true,
                    data: {
                        customer,
                        downtime_history: [],
                        ongoing_incident: null,
                        connection_logs: []
                    }
                });
                return;
            }
            // Get downtime history (last 30 days)
            const [downtimeHistory] = await pool_1.databasePool.query(`SELECT 
                    id,
                    incident_type,
                    start_time,
                    end_time,
                    duration_minutes,
                    status,
                    exclude_reason,
                    is_counted_in_sla
                FROM sla_incidents
                WHERE customer_id = ?
                    AND service_type = 'static_ip'
                    AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                ORDER BY start_time DESC
                LIMIT 100`, [actualCustomerId]);
            // Get current ongoing incident
            const [ongoingIncident] = await pool_1.databasePool.query(`SELECT 
                    id,
                    start_time,
                    TIMESTAMPDIFF(MINUTE, start_time, NOW()) as duration_minutes
                FROM sla_incidents
                WHERE customer_id = ?
                    AND service_type = 'static_ip'
                    AND status = 'ongoing'
                LIMIT 1`, [actualCustomerId]);
            // Get 24h connection logs for uptime chart
            const [connectionLogs] = await pool_1.databasePool.query(`SELECT 
                    timestamp,
                    status,
                    response_time_ms,
                    packet_loss_percent
                FROM connection_logs
                WHERE customer_id = ?
                    AND service_type = 'static_ip'
                    AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                ORDER BY timestamp ASC`, [actualCustomerId]);
            res.json({
                success: true,
                data: {
                    customer,
                    downtime_history: downtimeHistory,
                    ongoing_incident: ongoingIncident.length > 0 ? ongoingIncident[0] : null,
                    connection_logs: connectionLogs
                }
            });
        }
        catch (error) {
            console.error('Error getting static IP status:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan status Static IP'
            });
        }
    }
    /**
     * Get downtime history for Static IP customer
     */
    async getDowntimeHistory(req, res) {
        try {
            const { customerId } = req.params;
            const days = parseInt(req.query.days) || 30;
            const [history] = await pool_1.databasePool.query(`SELECT 
                    si.id,
                    si.incident_type,
                    si.start_time,
                    si.end_time,
                    si.duration_minutes,
                    si.status,
                    si.exclude_reason,
                    si.exclude_notes,
                    si.is_counted_in_sla,
                    c.name as customer_name,
                    c.customer_code
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                WHERE si.customer_id = ?
                    AND si.service_type = 'static_ip'
                    AND si.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY si.start_time DESC`, [customerId, days]);
            // Calculate statistics
            const stats = {
                total_incidents: history.length,
                counted_incidents: history.filter(h => h.is_counted_in_sla).length,
                excluded_incidents: history.filter(h => !h.is_counted_in_sla).length,
                total_downtime_minutes: history.reduce((sum, h) => sum + (h.duration_minutes || 0), 0),
                counted_downtime_minutes: history.filter(h => h.is_counted_in_sla).reduce((sum, h) => sum + (h.duration_minutes || 0), 0)
            };
            res.json({
                success: true,
                data: {
                    history,
                    stats
                }
            });
        }
        catch (error) {
            console.error('Error getting downtime history:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan riwayat downtime'
            });
        }
    }
    /**
     * GET /monitoring/analytics/bandwidth
     * Get bandwidth analytics
     */
    async getBandwidthAnalytics(req, res) {
        try {
            const days = parseInt(req.query.days) || 30;
            const summary = await monitoringAnalyticsService_1.default.getBandwidthSummary();
            const trend = await monitoringAnalyticsService_1.default.getBandwidthTrend(days);
            const topCustomers = await monitoringAnalyticsService_1.default.getTopCustomersByBandwidth(10);
            const byArea = await monitoringAnalyticsService_1.default.getBandwidthByArea(days);
            res.json({
                success: true,
                data: {
                    summary,
                    trend,
                    top_customers: topCustomers,
                    by_area: byArea
                }
            });
        }
        catch (error) {
            console.error('Error getting bandwidth analytics:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan analytics bandwidth'
            });
        }
    }
    /**
     * GET /monitoring/analytics/health
     * Get network health overview
     */
    async getNetworkHealth(req, res) {
        try {
            const health = await monitoringAnalyticsService_1.default.getNetworkHealth();
            res.json({
                success: true,
                data: health
            });
        }
        catch (error) {
            console.error('Error getting network health:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan health network'
            });
        }
    }
    /**
     * GET /monitoring/analytics/anomalies
     * Get real-time anomalies
     */
    async getAnomalies(req, res) {
        try {
            const anomalies = await incidentAIService_1.default.detectRealTimeAnomalies();
            res.json({
                success: true,
                data: anomalies
            });
        }
        catch (error) {
            console.error('Error getting anomalies:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan anomalies'
            });
        }
    }
    /**
     * GET /monitoring/analytics/incident/:id
     * Get AI analysis for specific incident
     */
    async getIncidentAnalysis(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'id is required' });
            }
            const incidentId = parseInt(id);
            if (isNaN(incidentId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid incident ID'
                });
                return;
            }
            const analysis = await incidentAIService_1.default.analyzeIncident(incidentId);
            if (!analysis) {
                res.status(404).json({
                    success: false,
                    message: 'Incident not found or analysis unavailable'
                });
                return;
            }
            res.json({
                success: true,
                data: analysis
            });
        }
        catch (error) {
            console.error('Error getting incident analysis:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan analisis incident'
            });
        }
    }
    /**
     * GET /monitoring/ai
     * Monitoring AI Analytics page
     */
    async getAIAnalyticsPage(req, res) {
        try {
            // Get recent incidents for analysis
            const [recentIncidents] = await pool_1.databasePool.query(`
                SELECT 
                    si.id,
                    si.customer_id,
                    si.service_type,
                    si.incident_type,
                    si.start_time,
                    si.end_time,
                    si.duration_minutes,
                    si.status,
                    c.name as customer_name,
                    odc.name as area
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                LEFT JOIN odc_list odc ON c.odc_id = odc.id
                WHERE si.status IN ('ongoing', 'resolved')
                ORDER BY si.start_time DESC
                LIMIT 50
            `);
            res.render('monitoring/ai', {
                title: 'Monitoring AI Analytics',
                currentPath: '/monitoring/ai',
                recentIncidents: recentIncidents || []
            });
        }
        catch (error) {
            console.error('Error loading AI Analytics page:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman Monitoring AI'
            });
        }
    }
}
exports.MonitoringController = MonitoringController;
//# sourceMappingURL=monitoringController.js.map