/**
 * Ping Service - Real-time IP Monitoring for Static IP Customers
 * Uses ping library to check connectivity and response time
 */

import ping from 'ping';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { calculateCustomerIP } from '../utils/ipHelper';

interface PingResult {
    host: string;
    alive: boolean;
    time: number;
    packetLoss: string;
}

interface StaticIPCustomer {
    customer_id: number;
    customer_name: string;
    ip_address: string;
    current_status?: string;
}

interface PingStatus {
    customer_id: number;
    ip_address: string;
    status: 'online' | 'offline' | 'degraded';
    response_time_ms: number | null;
    packet_loss_percent: number;
    consecutive_failures: number;
}

export class PingService {
    private readonly PING_TIMEOUT = 5; // seconds
    private readonly MAX_CONSECUTIVE_FAILURES = 3;
    private readonly DEGRADED_THRESHOLD_MS = 200; // Response time threshold for degraded status

    /**
     * Ping a single IP address
     */
    async pingHost(ipAddress: string): Promise<PingResult> {
        try {
            // Determine OS-specific arguments
            // Windows uses -n for count, Linux/Unix uses -c
            const isWindows = process.platform === 'win32';
            const extraArgs = isWindows ? ['-n', '4'] : ['-c', '4'];

            const result = await ping.promise.probe(ipAddress, {
                timeout: this.PING_TIMEOUT,
                extra: extraArgs,
            });

            return {
                host: result.host,
                alive: result.alive,
                time: typeof result.time === 'number' ? result.time : (result.time === 'unknown' ? 0 : parseFloat(String(result.time)) || 0),
                packetLoss: String(result.packetLoss || '0%')
            };
        } catch (error) {
            console.error(`Ping error for ${ipAddress}:`, error);
            return {
                host: ipAddress,
                alive: false,
                time: 0,
                packetLoss: '100%'
            };
        }
    }

    /**
     * Calculate peer IP (router client IP) from CIDR
     * IMPORTANT: Ping router IP (192.168.1.2), NOT MikroTik gateway IP (192.168.1.1)
     * Uses utility function calculateCustomerIP for consistency
     * @deprecated Use calculateCustomerIP from utils/ipHelper directly
     */
    private calculatePeerIP(cidrAddress: string): string {
        // Use utility function for consistency across the system
        return calculateCustomerIP(cidrAddress);
    }

    /**
     * Get all Static IP customers for monitoring
     * FIXED: Get from static_ip_clients table ONLY (using INNER JOIN with customers)
     * This ensures only customers who are registered in static_ip_clients table will appear
     */
    async getStaticIPCustomers(): Promise<StaticIPCustomer[]> {
        const query = `
            SELECT 
                sic.customer_id,
                sic.client_name AS customer_name,
                sic.ip_address,
                sip.status AS current_status
            FROM static_ip_clients sic
            INNER JOIN customers c ON sic.customer_id = c.id
            LEFT JOIN static_ip_ping_status sip ON sic.customer_id = sip.customer_id
            WHERE sic.status = 'active'
                AND sic.ip_address IS NOT NULL
                AND sic.ip_address != ''
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query);
        return rows as StaticIPCustomer[];
    }

    /**
     * Update ping status in database
     */
    async updatePingStatus(status: PingStatus): Promise<void> {
        const query = `
            INSERT INTO static_ip_ping_status (
                customer_id,
                ip_address,
                status,
                response_time_ms,
                packet_loss_percent,
                consecutive_failures,
                last_check,
                last_online_at,
                last_offline_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                response_time_ms = VALUES(response_time_ms),
                packet_loss_percent = VALUES(packet_loss_percent),
                consecutive_failures = VALUES(consecutive_failures),
                last_check = VALUES(last_check),
                last_online_at = IF(VALUES(status) = 'online', VALUES(last_check), last_online_at),
                last_offline_at = IF(VALUES(status) = 'offline', VALUES(last_check), last_offline_at)
        `;

        const now = new Date();
        const lastOnline = status.status === 'online' ? now : null;
        const lastOffline = status.status === 'offline' ? now : null;

        await pool.query(query, [
            status.customer_id,
            status.ip_address,
            status.status,
            status.response_time_ms,
            status.packet_loss_percent,
            status.consecutive_failures,
            now,
            lastOnline,
            lastOffline
        ]);
    }

    /**
     * Log ping result to connection_logs
     */
    async logConnectionStatus(
        customerId: number,
        ipAddress: string,
        isOnline: boolean,
        responseTimeMs: number | null,
        packetLoss: number
    ): Promise<void> {
        const query = `
            INSERT INTO connection_logs (
                customer_id,
                service_type,
                ip_address,
                timestamp,
                status,
                response_time_ms,
                packet_loss_percent
            ) VALUES (?, 'static_ip', ?, NOW(), ?, ?, ?)
        `;

        await pool.query(query, [
            customerId,
            ipAddress,
            isOnline ? 'online' : 'offline',
            responseTimeMs,
            packetLoss
        ]);
    }

    /**
     * Calculate 24h uptime percentage
     */
    async calculate24hUptime(customerId: number): Promise<number> {
        const query = `
            SELECT 
                COUNT(*) AS total_checks,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online_checks
            FROM connection_logs
            WHERE customer_id = ?
                AND service_type = 'static_ip'
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, [customerId]);
        const result = rows[0];

        if (result.total_checks === 0) return 100;

        return (result.online_checks / result.total_checks) * 100;
    }

    /**
     * Update 24h uptime in status table
     */
    async update24hUptime(customerId: number): Promise<void> {
        const uptime = await this.calculate24hUptime(customerId);

        await pool.query(
            'UPDATE static_ip_ping_status SET uptime_percent_24h = ? WHERE customer_id = ?',
            [uptime, customerId]
        );
    }

    /**
     * Monitor all Static IP customers (Main function called by scheduler)
     */
    async monitorAllStaticIPs(): Promise<void> {
        console.log('[PingService] Starting Static IP monitoring...');

        try {
            const customers = await this.getStaticIPCustomers();
            console.log(`[PingService] Monitoring ${customers.length} Static IP customers`);

            for (const customer of customers) {
                await this.monitorSingleCustomer(customer);
            }

            console.log('[PingService] Static IP monitoring completed');
        } catch (error) {
            console.error('[PingService] Error in monitorAllStaticIPs:', error);
            throw error;
        }
    }

    /**
     * Monitor single customer
     * IMPORTANT: Ping router IP (192.168.1.2), NOT MikroTik gateway IP (192.168.1.1)
     * The router IP is calculated from the CIDR address stored in database
     */
    async monitorSingleCustomer(customer: StaticIPCustomer): Promise<void> {
        try {
            // Calculate router IP (peer/client IP) from CIDR
            // If stored IP is MikroTik gateway (192.168.1.1), this returns router IP (192.168.1.2)
            let peerIP = this.calculatePeerIP(customer.ip_address);

            // EXTRA SAFETY: Ensure no CIDR remains
            if (peerIP.includes('/')) {
                peerIP = peerIP.split('/')[0];
            }

            console.log(`[PingService] Monitoring customer ${customer.customer_id} (${customer.customer_name}): Stored IP=${customer.ip_address} -> Ping Target=${peerIP}`);

            // Ping the router IP (client router), NOT the MikroTik gateway IP
            const pingResult = await this.pingHost(peerIP);

            // Parse packet loss
            const packetLoss = parseFloat(pingResult.packetLoss.replace('%', '')) || 0;
            const responseTime = typeof pingResult.time === 'number' ? pingResult.time : 0;

            // Get current status from database
            const [statusRows] = await pool.query<RowDataPacket[]>(
                'SELECT consecutive_failures FROM static_ip_ping_status WHERE customer_id = ?',
                [customer.customer_id]
            );

            const currentConsecutiveFailures = statusRows.length > 0 ? statusRows[0].consecutive_failures : 0;

            // Determine status
            let status: 'online' | 'offline' | 'degraded';
            let consecutiveFailures = 0;

            if (pingResult.alive) {
                if (responseTime > this.DEGRADED_THRESHOLD_MS) {
                    status = 'degraded';
                } else {
                    status = 'online';
                }
                consecutiveFailures = 0;
            } else {
                consecutiveFailures = currentConsecutiveFailures + 1;
                status = 'offline';
            }

            // Update ping status - store peer IP in ip_address field for reference
            await this.updatePingStatus({
                customer_id: customer.customer_id,
                ip_address: peerIP, // Store peer IP (router client IP) for reference
                status,
                response_time_ms: pingResult.alive ? responseTime : null,
                packet_loss_percent: packetLoss,
                consecutive_failures: consecutiveFailures
            });

            // Log to connection_logs - log both MikroTik IP and peer IP for clarity
            await this.logConnectionStatus(
                customer.customer_id,
                peerIP, // Log peer IP (the one we're actually pinging)
                pingResult.alive,
                pingResult.alive ? responseTime : null,
                packetLoss
            );

            // Update 24h uptime (every 10th check to reduce overhead)
            if (Math.random() < 0.1) {
                await this.update24hUptime(customer.customer_id);
            }

        } catch (error) {
            console.error(`[PingService] Error monitoring customer ${customer.customer_id}:`, error);
        }
    }

    /**
     * Get current status for a customer
     */
    async getCustomerStatus(customerId: number): Promise<PingStatus | null> {
        const query = `
            SELECT 
                customer_id,
                ip_address,
                status,
                response_time_ms,
                packet_loss_percent,
                consecutive_failures,
                last_check,
                last_online_at,
                last_offline_at,
                uptime_percent_24h
            FROM static_ip_ping_status
            WHERE customer_id = ?
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, [customerId]);

        if (rows.length === 0) return null;

        return rows[0] as PingStatus;
    }
}

export default new PingService();
