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
exports.RealtimeMonitoringService = void 0;
const pppoeService_1 = require("../pppoeService");
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class RealtimeMonitoringService {
    constructor(io) {
        this.isRunning = false;
        this.interval = null;
        this.POLLING_INTERVAL = 3000; // 3 seconds to be safe
        this.lastOnlineUsernames = new Set();
        this.io = io;
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('Starting Realtime Monitoring Service...');
        this.io.on('connection', (socket) => {
            console.log('Client connected to monitoring stream:', socket.id);
            socket.on('disconnect', () => {
                // console.log('Client disconnected:', socket.id);
            });
        });
        this.startPolling();
    }
    stop() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    async startPolling() {
        this.interval = setInterval(async () => {
            try {
                const data = await this.gatherMetrics();
                this.io.emit('monitoring:update', data);
            }
            catch (error) {
                console.error('Error gathering monitoring metrics:', error);
            }
        }, this.POLLING_INTERVAL);
    }
    async gatherMetrics() {
        const serverStats = await this.getServerStats();
        const networkStats = await this.getNetworkStats();
        return {
            timestamp: new Date().toISOString(),
            server: serverStats,
            network: networkStats,
            alerts: networkStats?.alerts || []
        };
    }
    async getServerStats() {
        const cpuUsage = Math.round(os_1.default.loadavg()[0] * 10) % 100; // Rough estimate
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
        let temperature = 'N/A';
        // Simple temp check (Linux only usually)
        try {
            if (os_1.default.platform() === 'linux') {
                const { stdout } = await execAsync('cat /sys/class/thermal/thermal_zone0/temp');
                const temp = parseInt(stdout.trim());
                if (!isNaN(temp)) {
                    temperature = (temp / 1000).toFixed(1) + '°C';
                }
            }
        }
        catch (e) { }
        return {
            cpu: cpuUsage,
            memory: memUsage,
            uptime: os_1.default.uptime(),
            temperature
        };
    }
    async getNetworkStats() {
        try {
            const config = await (0, pppoeService_1.getMikrotikConfig)();
            if (!config)
                return null;
            // Use the pool to execute commands
            const { mikrotikPool } = await Promise.resolve().then(() => __importStar(require('../../services/MikroTikConnectionPool')));
            const poolConfig = {
                host: config.host,
                port: config.port || config.api_port || 8728,
                username: config.username,
                password: config.password
            };
            // 1. Get Active PPPoE Count
            const activeSessions = await mikrotikPool.execute(poolConfig, '/ppp/active/print', ['count-only']);
            // 2. Get Interface Stats
            const interfaces = await mikrotikPool.execute(poolConfig, '/interface/print', ['?running=true']);
            let totalRx = 0;
            let totalTx = 0;
            let wanInterface = null;
            if (Array.isArray(interfaces)) {
                interfaces.forEach((iface) => {
                    totalRx += parseInt(iface['rx-byte'] || '0');
                    totalTx += parseInt(iface['tx-byte'] || '0');
                    // Try to identify WAN interface (usually ether1 or has comment "WAN")
                    if (iface.name === 'ether1' || (iface.comment && iface.comment.includes('WAN'))) {
                        wanInterface = iface;
                    }
                });
            }
            return {
                online_pppoe: parseInt(activeSessions) || 0,
                interfaces: Array.isArray(interfaces) ? interfaces.map((i) => ({
                    name: i.name,
                    rx_byte: i['rx-byte'],
                    tx_byte: i['tx-byte'],
                    type: i.type,
                    running: i.running
                })) : [],
                wan_stats: wanInterface ? {
                    name: wanInterface.name,
                    rx_byte: wanInterface['rx-byte'],
                    tx_byte: wanInterface['tx-byte']
                } : null,
                total_rx: totalRx,
                total_tx: totalTx,
                alerts: this.processCustomerAlerts(Array.isArray(activeSessions) ? activeSessions : [])
            };
        }
        catch (error) {
            console.error('Error in getNetworkStats:', error);
            return null;
        }
    }
    processCustomerAlerts(activeSessions) {
        const currentOnline = new Set(activeSessions.map((s) => s.name || s));
        const alerts = [];
        // Identify newly offline
        for (const username of this.lastOnlineUsernames) {
            if (!currentOnline.has(username)) {
                alerts.push({
                    type: 'offline',
                    username,
                    timestamp: new Date().toISOString(),
                    message: `Pelanggan ${username} terdeteksi OFFLINE`
                });
            }
        }
        // Identify newly online
        for (const username of currentOnline) {
            if (!this.lastOnlineUsernames.has(username)) {
                alerts.push({
                    type: 'online',
                    username,
                    timestamp: new Date().toISOString(),
                    message: `Pelanggan ${username} kembali ONLINE`
                });
            }
        }
        this.lastOnlineUsernames = currentOnline;
        return alerts;
    }
}
exports.RealtimeMonitoringService = RealtimeMonitoringService;
//# sourceMappingURL=RealtimeMonitoringService.js.map