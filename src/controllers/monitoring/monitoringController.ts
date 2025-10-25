import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getMikrotikConfig } from '../../services/pppoeService';
import { getPppoeActiveConnections, getPppoeSecrets } from '../../services/mikrotikService';

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
                
                try {
                    const mikrotikConfig = await getMikrotikConfig();
                    if (mikrotikConfig) {
                        const activeSessions = await getPppoeActiveConnections(mikrotikConfig);
                        onlinePPPoE = activeSessions.length;
                    }
                } catch (error) {
                    console.error('Error fetching MikroTik data:', error);
                }

                res.render('monitoring/dashboard', {
                    title: 'Monitor Pelanggan',
                    pppoeStats: pppoeStats[0],
                    staticIpStats: staticIpStats[0],
                    onlinePPPoE
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

            // Get ODC list for filter
            console.log('Fetching ODC list...');
            const [odcList] = await databasePool.query('SELECT id, name FROM ftth_odc ORDER BY name') as [RowDataPacket[], any];
            console.log(`Found ${odcList.length} ODC entries`);

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

            const [clients] = await databasePool.query(
                clientsQuery,
                [...queryParams, limit, offset]
            ) as [RowDataPacket[], any];

            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM static_ip_clients sic LEFT JOIN customers c ON sic.customer_id = c.id ${whereClause}`;
            const [countResult] = await databasePool.query(countQuery, queryParams) as [RowDataPacket[], any];
            const totalCount = countResult[0]?.total || 0;

            // Merge with ping status and calculate downtime
            const clientsWithStatus = await Promise.all(clients.map(async client => {
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
                    current_downtime: currentDowntime
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

            // Get customer data with package info through subscriptions
            const [customers] = await databasePool.query(
                `SELECT c.*, 
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
                    upload: session['bytes-in'] || 0,
                    download: session['bytes-out'] || 0,
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

            // Get customer and ping status
            const [customerResult] = await databasePool.query(
                `SELECT 
                    c.id, c.name, c.customer_code, c.is_isolated,
                    sic.ip_address, sic.client_name,
                    sips.status as ping_status,
                    sips.response_time_ms,
                    sips.packet_loss_percent,
                    sips.consecutive_failures,
                    sips.last_check,
                    sips.last_online_at,
                    sips.last_offline_at,
                    sips.uptime_percent_24h
                FROM customers c
                LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                WHERE c.id = ?`,
                [customerId]
            ) as [RowDataPacket[], any];

            if (customerResult.length === 0) {
                res.status(404).json({ success: false, message: 'Customer not found' });
                return;
            }

            const customer = customerResult[0];

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
                [customerId]
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
                [customerId]
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
                [customerId]
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
}
