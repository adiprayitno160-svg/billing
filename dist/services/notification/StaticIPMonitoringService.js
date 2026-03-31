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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticIPMonitoringService = void 0;
const pool_1 = require("../../db/pool");
const child_process_1 = require("child_process");
const util_1 = require("util");
const MikrotikService_1 = require("../mikrotik/MikrotikService");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class StaticIPMonitoringService {
    /**
     * Check reachability of static IP addresses
     * This method pings the IP addresses assigned to static IP customers
     */
    async checkStaticIPConnectivity() {
        try {
            // Get all customers with static IP
            const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          COALESCE(c.static_ip, sic.ip_address, c.ip_address) as ipAddress,
          a.name as area
        FROM customers c
        LEFT JOIN ftth_areas a ON c.area_id = a.id
        LEFT JOIN static_ip_clients sic ON sic.customer_id = c.id
        WHERE c.connection_type = 'static_ip' AND c.status = 'active'
      `;
            const [results] = await pool_1.databasePool.query(query);
            const customers = results;
            const statuses = [];
            // Check connectivity for each static IP
            for (const customer of customers) {
                const status = await this.pingIPAddress(customer.ipAddress);
                statuses.push({
                    ipAddress: customer.ipAddress,
                    customerId: customer.customerId,
                    customerName: customer.customerName,
                    customerPhone: customer.customerPhone,
                    area: customer.area,
                    isReachable: status.isReachable,
                    lastChecked: new Date(),
                    responseTime: status.responseTime
                });
            }
            return statuses;
        }
        catch (error) {
            console.error('Error checking Static IP connectivity:', error);
            throw error;
        }
    }
    /**
     * Ping an IP address to check if it's reachable
     */
    async pingIPAddress(ipAddress) {
        if (!ipAddress) {
            return { isReachable: false };
        }
        let isSuccessful = false;
        let responseTime;
        try {
            // 1. Try DIRECT PING from server first
            const command = process.platform === 'win32'
                ? `ping -n 1 -w 2000 ${ipAddress}` // 2s timeout
                : `ping -c 1 -W 2 ${ipAddress}`; // 2s timeout
            const startTime = Date.now();
            const { stdout, stderr } = await execAsync(command);
            const endTime = Date.now();
            responseTime = endTime - startTime;
            if (!(stderr && stderr.trim() !== '')) {
                isSuccessful =
                    (process.platform === 'win32' && stdout.includes('TTL=')) ||
                        (process.platform !== 'win32' && stdout.includes('bytes from'));
            }
        }
        catch (error) {
            isSuccessful = false;
        }
        // 2. If direct ping fails, TRY PING VIA MIKROTIK
        if (!isSuccessful) {
            try {
                const mkService = await MikrotikService_1.MikrotikService.getInstance();
                const mkPingSuccess = await mkService.ping(ipAddress);
                if (mkPingSuccess) {
                    isSuccessful = true;
                    responseTime = 5; // Artificial low response time via Mikrotik
                    console.log(`[StaticIPMonitor] ✅ IP ${ipAddress} reachable via MikroTik (Direct ping failed)`);
                }
            }
            catch (mkError) {
                // Ignore Mikrotik errors
            }
        }
        return {
            isReachable: isSuccessful,
            responseTime: isSuccessful ? responseTime : undefined
        };
    }
    /**
     * Alternative method to check connectivity using TCP connection
     * This might be more reliable than ping in some networks
     */
    async checkTCPConnectivity(ipAddress, port = 80) {
        if (!ipAddress) {
            return { isReachable: false };
        }
        try {
            const net = await Promise.resolve().then(() => __importStar(require('net')));
            return new Promise((resolve) => {
                const client = new net.Socket();
                const startTime = Date.now();
                client.setTimeout(3000); // 3 second timeout
                client.connect(port, ipAddress, () => {
                    const endTime = Date.now();
                    client.destroy();
                    resolve({
                        isReachable: true,
                        responseTime: endTime - startTime
                    });
                });
                client.on('error', () => {
                    client.destroy();
                    resolve({ isReachable: false });
                });
                client.on('timeout', () => {
                    client.destroy();
                    resolve({ isReachable: false });
                });
            });
        }
        catch (error) {
            console.error(`Error checking TCP connectivity to ${ipAddress}:${port}`, error);
            return { isReachable: false };
        }
    }
    /**
     * Get static IP status for a specific customer
     */
    async getCustomerStaticIPStatus(customerId) {
        try {
            const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          COALESCE(c.static_ip, sic.ip_address, c.ip_address) as ipAddress,
          a.name as area
        FROM customers c
        LEFT JOIN ftth_areas a ON c.area_id = a.id
        LEFT JOIN static_ip_clients sic ON sic.customer_id = c.id
        WHERE c.id = ? AND c.connection_type = 'static_ip'
      `;
            const [results] = await pool_1.databasePool.query(query, [customerId]);
            const customer = results[0];
            if (!customer) {
                return null;
            }
            const status = await this.pingIPAddress(customer.ipAddress);
            return {
                ipAddress: customer.ipAddress,
                customerId: customer.customerId,
                customerName: customer.customerName,
                customerPhone: customer.customerPhone,
                area: customer.area,
                isReachable: status.isReachable,
                lastChecked: new Date(),
                responseTime: status.responseTime
            };
        }
        catch (error) {
            console.error('Error getting customer Static IP status:', error);
            return null;
        }
    }
    /**
     * Bulk update customer connection status in database
     */
    async updateCustomerConnectionStatus(statuses) {
        try {
            const conn = await pool_1.databasePool.getConnection();
            try {
                await conn.beginTransaction();
                for (const status of statuses) {
                    // Update the last connection status in the customer record
                    await conn.execute(`
            UPDATE customers 
            SET 
              is_connected = ?,
              last_connection = ?,
              response_time = ?,
              updated_at = NOW()
            WHERE id = ?
          `, [
                        status.isReachable ? 1 : 0,
                        status.lastChecked,
                        status.responseTime,
                        status.customerId
                    ]);
                }
                await conn.commit();
            }
            catch (error) {
                await conn.rollback();
                throw error;
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error updating customer connection status:', error);
            throw error;
        }
    }
}
exports.StaticIPMonitoringService = StaticIPMonitoringService;
//# sourceMappingURL=StaticIPMonitoringService.js.map