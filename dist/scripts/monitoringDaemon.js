"use strict";
/**
 * Background Monitoring Service
 * Continuously monitors all devices and updates their status
 */
Object.defineProperty(exports, "__esModule", { value: true });
const NetworkMonitoringService_1 = require("../services/monitoring/NetworkMonitoringService");
const pool_1 = require("../db/pool");
class MonitoringDaemon {
    constructor() {
        this.isRunning = false;
        this.checkInterval = 30000; // 30 seconds
    }
    async start() {
        console.log('🔍 Network Monitoring Daemon started');
        this.isRunning = true;
        // Run initial check
        await this.checkAllDevices();
        // Schedule periodic checks
        setInterval(async () => {
            if (this.isRunning) {
                await this.checkAllDevices();
            }
        }, this.checkInterval);
    }
    async stop() {
        console.log('⏹️  Network Monitoring Daemon stopped');
        this.isRunning = false;
    }
    async checkAllDevices() {
        try {
            console.log(`[${new Date().toISOString()}] Checking all devices...`);
            // Get all devices with IP addresses
            const [devices] = await pool_1.databasePool.query('SELECT id, name, ip_address, status, device_type FROM network_devices WHERE ip_address IS NOT NULL');
            let checked = 0;
            let statusChanged = 0;
            for (const device of devices) {
                try {
                    const oldStatus = device.status;
                    const newStatus = await NetworkMonitoringService_1.NetworkMonitoringService.checkDeviceStatus(device.id);
                    await NetworkMonitoringService_1.NetworkMonitoringService.updateDeviceStatus(device.id, newStatus);
                    checked++;
                    // Log status change
                    if (oldStatus !== newStatus.status) {
                        console.log(`  📊 ${device.name}: ${oldStatus} → ${newStatus.status}`);
                        statusChanged++;
                        // Log to database
                        await pool_1.databasePool.query(`INSERT INTO device_status_logs 
                             (device_id, previous_status, new_status, latency_ms, packet_loss_percent, check_method)
                             VALUES (?, ?, ?, ?, ?, 'ping')`, [device.id, oldStatus, newStatus.status, newStatus.latency_ms, newStatus.packet_loss_percent]);
                        // Trigger mass outage notification if device went down
                        if (newStatus.status === 'offline' && oldStatus === 'online') {
                            console.log(`  🚨 ALERT: ${device.name} went OFFLINE!`);
                            await NetworkMonitoringService_1.NetworkMonitoringService.handleDeviceDown(device.id, device.device_type, device.name);
                        }
                    }
                }
                catch (error) {
                    console.error(`  ❌ Error checking ${device.name}:`, error);
                }
            }
            console.log(`  ✅ Checked ${checked} devices, ${statusChanged} status changes\n`);
        }
        catch (error) {
            console.error('Error in monitoring daemon:', error);
        }
    }
}
// Start daemon
const daemon = new MonitoringDaemon();
daemon.start();
// Graceful shutdown
process.on('SIGINT', async () => {
    await daemon.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await daemon.stop();
    process.exit(0);
});
//# sourceMappingURL=monitoringDaemon.js.map