"use strict";
/**
 * Ping Service - Real-time IP Monitoring for Static IP Customers
 * Uses ping library to check connectivity and response time
 */
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
exports.PingService = void 0;
const ping_1 = __importDefault(require("ping"));
const pool_1 = __importDefault(require("../db/pool"));
const ipHelper_1 = require("../utils/ipHelper");
class PingService {
    constructor() {
        this.PING_TIMEOUT = 5; // seconds
        this.MAX_CONSECUTIVE_FAILURES = 3;
        this.DEGRADED_THRESHOLD_MS = 200; // Response time threshold for degraded status
        this.isRunning = false;
    }
    /**
     * Ping a single IP address
     */
    async pingHost(ipAddress) {
        try {
            // Determine OS-specific arguments
            // Windows uses -n for count, Linux/Unix uses -c
            const isWindows = process.platform === 'win32';
            const extraArgs = isWindows ? ['-n', '4'] : ['-c', '4'];
            let result = await ping_1.default.promise.probe(ipAddress, {
                timeout: this.PING_TIMEOUT,
                extra: extraArgs,
            });
            let isAlive = result.alive;
            // FALLBACK TO MIKROTIK
            if (!isAlive) {
                try {
                    const { MikrotikService } = await Promise.resolve().then(() => __importStar(require('./mikrotik/MikrotikService')));
                    const mkService = await MikrotikService.getInstance();
                    const mkPingSuccess = await mkService.ping(ipAddress);
                    if (mkPingSuccess) {
                        isAlive = true;
                        result.time = 5;
                        result.packetLoss = '0';
                    }
                }
                catch (mkErr) {
                    // Ignore mikrotik error
                }
            }
            return {
                host: result.host,
                alive: isAlive,
                time: typeof result.time === 'number' ? result.time : (result.time === 'unknown' ? 0 : parseFloat(String(result.time)) || 0),
                packetLoss: String(result.packetLoss || '0%')
            };
        }
        catch (error) {
            console.error(`Ping error for ${ipAddress}:`, error);
            // FALLBACK TO MIKROTIK (Catch error case)
            try {
                const { MikrotikService } = await Promise.resolve().then(() => __importStar(require('./mikrotik/MikrotikService')));
                const mkService = await MikrotikService.getInstance();
                const mkPingSuccess = await mkService.ping(ipAddress);
                if (mkPingSuccess) {
                    return { host: ipAddress, alive: true, time: 5, packetLoss: '0%' };
                }
            }
            catch (mkErr) {
                // Ignore mikrotik error
            }
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
    calculatePeerIP(cidrAddress) {
        // Use utility function for consistency across the system
        return (0, ipHelper_1.calculateCustomerIP)(cidrAddress);
    }
    /**
     * Get all Static IP customers for monitoring
     * FIXED: Get from static_ip_clients table ONLY (using INNER JOIN with customers)
     * This ensures only customers who are registered in static_ip_clients table will appear
     */
    async getStaticIPCustomers() {
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
        const [rows] = await pool_1.default.query(query);
        return rows;
    }
    /**
     * Update ping status in database
     */
    async updatePingStatus(status) {
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
        await pool_1.default.query(query, [
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
    async logConnectionStatus(customerId, ipAddress, isOnline, responseTimeMs, packetLoss) {
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
        await pool_1.default.query(query, [
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
    async calculate24hUptime(customerId) {
        const query = `
            SELECT 
                COUNT(*) AS total_checks,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online_checks
            FROM connection_logs
            WHERE customer_id = ?
                AND service_type = 'static_ip'
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;
        const [rows] = await pool_1.default.query(query, [customerId]);
        const result = rows[0];
        if (result.total_checks === 0)
            return 100;
        return (result.online_checks / result.total_checks) * 100;
    }
    /**
     * Update 24h uptime in status table
     */
    async update24hUptime(customerId) {
        const uptime = await this.calculate24hUptime(customerId);
        await pool_1.default.query('UPDATE static_ip_ping_status SET uptime_percent_24h = ? WHERE customer_id = ?', [uptime, customerId]);
    }
    /**
     * Monitor all Static IP customers (Main function called by scheduler)
     */
    async monitorAllStaticIPs() {
        if (this.isRunning) {
            console.log('[PingService] Monitoring already in progress, skipping...');
            return;
        }
        this.isRunning = true;
        console.log('[PingService] Starting Static IP monitoring...');
        try {
            const customers = await this.getStaticIPCustomers();
            console.log(`[PingService] Monitoring ${customers.length} Static IP customers`);
            for (const customer of customers) {
                await this.monitorSingleCustomer(customer);
            }
            console.log('[PingService] Static IP monitoring completed');
        }
        catch (error) {
            console.error('[PingService] Error in monitorAllStaticIPs:', error);
            throw error;
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Monitor single customer
     * IMPORTANT: Ping router IP (192.168.1.2), NOT MikroTik gateway IP (192.168.1.1)
     * The router IP is calculated from the CIDR address stored in database
     */
    async monitorSingleCustomer(customer) {
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
            const [statusRows] = await pool_1.default.query('SELECT consecutive_failures FROM static_ip_ping_status WHERE customer_id = ?', [customer.customer_id]);
            const currentConsecutiveFailures = statusRows.length > 0 ? statusRows[0].consecutive_failures : 0;
            // Determine status
            let status;
            let consecutiveFailures = 0;
            if (pingResult.alive) {
                if (responseTime > this.DEGRADED_THRESHOLD_MS) {
                    status = 'degraded';
                }
                else {
                    status = 'online';
                }
                consecutiveFailures = 0;
            }
            else {
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
            await this.logConnectionStatus(customer.customer_id, peerIP, // Log peer IP (the one we're actually pinging)
            pingResult.alive, pingResult.alive ? responseTime : null, packetLoss);
            // Update 24h uptime (every 10th check to reduce overhead)
            if (Math.random() < 0.1) {
                await this.update24hUptime(customer.customer_id);
            }
        }
        catch (error) {
            console.error(`[PingService] Error monitoring customer ${customer.customer_id}:`, error);
        }
    }
    /**
     * Get current status for a customer
     */
    async getCustomerStatus(customerId) {
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
        const [rows] = await pool_1.default.query(query, [customerId]);
        if (rows.length === 0)
            return null;
        return rows[0];
    }
}
exports.PingService = PingService;
exports.default = new PingService();
//# sourceMappingURL=pingService.js.map