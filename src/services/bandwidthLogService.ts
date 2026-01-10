/**
 * Bandwidth Log Service - Collect and store PPPoE bandwidth usage
 * Collects data from MikroTik every 5 minutes via API
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { RouterOSAPI } from 'node-routeros';

interface PPPoECustomer {
    customer_id: number;
    customer_name: string;
    username: string;
    mikrotik_id: number;
    mikrotik_host: string;
    mikrotik_port: number;
    mikrotik_username: string;
    mikrotik_password: string;
}

interface PPPoEActiveSession {
    name: string;
    'caller-id': string;
    address: string;
    uptime: string;
    'bytes-in': string;
    'bytes-out': string;
    'packets-in': string;
    'packets-out': string;
}

interface BandwidthData {
    customer_id: number;
    username: string;
    bytes_in: number;
    bytes_out: number;
    packets_in: number;
    packets_out: number;
    session_uptime: number;
    caller_id: string;
    address: string;
}

export class BandwidthLogService {

    /**
     * Get all active PPPoE customers with their MikroTik config
     */
    async getPPPoECustomers(): Promise<PPPoECustomer[]> {
        const query = `
            SELECT DISTINCT
                c.id AS customer_id,
                c.name AS customer_name,
                c.pppoe_username AS username,
                m.id AS mikrotik_id,
                m.host AS mikrotik_host,
                m.port AS mikrotik_port,
                m.username AS mikrotik_username,
                m.password AS mikrotik_password
            FROM customers c
            CROSS JOIN (SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1) m
            WHERE c.status = 'active'
                AND c.connection_type = 'pppoe'
                AND c.pppoe_username IS NOT NULL
                AND c.pppoe_username != ''
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query);
        return rows as PPPoECustomer[];
    }

    /**
     * Get active PPPoE sessions from MikroTik
     */
    async getActiveSessions(mikrotik: {
        host: string;
        port: number;
        username: string;
        password: string;
    }): Promise<PPPoEActiveSession[]> {
        const conn = new RouterOSAPI({
            host: mikrotik.host,
            user: mikrotik.username,
            password: mikrotik.password,
            port: mikrotik.port,
            timeout: 10
        });

        try {
            await conn.connect();

            const sessions = await conn.write('/ppp/active/print', [
                '=.proplist=name,caller-id,address,uptime,bytes-in,bytes-out,packets-in,packets-out'
            ]);

            await conn.close();

            return sessions as PPPoEActiveSession[];
        } catch (error) {
            console.error(`[BandwidthLogService] Error connecting to MikroTik ${mikrotik.host}:`, error);
            throw error;
        }
    }

    /**
     * Parse uptime string to seconds
     */
    parseUptime(uptime: string): number {
        // Format examples: "1w2d3h4m5s" or "2d3h4m" or "5h30m"
        let seconds = 0;

        const weeks = uptime.match(/(\d+)w/);
        const days = uptime.match(/(\d+)d/);
        const hours = uptime.match(/(\d+)h/);
        const minutes = uptime.match(/(\d+)m/);
        const secs = uptime.match(/(\d+)s/);

        if (weeks) seconds += parseInt(weeks[1]) * 7 * 24 * 3600;
        if (days) seconds += parseInt(days[1]) * 24 * 3600;
        if (hours) seconds += parseInt(hours[1]) * 3600;
        if (minutes) seconds += parseInt(minutes[1]) * 60;
        if (secs) seconds += parseInt(secs[1]);

        return seconds;
    }

    /**
     * Save bandwidth data to database
     */
    async saveBandwidthLog(data: BandwidthData): Promise<void> {
        const query = `
            INSERT INTO bandwidth_logs (
                customer_id,
                timestamp,
                bytes_in,
                bytes_out
            ) VALUES (?, NOW(), ?, ?)
        `;

        await pool.query(query, [
            data.customer_id,
            data.bytes_in,
            data.bytes_out
        ]);
    }

    /**
     * Log PPPoE connection status
     */
    async logConnectionStatus(
        customerId: number,
        username: string,
        isOnline: boolean
    ): Promise<void> {
        const query = `
            INSERT INTO connection_logs (
                customer_id,
                service_type,
                username,
                timestamp,
                status
            ) VALUES (?, 'pppoe', ?, NOW(), ?)
        `;

        await pool.query(query, [
            customerId,
            username,
            isOnline ? 'online' : 'offline'
        ]);
    }

    /**
     * Collect bandwidth from single MikroTik
     */
    async collectFromMikroTik(
        mikrotikConfig: {
            host: string;
            port: number;
            username: string;
            password: string;
        },
        customers: PPPoECustomer[]
    ): Promise<void> {
        try {
            // Get active sessions from this MikroTik
            const sessions = await this.getActiveSessions(mikrotikConfig);

            console.log(`[BandwidthLogService] Found ${sessions.length} active sessions on ${mikrotikConfig.host}`);

            // Create a map of username -> session
            const sessionMap = new Map<string, PPPoEActiveSession>();
            sessions.forEach(session => {
                sessionMap.set(session.name, session);
            });

            // Process each customer
            for (const customer of customers) {
                const session = sessionMap.get(customer.username);

                if (session) {
                    // Customer is online - save bandwidth data
                    const bandwidthData: BandwidthData = {
                        customer_id: customer.customer_id,
                        username: customer.username,
                        bytes_in: parseInt(session['bytes-in']) || 0,
                        bytes_out: parseInt(session['bytes-out']) || 0,
                        packets_in: parseInt(session['packets-in']) || 0,
                        packets_out: parseInt(session['packets-out']) || 0,
                        session_uptime: this.parseUptime(session.uptime),
                        caller_id: session['caller-id'] || '',
                        address: session.address || ''
                    };

                    await this.saveBandwidthLog(bandwidthData);
                    await this.logConnectionStatus(customer.customer_id, customer.username, true);

                } else {
                    // Customer is offline
                    await this.logConnectionStatus(customer.customer_id, customer.username, false);
                }
            }

        } catch (error) {
            console.error(`[BandwidthLogService] Error collecting from MikroTik ${mikrotikConfig.host}:`, error);
            throw error;
        }
    }

    /**
     * Main function: Collect bandwidth from all MikroTik devices
     * Called by scheduler every 5 minutes
     */
    async collectAllBandwidth(): Promise<void> {
        console.log('[BandwidthLogService] Starting bandwidth collection...');

        try {
            // Get all PPPoE customers grouped by MikroTik
            const customers = await this.getPPPoECustomers();
            console.log(`[BandwidthLogService] Found ${customers.length} active PPPoE customers`);

            // Group by MikroTik
            const mikrotikGroups = new Map<number, PPPoECustomer[]>();

            customers.forEach(customer => {
                if (!mikrotikGroups.has(customer.mikrotik_id)) {
                    mikrotikGroups.set(customer.mikrotik_id, []);
                }
                mikrotikGroups.get(customer.mikrotik_id)!.push(customer);
            });

            console.log(`[BandwidthLogService] Processing ${mikrotikGroups.size} MikroTik devices`);

            // Process each MikroTik
            for (const [mikrotikId, customerGroup] of mikrotikGroups.entries()) {
                const firstCustomer = customerGroup[0];

                const mikrotikConfig = {
                    host: firstCustomer.mikrotik_host,
                    port: firstCustomer.mikrotik_port,
                    username: firstCustomer.mikrotik_username,
                    password: firstCustomer.mikrotik_password
                };

                console.log(`[BandwidthLogService] Processing MikroTik #${mikrotikId} (${mikrotikConfig.host}) with ${customerGroup.length} customers`);

                try {
                    await this.collectFromMikroTik(mikrotikConfig, customerGroup);
                } catch (error) {
                    console.error(`[BandwidthLogService] Failed to collect from MikroTik #${mikrotikId}:`, error);
                    // Continue with next MikroTik
                }
            }

            console.log('[BandwidthLogService] Bandwidth collection completed');

        } catch (error) {
            console.error('[BandwidthLogService] Error in collectAllBandwidth:', error);
            throw error;
        }
    }

    /**
     * Get bandwidth statistics for a customer (last 24 hours)
     */
    async getCustomerBandwidth24h(customerId: number): Promise<{
        total_download_gb: number;
        total_upload_gb: number;
        avg_download_mbps: number;
        avg_upload_mbps: number;
        peak_download_mbps: number;
        peak_upload_mbps: number;
        data_points: number;
    } | null> {
        const query = `
            SELECT 
                COUNT(*) AS data_points,
                ROUND(SUM(bytes_in) / 1024 / 1024 / 1024, 2) AS total_download_gb,
                ROUND(SUM(bytes_out) / 1024 / 1024 / 1024, 2) AS total_upload_gb,
                ROUND(AVG(bytes_in / 300) * 8 / 1024 / 1024, 2) AS avg_download_mbps,
                ROUND(AVG(bytes_out / 300) * 8 / 1024 / 1024, 2) AS avg_upload_mbps,
                ROUND(MAX(bytes_in / 300) * 8 / 1024 / 1024, 2) AS peak_download_mbps,
                ROUND(MAX(bytes_out / 300) * 8 / 1024 / 1024, 2) AS peak_upload_mbps
            FROM bandwidth_logs
            WHERE customer_id = ?
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, [customerId]);

        if (rows.length === 0 || rows[0].data_points === 0) return null;

        return rows[0] as any;
    }

    /**
     * Get bandwidth trend (hourly for last 24 hours)
     */
    async getBandwidthTrend24h(customerId: number): Promise<any[]> {
        const query = `
            SELECT 
                DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') AS hour,
                ROUND(AVG(bytes_in / 300) * 8 / 1024 / 1024, 2) AS avg_download_mbps,
                ROUND(AVG(bytes_out / 300) * 8 / 1024 / 1024, 2) AS avg_upload_mbps,
                ROUND(MAX(bytes_in / 300) * 8 / 1024 / 1024, 2) AS peak_download_mbps,
                ROUND(MAX(bytes_out / 300) * 8 / 1024 / 1024, 2) AS peak_upload_mbps
            FROM bandwidth_logs
            WHERE customer_id = ?
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')
            ORDER BY hour ASC
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, [customerId]);
        return rows;
    }

    /**
     * Get bandwidth trend for last 12 hours (grouped by 30 minutes)
     */
    async getBandwidthTrend12h(customerId: number): Promise<any[]> {
        const query = `
            SELECT 
                DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00') AS time_slot,
                DATE_FORMAT(timestamp, '%H:%i') AS time_label,
                ROUND(AVG(bytes_in / 300) * 8 / 1024 / 1024, 2) AS avg_download_mbps,
                ROUND(AVG(bytes_out / 300) * 8 / 1024 / 1024, 2) AS avg_upload_mbps,
                SUM(bytes_in) AS total_bytes_in,
                SUM(bytes_out) AS total_bytes_out
            FROM bandwidth_logs
            WHERE customer_id = ?
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
            GROUP BY 
                DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00'),
                FLOOR(MINUTE(timestamp) / 30)
            ORDER BY time_slot ASC
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, [customerId]);
        return rows;
    }
}

export default new BandwidthLogService();
