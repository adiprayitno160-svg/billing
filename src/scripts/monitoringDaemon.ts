/**
 * Background Monitoring Service
 * Continuously monitors all devices and updates their status
 */

import { NetworkMonitoringService } from '../services/monitoring/NetworkMonitoringService';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

class MonitoringDaemon {
    private isRunning = false;
    private checkInterval = 20000; // 20 seconds (base interval)


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

        // Schedule periodic sync (every hour)
        setInterval(async () => {
            if (this.isRunning) {
                await this.runSyncTasks();
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    private async runSyncTasks() {
        console.log('🔄 Running periodic network sync...');
        try {
            await NetworkMonitoringService.syncCustomerDevices();
            await NetworkMonitoringService.syncFTTHInfrastructure();
            await NetworkMonitoringService.autoCreateLinks();
            console.log('✅ Periodic sync completed.');
        } catch (error) {
            console.error('❌ Error in periodic sync:', error);
        }
    }

    async stop() {
        console.log('⏹️  Network Monitoring Daemon stopped');
        this.isRunning = false;
    }

    private async checkAllDevices() {
        try {
            // Get all devices with IP addresses
            const [devices] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, ip_address, status, device_type, last_check FROM network_devices WHERE ip_address IS NOT NULL'
            );

            const NOW = new Date();

            for (const device of devices) {
                try {
                    // Logic: 
                    // - If Offline/Warning: Check every cycle
                    // - If Online: Check every 5 minutes
                    let shouldCheck = true;

                    if (device.status === 'online' && device.last_check) {
                        const lastCheckTime = new Date(device.last_check).getTime();
                        const timeDiff = NOW.getTime() - lastCheckTime;
                        const FIVE_MINUTES_MS = 5 * 60 * 1000;

                        if (timeDiff < FIVE_MINUTES_MS) {
                            shouldCheck = false;
                        }
                    }

                    if (!shouldCheck) continue;

                    const oldStatus = device.status;
                    // Keep smarter check (retries) as it helps stability, but remove parent dependency
                    const newStatus = await NetworkMonitoringService.checkDeviceStatusSmarter(device.id);

                    await NetworkMonitoringService.updateDeviceStatus(device.id, newStatus);

                    // Log status change
                    if (oldStatus !== newStatus.status) {
                        console.log(`  📊 ${device.name}: ${oldStatus} → ${newStatus.status}`);

                        // Log to database
                        await databasePool.query(
                            `INSERT INTO device_status_logs 
                             (device_id, previous_status, new_status, latency_ms, packet_loss_percent, check_method)
                             VALUES (?, ?, ?, ?, ?, 'ping')`,
                            [device.id, oldStatus, newStatus.status, newStatus.latency_ms || 0, newStatus.packet_loss_percent || 0]
                        );

                        // Trigger mass outage notification if device went down
                        if (newStatus.status === 'offline' && oldStatus === 'online') {
                            console.log(`  🚨 ALERT: ${device.name} went OFFLINE!`);
                            await NetworkMonitoringService.handleDeviceDown(device.id, device.device_type, device.name);
                        }
                    }
                } catch (error) {
                    console.error(`  ❌ Error checking ${device.name}:`, error);
                }
            }
        } catch (error) {
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
