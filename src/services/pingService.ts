/**
 * Ping Service - Real-time IP Monitoring for Static IP Customers
 * Uses ping library to check connectivity and response time
 */

import ping from 'ping';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface PingResult {
    host: string;
    alive: boolean;
    time: number | string;
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
            const result = await ping.promise.probe(ipAddress, {
                timeout: this.PING_TIMEOUT,
                extra: ['-n', '4'], // Windows: 4 packets
            });
            
            return {
                host: result.host,
                alive: result.alive,
                time: result.time === 'unknown' ? 0 : result.time,
                packetLoss: result.packetLoss || '0%'
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
     * Get all Static IP customers for monitoring
     */
    async getStaticIPCustomers(): Promise<StaticIPCustomer[]> {
        const query = `
            SELECT 
                c.id AS customer_id,
                c.name AS customer_name,
                s.ip_address,
                sip.status AS current_status
            FROM customers c
            JOIN subscriptions s ON c.id = s.customer_id
            LEFT JOIN static_ip_ping_status sip ON c.id = sip.customer_id
            WHERE s.status = 'active'
                AND s.service_type = 'static_ip'
                AND s.ip_address IS NOT NULL
                AND s.ip_address != ''
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
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                response_time_ms = VALUES(response_time_ms),
                packet_loss_percent = VALUES(packet_loss_percent),
                consecutive_failures = VALUES(consecutive_failures),
                last_check = NOW(),
                last_online_at = IF(VALUES(status) = 'online', NOW(), last_online_at),
                last_offline_at = IF(VALUES(status) = 'offline', NOW(), last_offline_at)
        `;
        
        await pool.query(query, [
            status.customer_id,
            status.ip_address,
            status.status,
            status.response_time_ms,
            status.packet_loss_percent,
            status.consecutive_failures,
            status.status === 'online' ? new Date() : null,
            status.status === 'offline' ? new Date() : null
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
     */
    async monitorSingleCustomer(customer: StaticIPCustomer): Promise<void> {
        try {
            // Ping the IP
            const pingResult = await this.pingHost(customer.ip_address);
            
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
            
            // Update ping status
            await this.updatePingStatus({
                customer_id: customer.customer_id,
                ip_address: customer.ip_address,
                status,
                response_time_ms: pingResult.alive ? responseTime : null,
                packet_loss_percent: packetLoss,
                consecutive_failures: consecutiveFailures
            });
            
            // Log to connection_logs
            await this.logConnectionStatus(
                customer.customer_id,
                customer.ip_address,
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
