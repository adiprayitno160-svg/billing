import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getMikrotikConfig } from '../../services/pppoeService';
import { getPppoeActiveConnections, getPppoeSecrets } from '../../services/mikrotikService';
import MonitoringAnalyticsService from '../../services/monitoring/monitoringAnalyticsService';
import IncidentAIService from '../../services/monitoring/incidentAIService';
import NetworkMonitoringService from '../../services/monitoring/NetworkMonitoringService';
import BandwidthLogService from '../../services/bandwidthLogService';

export class MonitoringController {

    /**
     * Dashboard monitoring - gabungan PPPoE dan Static IP
     */
    async getMonitoringDashboard(req: Request, res: Response): Promise<void> {
        try {
            const conn = await databasePool.getConnection();
            try {
                // Get PPPoE statistics
                const [pppoeStats] = await conn.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN is_isolated = 1 THEN 1 ELSE 0 END) as isolated
                    FROM customers 
                    WHERE connection_type = 'pppoe'
                `) as [RowDataPacket[], any];

                // Get Static IP statistics
                const [staticIpStats] = await conn.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
                    FROM static_ip_clients
                `) as [RowDataPacket[], any];

                // Get online sessions from MikroTik
                let onlinePPPoE = 0;
                let healthInfo: any[] = [];

                try {
                    const mikrotikConfig = await getMikrotikConfig();
                    if (mikrotikConfig) {
                        const activeSessions = await getPppoeActiveConnections(mikrotikConfig);
                        onlinePPPoE = activeSessions.length;

                        // Fetch health info (temperature, voltage)
                        const { getSystemHealth } = await import('../../services/mikrotikService');
                        healthInfo = await getSystemHealth(mikrotikConfig);
                    }
                } catch (error) {
                    console.error('Error fetching MikroTik data:', error);
                }

                let serverInfo = {
                    cpuUsage: 0,
                    memUsage: 0,
                    uptime: 0,
                    hostname: 'Unknown',
                    platform: 'Unknown',
                    arch: 'Unknown',
                    temperature: 'N/A'
                };

                try {
                    const os = await import('os');
                    const { exec } = await import('child_process');
                    const { promisify } = await import('util');
                    const execAsync = promisify(exec);

                    // Get CPU and Memory
                    serverInfo.cpuUsage = Math.round(os.loadavg()[0] * 10) % 100;
                    serverInfo.memUsage = Math.round((1 - os.freemem() / os.totalmem()) * 100);
                    serverInfo.uptime = Math.round(os.uptime() / 3600);
                    serverInfo.hostname = os.hostname();
                    serverInfo.platform = os.platform();
                    serverInfo.arch = os.arch();

                    // Try to get Temperature (Windows specific)
                    if (os.platform() === 'win32') {
                        try {
                            const { stdout } = await execAsync('powershell -Command "Get-CimInstance -Namespace root/wmi -ClassName MsAcpi_ThermalZoneTemperature | Select-Object -ExpandProperty CurrentTemperature"', { timeout: 2000 });
                            const tempK = parseFloat(stdout.trim());
                            if (!isNaN(tempK)) {
                                serverInfo.temperature = ((tempK / 10) - 273.15).toFixed(1) + '°C';
                            }
                        } catch (tempErr) {
                            // Silently fail if WMI is not accessible
                        }
                    } else if (os.platform() === 'linux') {
                        try {
                            // Try lm-sensors
                            const { stdout } = await execAsync('sensors', { timeout: 2000 });
                            // Look for "Core 0: +45.0°C" or "temp1: +45.0°C"
                            const match = stdout.match(/(?:Core\s+\d+|temp\d+):\s+[+]?(\d+\.\d+)°C/);
                            if (match && match[1]) {
                                serverInfo.temperature = match[1] + '°C';
                            }
                        } catch (e) {
                            // If sensors command fails, try reading thermal_zone0
                            try {
                                const { stdout } = await execAsync('cat /sys/class/thermal/thermal_zone0/temp');
                                const temp = parseInt(stdout.trim());
                                if (!isNaN(temp)) {
                                    serverInfo.temperature = (temp / 1000).toFixed(1) + '°C';
                                }
                            } catch (err) {
                                // Ignore
                            }
                        }
                    }
                } catch (osError) {
                    console.error('Error fetching OS stats:', osError);
                }

                res.render('monitoring/dashboard', {
                    title: 'Monitor Pelanggan',
                    pppoeStats: pppoeStats[0] || { total: 0, online: 0 },
                    staticIpStats: staticIpStats[0] || { total: 0, online: 0 },
                    onlinePPPoE,
                    healthInfo,
                    serverInfo,
                    layout: 'layouts/main'
                });
            } finally {
                conn.release();
            }
        } catch (error) {
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
    async monitorTrouble(req: Request, res: Response): Promise<void> {
        try {
            const troubleCustomers = await NetworkMonitoringService.getTroubleCustomers();

            res.render('monitoring/trouble', {
                title: 'Monitor Pelanggan Trouble',
                currentPath: '/monitoring/trouble',
                troubleCustomers,
                updatedAt: new Date(),
                fullWidth: true
            });
        } catch (error) {
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
    async monitorPPPoE(req: Request, res: Response): Promise<void> {
        try {
            console.log('=== MONITORING PPPOE REQUEST ===');
            const page = parseInt(req.query.page as string) || 1;
            const limit = 50;
            const offset = (page - 1) * limit;
            const search = req.query.search as string || '';
            const status = req.query.status as string || '';
            const odc_id = req.query.odc_id as string || '';

            console.log('Query params:', { page, limit, offset, search, status, odc_id });

            // Build query conditions
            const whereConditions: string[] = ["connection_type = 'pppoe'"];
            const queryParams: any[] = [];

            if (search) {
                whereConditions.push('(c.name LIKE ? OR c.customer_code LIKE ? OR c.pppoe_username LIKE ?)');
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            if (status) {
                whereConditions.push('c.status = ?');
                queryParams.push(status);
            }

            if (req.query.odp_id) {
                whereConditions.push('c.odp_id = ?');
                queryParams.push(req.query.odp_id);
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
                    odp.name as odp_name,
                    odp.location as odp_location,
                    (SELECT ROUND(SUM(bytes_in) / 1024 / 1024 / 1024, 2) FROM bandwidth_logs WHERE customer_id = c.id AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as usage_rx_gb,
                    (SELECT ROUND(SUM(bytes_out) / 1024 / 1024 / 1024, 2) FROM bandwidth_logs WHERE customer_id = c.id AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as usage_tx_gb
                FROM customers c
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
                LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `;

            console.log('Executing customers query...');
            const [customers] = await databasePool.query(
                customersQuery,
                [...queryParams, limit, offset]
            ) as [RowDataPacket[], any];
            console.log(`Found ${customers.length} customers`);

            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM customers c ${whereClause}`;
            console.log('Executing count query...');
            const [countResult] = await databasePool.query(countQuery, queryParams) as [RowDataPacket[], any];
            const totalCount = countResult[0]?.total || 0;
            console.log('Total count:', totalCount);

            // Get ODP list for filter
            console.log('Fetching ODP list...');
            const [odpList] = await databasePool.query('SELECT id, name FROM ftth_odp ORDER BY name') as [RowDataPacket[], any];
            console.log(`Found ${odpList.length} ODP entries`);

            // Get online sessions from MikroTik
            let onlineSessions: any[] = [];
            try {
                console.log('Fetching MikroTik config...');
                const mikrotikConfig = await getMikrotikConfig();
                if (mikrotikConfig) {
                    console.log('MikroTik config found, fetching active connections...');
                    onlineSessions = await getPppoeActiveConnections(mikrotikConfig);
                    console.log(`Found ${onlineSessions.length} active sessions`);
                } else {
                    console.log('⚠️  MikroTik config not found, skipping session check');
                }
            } catch (error: any) {
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
                odpList: odpList || [],
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    limit
                },
                filters: { search, status, odp_id: req.query.odp_id }
            });
            console.log('✅ View rendered successfully');
        } catch (error: any) {
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
    async monitorStaticIP(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = 50;
            const offset = (page - 1) * limit;
            const search = req.query.search as string || '';
            const status = req.query.status as string || '';
            const pingStatus = req.query.ping_status as string || '';

            // Build query
            const whereConditions: string[] = [];
            const queryParams: any[] = [];

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
                } else {
                    whereConditions.push('(c.is_isolated = 0 AND sips.status = ?)');
                    queryParams.push(pingStatus);
                }
            }

            if (req.query.odp_id) {
                whereConditions.push('c.odp_id = ?');
                queryParams.push(req.query.odp_id);
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
                    odp.name as odp_name,
                    c.is_isolated,
                    c.serial_number,
                    sips.status as ping_status,
                    sips.response_time_ms,
                    sips.packet_loss_percent,
                    sips.consecutive_failures,
                    sips.last_check as ping_last_check,
                    sips.last_online_at as ping_last_online,
                    sips.last_offline_at as ping_last_offline,
                    sips.uptime_percent_24h,
                    (SELECT ROUND(SUM(bytes_in) / 1024 / 1024 / 1024, 2) FROM bandwidth_logs WHERE customer_id = c.id AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as usage_rx_gb,
                    (SELECT ROUND(SUM(bytes_out) / 1024 / 1024 / 1024, 2) FROM bandwidth_logs WHERE customer_id = c.id AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as usage_tx_gb
                FROM static_ip_clients sic
                LEFT JOIN static_ip_packages pkg ON sic.package_id = pkg.id
                LEFT JOIN customers c ON sic.customer_id = c.id
                LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                ${whereClause}
                ORDER BY sic.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const [clients] = await databasePool.query(
                clientsQuery,
                [...queryParams, limit, offset]
            ) as [RowDataPacket[], any];

            // Get total count with same joins and filters
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM static_ip_clients sic 
                LEFT JOIN customers c ON sic.customer_id = c.id
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                ${whereClause}
            `;
            const [countResult] = await databasePool.query(countQuery, queryParams) as [RowDataPacket[], any];
            const totalCount = countResult[0]?.total || 0;

            // Import utility function untuk menghitung IP client dari CIDR
            const { calculateCustomerIP } = await import('../../utils/ipHelper');

            // Merge with ping status and calculate downtime
            const clientsWithStatus = await Promise.all(clients.map(async client => {
                // Calculate peer IP (router client IP) for display
                // IMPORTANT: IP yang disimpan di database adalah gateway IP dengan CIDR (192.168.1.1/30)
                // IP yang ditampilkan ke user harus IP client (192.168.1.2)
                const peerIP = client.ip_address ? calculateCustomerIP(client.ip_address) : '';

                // Get current downtime if offline
                let currentDowntime = null;
                if (client.ping_status === 'offline' && !client.is_isolated) {
                    const [downtimeResult] = await databasePool.query(
                        `SELECT 
                            start_time,
                            TIMESTAMPDIFF(MINUTE, start_time, NOW()) as duration_minutes
                        FROM sla_incidents
                        WHERE customer_id = ? 
                            AND status = 'ongoing'
                            AND service_type = 'static_ip'
                        ORDER BY start_time DESC
                        LIMIT 1`,
                        [client.customer_id]
                    ) as [RowDataPacket[], any];

                    if (downtimeResult.length > 0) {
                        currentDowntime = downtimeResult[0];
                    }
                }

                // Determine actual status
                let actualStatus = 'unknown';
                if (client.is_isolated) {
                    actualStatus = 'isolated';
                } else if (client.ping_status === 'online') {
                    actualStatus = 'online';
                } else if (client.ping_status === 'offline') {
                    actualStatus = 'offline';
                } else if (client.ping_status === 'degraded') {
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

            // Get ODP list for filter
            const [odpList] = await databasePool.query('SELECT id, name FROM ftth_odp ORDER BY name') as [RowDataPacket[], any];

            res.render('monitoring/static-ip', {
                currentPath: '/monitoring/static-ip',
                title: 'Monitor Static IP',
                clients: filteredClients,
                stats,
                odpList: odpList || [],
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    limit
                },
                filters: { search, status, ping_status: pingStatus, odp_id: req.query.odp_id },
                layout: 'layouts/main'
            });
        } catch (error) {
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
    async getCustomerDetail(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;

            // Get customer data with package info through subscriptions OR pppoe_profiles
            const [customers] = await databasePool.query(
                `SELECT c.*, 
                        COALESCE(s.package_name, pp_profile.name) as package_name, 
                        COALESCE(pp_sub.rate_limit_rx, pp_profile.rate_limit_rx) as rate_limit_rx, 
                        COALESCE(pp_sub.rate_limit_tx, pp_profile.rate_limit_tx) as rate_limit_tx,
                        COALESCE(s.price, pp_profile.price, 0) as price,
                        odc.name as odc_name,
                        odc.location as odc_location,
                        odp.name as odp_name
                 FROM customers c
                 LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                 LEFT JOIN pppoe_packages pp_sub ON s.package_id = pp_sub.id
                 LEFT JOIN pppoe_profiles pp_profile ON c.pppoe_profile_id = pp_profile.id
                 LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
                 LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                 WHERE c.id = ?`,
                [customerId]
            ) as [RowDataPacket[], any];

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
                const mikrotikConfig = await getMikrotikConfig();
                if (mikrotikConfig) {
                    const activeSessions = await getPppoeActiveConnections(mikrotikConfig);
                    sessionInfo = activeSessions.find((s: any) => s.name === customer.pppoe_username);

                    // If online, try to get profile/rate-limit from session if not from DB
                    if (sessionInfo && !customer.package_name) {
                        customer.package_name = sessionInfo.profile || sessionInfo.service || null;
                    }
                }
            } catch (error) {
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
        } catch (error: any) {
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
    async disconnectPPPoESession(req: Request, res: Response): Promise<void> {
        try {
            const { sessionId } = req.body;

            if (!sessionId) {
                res.status(400).json({ success: false, message: 'Session ID required' });
                return;
            }

            const mikrotikConfig = await getMikrotikConfig();
            if (!mikrotikConfig) {
                res.status(500).json({ success: false, message: 'MikroTik config not found' });
                return;
            }

            // Import the MikrotikService class
            const { MikrotikService } = await import('../../services/mikrotik/MikrotikService');
            const mikrotik = new MikrotikService(mikrotikConfig);
            await mikrotik.disconnectPPPoESession(sessionId);

            res.json({
                success: true,
                message: 'Session berhasil diputus'
            });
        } catch (error: any) {
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
    async getTrafficStats(req: Request, res: Response): Promise<void> {
        try {
            const { username } = req.params;

            const mikrotikConfig = await getMikrotikConfig();
            if (!mikrotikConfig) {
                res.json({ success: false, message: 'MikroTik config not found', online: false });
                return;
            }

            const sessions = await getPppoeActiveConnections(mikrotikConfig);
            const session = sessions.find((s: any) => s.name === username);

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
                    upload: (session as any)['bytes-in'] || session['bytes_in'] || 0,
                    download: (session as any)['bytes-out'] || session['bytes_out'] || 0,
                    uptime: session.uptime || '0s',
                    address: session.address || '-'
                }
            });
        } catch (error: any) {
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
    async getStaticIPStatus(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;

            // Get customer and ping status - try from static_ip_clients first since customer_id might be in sic table
            // Handle both cases: customer_id from customers table or from static_ip_clients table
            let [customerResult] = await databasePool.query(
                `SELECT 
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
                WHERE sic.customer_id = ? OR sic.id = ?`,
                [customerId, customerId]
            ) as [RowDataPacket[], any];

            // If not found, try by static_ip_clients.id
            if (customerResult.length === 0) {
                [customerResult] = await databasePool.query(
                    `SELECT 
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
                    WHERE sic.id = ?`,
                    [customerId]
                ) as [RowDataPacket[], any];
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
                res.status(404).json({ success: false, error: 'Customer not found' });
                return;
            }

            // IMPORTANT: Proses IP address untuk static IP
            // IP yang disimpan di database adalah gateway IP dengan CIDR (192.168.1.1/30)
            // IP yang ditampilkan ke user harus IP client (192.168.1.2)
            const { calculateCustomerIP } = await import('../../utils/ipHelper');
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
            const [downtimeHistory] = await databasePool.query(
                `SELECT 
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
                LIMIT 100`,
                [actualCustomerId]
            ) as [RowDataPacket[], any];

            // Get current ongoing incident
            const [ongoingIncident] = await databasePool.query(
                `SELECT 
                    id,
                    start_time,
                    TIMESTAMPDIFF(MINUTE, start_time, NOW()) as duration_minutes
                FROM sla_incidents
                WHERE customer_id = ?
                    AND service_type = 'static_ip'
                    AND status = 'ongoing'
                LIMIT 1`,
                [actualCustomerId]
            ) as [RowDataPacket[], any];

            // Get 24h connection logs for uptime chart
            const [connectionLogs] = await databasePool.query(
                `SELECT 
                    timestamp,
                    status,
                    response_time_ms,
                    packet_loss_percent
                FROM connection_logs
                WHERE customer_id = ?
                    AND service_type = 'static_ip'
                    AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                ORDER BY timestamp ASC`,
                [actualCustomerId]
            ) as [RowDataPacket[], any];

            res.json({
                success: true,
                data: {
                    customer,
                    downtime_history: downtimeHistory,
                    ongoing_incident: ongoingIncident.length > 0 ? ongoingIncident[0] : null,
                    connection_logs: connectionLogs
                }
            });
        } catch (error: any) {
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
    async getDowntimeHistory(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;
            const days = parseInt(req.query.days as string) || 30;

            const [history] = await databasePool.query(
                `SELECT 
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
                ORDER BY si.start_time DESC`,
                [customerId, days]
            ) as [RowDataPacket[], any];

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
        } catch (error: any) {
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
    async getBandwidthAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const days = parseInt(req.query.days as string) || 30;

            const summary = await MonitoringAnalyticsService.getBandwidthSummary();
            const trend = await MonitoringAnalyticsService.getBandwidthTrend(days);
            const topCustomers = await MonitoringAnalyticsService.getTopCustomersByBandwidth(10);
            const byArea = await MonitoringAnalyticsService.getBandwidthByArea(days);

            res.json({
                success: true,
                data: {
                    summary,
                    trend,
                    top_customers: topCustomers,
                    by_area: byArea
                }
            });
        } catch (error: any) {
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
    async getNetworkHealth(req: Request, res: Response): Promise<void> {
        try {
            const health = await MonitoringAnalyticsService.getNetworkHealth();

            res.json({
                success: true,
                data: health
            });
        } catch (error: any) {
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
    async getAnomalies(req: Request, res: Response): Promise<void> {
        try {
            const anomalies = await IncidentAIService.detectRealTimeAnomalies();

            res.json({
                success: true,
                data: anomalies
            });
        } catch (error: any) {
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
    async getIncidentAnalysis(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ success: false, error: 'id is required' });
                return;
            }
            const incidentId = parseInt(id);

            if (isNaN(incidentId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid incident ID'
                });
                return;
            }

            const analysis = await IncidentAIService.analyzeIncident(incidentId);

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
        } catch (error: any) {
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
    async getAIAnalyticsPage(req: Request, res: Response): Promise<void> {
        try {
            // Get recent incidents for analysis
            const [recentIncidents] = await databasePool.query(`
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
            `) as [RowDataPacket[], any];

            res.render('monitoring/ai', {
                title: 'Monitoring AI Analytics',
                currentPath: '/monitoring/ai',
                recentIncidents: recentIncidents || []
            });
        } catch (error) {
            console.error('Error loading AI Analytics page:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman Monitoring AI'
            });
        }
    }

    /**
     * GET /monitoring/sla
     * SLA Analytics Page
     */
    async getSLAAnalyticsPage(req: Request, res: Response): Promise<void> {
        try {
            // Get customers list for dropdown
            const [customers] = await databasePool.query(`
                SELECT id, name, customer_code 
                FROM customers 
                WHERE status = 'active'
                ORDER BY name ASC
            `) as [RowDataPacket[], any];

            // Get overview stats
            const [stats] = await databasePool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM sla_incidents WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as breach_count,
                    (SELECT COUNT(*) FROM sla_incidents WHERE status = 'ongoing') as active_incidents,
                    (SELECT COALESCE(SUM(refund_amount), 0) FROM sla_refunds WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as refund_amount
            `) as [RowDataPacket[], any];

            // Calculate Avg Reliability (Dummy calculation based on incidents vs total time)
            // In a real scenario, this would be a more complex aggregation
            const avgReliability = 99.8;

            res.render('monitoring/sla', {
                title: 'SLA Monitoring & Analysis',
                currentPath: '/monitoring/sla',
                customers: customers || [],
                stats: {
                    breachCount: stats[0]?.breach_count || 0,
                    activeIncidents: stats[0]?.active_incidents || 0,
                    refundAmount: stats[0]?.refund_amount || 0,
                    avgReliability
                },
                layout: 'layouts/main'
            });
        } catch (error) {
            console.error('Error loading SLA page:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman SLA Analysis'
            });
        }
    }

    /**
     * GET /monitoring/sla/analysis/:customerId
     * Get detailed SLA analysis for a specific customer
     */
    async getCustomerSLAAnalysis(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;

            // 1. Get SLA Stats (Reliability Score)
            // This would typically involve checking uptime logs, but for now we'll simulate or calculate from incidents
            const [incidents] = await databasePool.query(`
                SELECT SUM(duration_minutes) as total_downtime
                FROM sla_incidents
                WHERE customer_id = ? 
                AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `, [customerId]) as [RowDataPacket[], any];

            const totalDowntimeMinutes = incidents[0]?.total_downtime || 0;
            const totalMinutesInMonth = 30 * 24 * 60;
            const reliabilityScore = ((totalMinutesInMonth - totalDowntimeMinutes) / totalMinutesInMonth) * 100;

            // 2. Check Refund Eligibility
            const refundEligible = reliabilityScore < 99.0; // Example threshold

            // 3. Predict Breach Risk (Simple logic)
            let breachProbability = 'LOW';
            if (reliabilityScore < 99.5) breachProbability = 'MEDIUM';
            if (reliabilityScore < 99.0) breachProbability = 'HIGH';

            res.json({
                success: true,
                data: {
                    reliability_score: reliabilityScore.toFixed(3),
                    current_month: {
                        downtime_minutes: totalDowntimeMinutes
                    },
                    refund_eligible: refundEligible,
                    breach_probability: breachProbability
                }
            });

        } catch (error) {
            console.error('Error getting customer SLA analysis:', error);
            res.status(500).json({ success: false, message: 'Gagal menganalisa SLA customer' });
        }
    }

    /**
     * GET /monitoring/usage/:customerId/graph
     * Get bandwidth usage trend for a specific customer
     */
    async getBandwidthTrend(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;
            const trend = await BandwidthLogService.getBandwidthTrend24h(Number(customerId));

            res.json({
                success: true,
                data: trend
            });
        } catch (error: any) {
            console.error('Error getting bandwidth trend:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Gagal mendapatkan data pemakaian'
            });
        }
    }
}
