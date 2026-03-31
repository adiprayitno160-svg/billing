"use strict";
/**
 * Mikrotik Health Check Service
 * Auto-detect connection issues and provide fallback
 * REFACTORED TO USE CONNECTION POOL
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikHealthCheck = void 0;
const pool_1 = __importDefault(require("../../db/pool"));
const MikroTikConnectionPool_1 = require("../MikroTikConnectionPool");
class MikrotikHealthCheck {
    /**
     * Quick health check with timeout
     */
    static async checkHealth() {
        const now = Date.now();
        // Return cached status if recent check
        if (this.healthStatus && (now - this.lastCheckTime) < this.CHECK_INTERVAL) {
            return this.healthStatus;
        }
        const startTime = Date.now();
        try {
            // Get Mikrotik settings
            const [rows] = await pool_1.default.query('SELECT host, port, api_port, username, password FROM mikrotik_settings WHERE is_active = 1 LIMIT 1');
            if (rows.length === 0) {
                this.healthStatus = {
                    isOnline: false,
                    responseTime: 0,
                    lastCheck: new Date(),
                    error: 'Mikrotik not configured'
                };
                this.lastCheckTime = now;
                return this.healthStatus;
            }
            const settings = rows[0];
            const config = {
                host: settings.host,
                port: settings.port || settings.api_port || 8728,
                username: settings.username,
                password: settings.password
            };
            // Use pool to check identity
            await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/system/identity/print', [], 'health_check', 5000);
            const responseTime = Date.now() - startTime;
            this.healthStatus = {
                isOnline: true,
                responseTime,
                lastCheck: new Date(),
            };
            console.log(`[MikrotikHealth] ✅ Online (${responseTime}ms - via Pool)`);
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            this.healthStatus = {
                isOnline: false,
                responseTime,
                lastCheck: new Date(),
                error: error instanceof Error ? error.message : 'Connection failed'
            };
            console.log(`[MikrotikHealth] ❌ Offline: ${this.healthStatus.error}`);
        }
        this.lastCheckTime = now;
        return this.healthStatus;
    }
    /**
     * Get current status (cached)
     */
    static getCurrentStatus() {
        return this.healthStatus;
    }
    /**
     * Force recheck
     */
    static async forceRecheck() {
        this.lastCheckTime = 0;
        return this.checkHealth();
    }
}
exports.MikrotikHealthCheck = MikrotikHealthCheck;
MikrotikHealthCheck.healthStatus = null;
MikrotikHealthCheck.lastCheckTime = 0;
MikrotikHealthCheck.CHECK_INTERVAL = 30000; // Check every 30 seconds
exports.default = MikrotikHealthCheck;
//# sourceMappingURL=MikrotikHealthCheck.js.map