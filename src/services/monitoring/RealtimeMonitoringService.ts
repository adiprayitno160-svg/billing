
import { Server as SocketIOServer } from 'socket.io';
import { getMikrotikConfig } from '../pppoeService';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RealtimeMonitoringService {
    private io: SocketIOServer;
    private isRunning: boolean = false;
    private interval: NodeJS.Timeout | null = null;
    private readonly POLLING_INTERVAL = 3000; // 3 seconds to be safe

    constructor(io: SocketIOServer) {
        this.io = io;
    }

    public start() {
        if (this.isRunning) return;
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

    public stop() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private async startPolling() {
        this.interval = setInterval(async () => {
            try {
                const data = await this.gatherMetrics();
                this.io.emit('monitoring:update', data);
            } catch (error) {
                console.error('Error gathering monitoring metrics:', error);
            }
        }, this.POLLING_INTERVAL);
    }

    private async gatherMetrics() {
        const serverStats = await this.getServerStats();
        const networkStats = await this.getNetworkStats();

        return {
            timestamp: new Date().toISOString(),
            server: serverStats,
            network: networkStats
        };
    }

    private async getServerStats() {
        const cpuUsage = Math.round(os.loadavg()[0] * 10) % 100; // Rough estimate
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

        let temperature = 'N/A';
        // Simple temp check (Linux only usually)
        try {
            if (os.platform() === 'linux') {
                const { stdout } = await execAsync('cat /sys/class/thermal/thermal_zone0/temp');
                const temp = parseInt(stdout.trim());
                if (!isNaN(temp)) {
                    temperature = (temp / 1000).toFixed(1) + '°C';
                }
            }
        } catch (e) { }

        return {
            cpu: cpuUsage,
            memory: memUsage,
            uptime: os.uptime(),
            temperature
        };
    }

    private async getNetworkStats() {
        try {
            const config = await getMikrotikConfig();
            if (!config) return null;

            // Use the pool to execute commands
            const { mikrotikPool } = await import('../../services/MikroTikConnectionPool');

            const poolConfig = {
                host: config.host,
                port: config.port || config.api_port || 8728,
                username: config.username,
                password: config.password
            };

            // 1. Get Active PPPoE Count
            const activeSessions = await mikrotikPool.execute(
                poolConfig,
                '/ppp/active/print',
                ['count-only']
            );

            // 2. Get Interface Stats
            const interfaces = await mikrotikPool.execute(
                poolConfig,
                '/interface/print',
                ['?running=true']
            );

            let totalRx = 0;
            let totalTx = 0;
            let wanInterface = null;

            if (Array.isArray(interfaces)) {
                interfaces.forEach((iface: any) => {
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
                interfaces: Array.isArray(interfaces) ? interfaces.map((i: any) => ({
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
                total_tx: totalTx
            };

        } catch (error) {
            console.error('Error in getNetworkStats:', error);
            return null;
        }
    }
}
