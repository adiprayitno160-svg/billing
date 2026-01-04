/**
 * Network Monitoring Service
 * Core service for network device monitoring
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { GenieacsService } from '../genieacs/GenieacsService';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NetworkDevice {
    id: number;
    device_type: 'customer' | 'ont' | 'olt' | 'odc' | 'odp' | 'router' | 'switch' | 'access_point';
    name: string;
    ip_address?: string;
    mac_address?: string;
    genieacs_id?: string;
    genieacs_serial?: string;
    customer_id?: number;
    olt_id?: number;
    odc_id?: number;
    odp_id?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    status: 'online' | 'offline' | 'warning' | 'unknown';
    last_seen?: Date;
    last_check?: Date;
    latency_ms?: number;
    packet_loss_percent?: number;
    uptime_percent?: number;
    metadata?: any;
    icon?: string;
    color?: string;
    created_at: Date;
    updated_at: Date;
}

export interface DeviceStatus {
    status: 'online' | 'offline' | 'warning' | 'unknown';
    latency_ms?: number;
    packet_loss_percent?: number;
    error_message?: string;
}

export interface NetworkLink {
    id: number;
    source_device_id: number;
    target_device_id: number;
    link_type: 'fiber' | 'wireless' | 'ethernet' | 'virtual';
    bandwidth_mbps?: number;
    status: 'up' | 'down' | 'degraded';
    color?: string;
    width?: number;
    style?: 'solid' | 'dashed' | 'dotted';
}

export interface TopologyData {
    devices: NetworkDevice[];
    links: NetworkLink[];
    statistics: {
        total_devices: number;
        online_devices: number;
        offline_devices: number;
        warning_devices: number;
    };
}

export class NetworkMonitoringService {
    private static genieacsService: GenieacsService;

    /**
     * Initialize service
     */
    static async initialize(): Promise<void> {
        this.genieacsService = GenieacsService.getInstance();
    }

    /**
     * Sync devices from GenieACS
     */
    static async syncDevicesFromGenieACS(): Promise<{ added: number; updated: number }> {
        let added = 0;
        let updated = 0;

        try {
            const devices = await this.genieacsService.getDevices(1000);
            console.log(`📡 Syncing ${devices.length} devices from GenieACS...`);

            for (const device of devices) {
                const deviceInfo = this.genieacsService.extractDeviceInfo(device);

                // Check if device already exists
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_devices WHERE genieacs_id = ? LIMIT 1',
                    [device._id]
                );

                const deviceData = {
                    device_type: 'ont' as const,
                    name: `${deviceInfo.manufacturer} ${deviceInfo.model} - ${deviceInfo.serialNumber}`,
                    genieacs_id: device._id,
                    genieacs_serial: deviceInfo.serialNumber,
                    status: deviceInfo.isOnline ? 'online' as const : 'offline' as const,
                    last_seen: deviceInfo.lastInform,
                    icon: 'ont',
                    color: deviceInfo.isOnline ? '#10B981' : '#EF4444',
                    metadata: JSON.stringify({
                        manufacturer: deviceInfo.manufacturer,
                        model: deviceInfo.model,
                        software_version: deviceInfo.softwareVersion,
                        product_class: deviceInfo.productClass,
                        ip_address: deviceInfo.ipAddress,
                        signal: deviceInfo.signal,
                        genieacs: deviceInfo.wifi
                    })
                };

                if (existing.length > 0) {
                    // Update existing device
                    await databasePool.query(
                        `UPDATE network_devices 
                         SET name = ?, status = ?, last_seen = ?, color = ?, metadata = ?, updated_at = NOW()
                         WHERE genieacs_id = ?`,
                        [deviceData.name, deviceData.status, deviceData.last_seen, deviceData.color, deviceData.metadata, device._id]
                    );
                    updated++;
                } else {
                    // Insert new device
                    await databasePool.query(
                        `INSERT INTO network_devices 
                         (device_type, name, genieacs_id, genieacs_serial, status, last_seen, icon, color, metadata)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [deviceData.device_type, deviceData.name, deviceData.genieacs_id, deviceData.genieacs_serial,
                        deviceData.status, deviceData.last_seen, deviceData.icon, deviceData.color, deviceData.metadata]
                    );
                    added++;
                }
            }

            console.log(`✅ GenieACS sync complete: ${added} added, ${updated} updated`);
            return { added, updated };

        } catch (error) {
            console.error('❌ Error syncing from GenieACS:', error);
            throw error;
        }
    }

    /**
     * Sync devices from customers table
     */
    static async syncCustomerDevices(): Promise<{ added: number; updated: number }> {
        let added = 0;
        let updated = 0;

        try {
            const [customers] = await databasePool.query<RowDataPacket[]>(
                `SELECT c.id, c.name, c.customer_code, c.connection_type, c.status, 
                        c.latitude, c.longitude, c.address, c.pppoe_username, c.odc_id, c.odp_id,
                        sic.ip_address as static_ip_address
                 FROM customers c
                 LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
                 WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`
            );

            console.log(`👥 Syncing ${customers.length} customers with coordinates...`);

            for (const customer of customers) {
                // Check if device already exists
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_devices WHERE customer_id = ? LIMIT 1',
                    [customer.id]
                );

                const ipAddress = customer.connection_type === 'static_ip'
                    ? customer.static_ip_address
                    : null;

                const deviceData = {
                    device_type: 'customer' as const,
                    name: `${customer.name} (${customer.customer_code})`,
                    ip_address: ipAddress,
                    customer_id: customer.id,
                    odc_id: customer.odc_id,
                    odp_id: customer.odp_id,
                    latitude: customer.latitude,
                    longitude: customer.longitude,
                    address: customer.address,
                    status: customer.status === 'active' ? 'online' as const : 'offline' as const,
                    icon: 'customer',
                    color: customer.status === 'active' ? '#3B82F6' : '#9CA3AF',
                    metadata: JSON.stringify({
                        connection_type: customer.connection_type,
                        pppoe_username: customer.pppoe_username
                    })
                };

                if (existing.length > 0) {
                    // Update existing device
                    await databasePool.query(
                        `UPDATE network_devices 
                         SET name = ?, ip_address = ?, latitude = ?, longitude = ?, address = ?, 
                             status = ?, color = ?, metadata = ?, updated_at = NOW()
                         WHERE customer_id = ?`,
                        [deviceData.name, deviceData.ip_address, deviceData.latitude, deviceData.longitude,
                        deviceData.address, deviceData.status, deviceData.color, deviceData.metadata, customer.id]
                    );
                    updated++;
                } else {
                    // Insert new device
                    await databasePool.query(
                        `INSERT INTO network_devices 
                         (device_type, name, ip_address, customer_id, odc_id, odp_id, latitude, longitude, 
                          address, status, icon, color, metadata)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [deviceData.device_type, deviceData.name, deviceData.ip_address, deviceData.customer_id,
                        deviceData.odc_id, deviceData.odp_id, deviceData.latitude, deviceData.longitude,
                        deviceData.address, deviceData.status, deviceData.icon, deviceData.color, deviceData.metadata]
                    );
                    added++;
                }
            }

            console.log(`✅ Customer sync complete: ${added} added, ${updated} updated`);
            return { added, updated };

        } catch (error) {
            console.error('❌ Error syncing customers:', error);
            throw error;
        }
    }

    /**
     * Sync FTTH infrastructure (OLT, ODC, ODP)
     */
    static async syncFTTHInfrastructure(): Promise<{ added: number; updated: number }> {
        let added = 0;
        let updated = 0;

        try {
            // Sync OLTs
            const [olts] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, latitude, longitude, location FROM ftth_olt'
            );

            for (const olt of olts) {
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_devices WHERE olt_id = ? AND device_type = "olt" LIMIT 1',
                    [olt.id]
                );

                if (existing.length > 0) {
                    await databasePool.query(
                        `UPDATE network_devices 
                         SET name = ?, latitude = ?, longitude = ?, address = ?, updated_at = NOW()
                         WHERE olt_id = ? AND device_type = "olt"`,
                        [olt.name, olt.latitude, olt.longitude, olt.location, olt.id]
                    );
                    updated++;
                } else {
                    await databasePool.query(
                        `INSERT INTO network_devices 
                         (device_type, name, olt_id, latitude, longitude, address, status, icon, color)
                         VALUES ("olt", ?, ?, ?, ?, ?, "online", "olt", "#8B5CF6")`,
                        [olt.name, olt.id, olt.latitude, olt.longitude, olt.location]
                    );
                    added++;
                }
            }

            // Sync ODCs
            const [odcs] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, olt_id, latitude, longitude, location FROM ftth_odc'
            );

            for (const odc of odcs) {
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_devices WHERE odc_id = ? AND device_type = "odc" LIMIT 1',
                    [odc.id]
                );

                if (existing.length > 0) {
                    await databasePool.query(
                        `UPDATE network_devices 
                         SET name = ?, olt_id = ?, latitude = ?, longitude = ?, address = ?, updated_at = NOW()
                         WHERE odc_id = ? AND device_type = "odc"`,
                        [odc.name, odc.olt_id, odc.latitude, odc.longitude, odc.location, odc.id]
                    );
                    updated++;
                } else {
                    await databasePool.query(
                        `INSERT INTO network_devices 
                         (device_type, name, odc_id, olt_id, latitude, longitude, address, status, icon, color)
                         VALUES ("odc", ?, ?, ?, ?, ?, ?, "online", "odc", "#F59E0B")`,
                        [odc.name, odc.id, odc.olt_id, odc.latitude, odc.longitude, odc.location]
                    );
                    added++;
                }
            }

            // Sync ODPs
            const [odps] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, odc_id, latitude, longitude, location FROM ftth_odp'
            );

            for (const odp of odps) {
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_devices WHERE odp_id = ? AND device_type = "odp" LIMIT 1',
                    [odp.id]
                );

                if (existing.length > 0) {
                    await databasePool.query(
                        `UPDATE network_devices 
                         SET name = ?, odc_id = ?, latitude = ?, longitude = ?, address = ?, updated_at = NOW()
                         WHERE odp_id = ? AND device_type = "odp"`,
                        [odp.name, odp.odc_id, odp.latitude, odp.longitude, odp.location, odp.id]
                    );
                    updated++;
                } else {
                    await databasePool.query(
                        `INSERT INTO network_devices 
                         (device_type, name, odp_id, odc_id, latitude, longitude, address, status, icon, color)
                         VALUES ("odp", ?, ?, ?, ?, ?, ?, "online", "odp", "#EC4899")`,
                        [odp.name, odp.id, odp.odc_id, odp.latitude, odp.longitude, odp.location]
                    );
                    added++;
                }
            }

            console.log(`✅ FTTH infrastructure sync complete: ${added} added, ${updated} updated`);
            return { added, updated };

        } catch (error) {
            console.error('❌ Error syncing FTTH infrastructure:', error);
            throw error;
        }
    }

    /**
     * Check device status via ping
     */
    static async checkDeviceStatus(deviceId: number): Promise<DeviceStatus> {
        try {
            const [devices] = await databasePool.query<RowDataPacket[]>(
                'SELECT ip_address FROM network_devices WHERE id = ? LIMIT 1',
                [deviceId]
            );

            if (devices.length === 0 || !devices[0] || !devices[0].ip_address) {
                return { status: 'unknown', error_message: 'No IP address' };
            }

            const ipAddress = devices[0].ip_address;

            // Ping device (Windows compatible)
            const { stdout } = await execAsync(`ping -n 4 ${ipAddress}`);

            // Parse ping results
            const avgLatencyMatch = stdout.match(/Average = (\d+)ms/);
            const packetLossMatch = stdout.match(/\((\d+)% loss\)/);

            const latency_ms = avgLatencyMatch && avgLatencyMatch[1] ? parseFloat(avgLatencyMatch[1]) : null;
            const packet_loss_percent = packetLossMatch && packetLossMatch[1] ? parseFloat(packetLossMatch[1]) : null;

            let status: 'online' | 'offline' | 'warning' = 'online';

            if (packet_loss_percent === 100) {
                status = 'offline';
            } else if (packet_loss_percent && packet_loss_percent > 5) {
                status = 'warning';
            } else if (latency_ms && latency_ms > 100) {
                status = 'warning';
            }

            return {
                status,
                latency_ms: latency_ms || undefined,
                packet_loss_percent: packet_loss_percent || undefined
            };

        } catch (error) {
            return {
                status: 'offline',
                error_message: error instanceof Error ? error.message : 'Ping failed'
            };
        }
    }

    /**
     * Get all devices with current status
     */
    static async getAllDevices(): Promise<NetworkDevice[]> {
        const [devices] = await databasePool.query<RowDataPacket[]>(
            'SELECT * FROM network_devices ORDER BY device_type, name'
        );

        return devices.map(device => {
            let metadata = null;
            if (device.metadata) {
                if (typeof device.metadata === 'string') {
                    try {
                        metadata = JSON.parse(device.metadata);
                    } catch (e) {
                        console.error('Error parsing device metadata:', e);
                        metadata = null;
                    }
                } else {
                    metadata = device.metadata;
                }
            }
            return {
                ...device,
                latitude: device.latitude ? parseFloat(device.latitude) : null,
                longitude: device.longitude ? parseFloat(device.longitude) : null,
                metadata
            };
        }) as NetworkDevice[];
    }

    /**
     * Get network topology data
     */
    static async getNetworkTopology(): Promise<TopologyData> {
        let devices = await this.getAllDevices();

        // Inject ODC Port Info
        try {
            const [odcDetails] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    o.id, 
                    o.total_ports,
                    (SELECT COUNT(*) FROM ftth_odp WHERE odc_id = o.id) as used_ports 
                FROM ftth_odc o
            `);

            // Creates a map for faster lookup: odc_id -> { total_ports, used_ports }
            const odcPortMap = new Map<number, { total: number, used: number }>();
            (odcDetails as any[]).forEach(odc => {
                odcPortMap.set(odc.id, { total: odc.total_ports, used: odc.used_ports });
            });

            // Inject ODP Port Info
            const [odpDetails] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    id, 
                    total_ports, 
                    used_ports 
                FROM ftth_odp
            `);
            const odpPortMap = new Map<number, { total: number, used: number }>();
            (odpDetails as any[]).forEach(odp => {
                odpPortMap.set(odp.id, { total: odp.total_ports, used: odp.used_ports });
            });

            // Update devices metadata with port info
            devices = devices.map(device => {
                let metadata = device.metadata && typeof device.metadata === 'object' ? device.metadata : {};

                // ODC Port Injection
                if (device.device_type === 'odc' && device.odc_id) {
                    const ports = odcPortMap.get(device.odc_id);
                    if (ports) {
                        metadata = {
                            ...metadata,
                            port_info: {
                                total: ports.total,
                                used: ports.used,
                                free: ports.total - ports.used
                            }
                        };
                    }
                }

                // ODP Port Injection
                if (device.device_type === 'odp' && device.odp_id) {
                    const ports = odpPortMap.get(device.odp_id);
                    if (ports) {
                        metadata = {
                            ...metadata,
                            port_info: {
                                total: ports.total,
                                used: ports.used,
                                free: ports.total - ports.used
                            }
                        };
                    }
                }

                return { ...device, metadata };
            });

        } catch (e) {
            console.error('Error injecting ODC/ODP port info:', e);
        }

        // Inject Live PPPoE Status
        try {
            // Dynamic import to avoid circular dependencies if any
            const { getMikrotikConfig } = await import('../pppoeService');
            const { getPppoeActiveConnections } = await import('../mikrotikService');

            const config = await getMikrotikConfig();
            if (config) {
                const activeSessions = await getPppoeActiveConnections(config);
                const activeUsernames = new Set(activeSessions.map(s => s.name));
                const sessionMap = new Map(activeSessions.map(s => [s.name, s]));

                devices = devices.map(device => {
                    if (device.device_type === 'customer') {
                        const metadata = device.metadata || {};
                        const username = metadata.pppoe_username;

                        if (username) {
                            const isOnline = activeUsernames.has(username);
                            // If isOnline is true, set status to online. 
                            // If false, set to offline (override DB status which might be 'active' but offline)
                            const newStatus = isOnline ? 'online' : 'offline';

                            // Optional: Inject session details
                            const session = sessionMap.get(username);

                            return {
                                ...device,
                                status: newStatus as any,
                                metadata: {
                                    ...metadata,
                                    session_info: session ? {
                                        uptime: session.uptime,
                                        address: session.address,
                                        mac: session['caller-id']
                                    } : null
                                }
                            };
                        }
                    }
                    return device;
                });
            }
        } catch (e) {
            console.error('Error injecting live PPPoE status:', e);
        }

        // Inject GenieACS Signal Data into Customer Devices (Robust Matching)
        try {
            // Create maps for ONT metadata matching
            const ontByIp = new Map<string, any>();
            const ontBySerial = new Map<string, any>();

            devices.forEach(d => {
                if (d.device_type === 'ont' && d.metadata) {
                    if (d.ip_address && d.ip_address !== '-') ontByIp.set(d.ip_address, d.metadata);
                    if (d.metadata.ip_address && d.metadata.ip_address !== '-') ontByIp.set(d.metadata.ip_address, d.metadata);
                    if (d.genieacs_serial) ontBySerial.set(d.genieacs_serial, d.metadata);
                }
            });

            // Fetch customer serial numbers for matching
            const [custLinks] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, serial_number FROM customers WHERE serial_number IS NOT NULL'
            );
            const customerToSerialMap = new Map(custLinks.map(c => [c.id, c.serial_number]));

            devices = devices.map(device => {
                if (device.device_type === 'customer') {
                    let ontData = null;

                    // 1. Match by Serial Number (Linked in Billing)
                    const serial = customerToSerialMap.get(device.customer_id);
                    if (serial) {
                        ontData = ontBySerial.get(serial);
                    }

                    // 2. Match by IP Address (Dynamic fallback)
                    if (!ontData) {
                        let ip = device.ip_address;
                        if (device.metadata && device.metadata.session_info && device.metadata.session_info.address) {
                            ip = device.metadata.session_info.address;
                        }
                        if (ip && ip !== '-') ontData = ontByIp.get(ip);
                    }

                    if (ontData && ontData.signal) {
                        return {
                            ...device,
                            metadata: {
                                ...device.metadata,
                                signal: ontData.signal,
                                genieacs: {
                                    ...(device.metadata.genieacs || {}),
                                    ...(ontData.genieacs || {}),
                                    model: ontData.model,
                                    manufacturer: ontData.manufacturer
                                }
                            }
                        };
                    }
                }
                return device;
            });
        } catch (e) {
            console.error('Error injecting GenieACS data into topology:', e);
        }

        // Auto-sync checks:
        // 1. Check if we display any customers. If 0, and we have customers with lat/long, sync them!
        const [customerCountResult] = await databasePool.query<RowDataPacket[]>(
            "SELECT COUNT(*) as count FROM network_devices WHERE device_type = 'customer'"
        );
        const existingCustomerCount = (customerCountResult as any)[0]?.count || 0;

        // If we have very few customers, it might be an indication of missing sync
        if (existingCustomerCount === 0) {
            // Check if we DO have customers with coordinates
            const [potentialCustomers] = await databasePool.query<RowDataPacket[]>(
                "SELECT COUNT(*) as count FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
            );
            const potentialCount = (potentialCustomers as any)[0]?.count || 0;

            if (potentialCount > 0) {
                console.log('📍 Topology request detected missing customers. Triggering auto-sync...');
                await this.syncCustomerDevices();
                // Re-fetch devices after sync
                devices = await this.getAllDevices();
            }
        }

        // 2. Check if we display any FTTH infrastructure (OLT, ODC, ODP). If missing, sync them!
        const [ftthCountResult] = await databasePool.query<RowDataPacket[]>(
            "SELECT COUNT(*) as count FROM network_devices WHERE device_type IN ('olt', 'odc', 'odp')"
        );
        const existingFtthCount = (ftthCountResult as any)[0]?.count || 0;

        if (existingFtthCount === 0) {
            // Check if we have FTTH infrastructure in the ftth_* tables
            const [potentialOlt] = await databasePool.query<RowDataPacket[]>(
                "SELECT COUNT(*) as count FROM ftth_olt"
            );
            const [potentialOdc] = await databasePool.query<RowDataPacket[]>(
                "SELECT COUNT(*) as count FROM ftth_odc"
            );
            const [potentialOdp] = await databasePool.query<RowDataPacket[]>(
                "SELECT COUNT(*) as count FROM ftth_odp"
            );

            const oltCount = (potentialOlt as any)[0]?.count || 0;
            const odcCount = (potentialOdc as any)[0]?.count || 0;
            const odpCount = (potentialOdp as any)[0]?.count || 0;
            const potentialFtthCount = oltCount + odcCount + odpCount;

            if (potentialFtthCount > 0) {
                console.log(`🏗️ Topology request detected missing FTTH infrastructure (${oltCount} OLT, ${odcCount} ODC, ${odpCount} ODP). Triggering auto-sync...`);
                await this.syncFTTHInfrastructure();
                // Re-fetch devices after sync
                devices = await this.getAllDevices();
            }
        }

        const [links] = await databasePool.query<RowDataPacket[]>(
            'SELECT * FROM network_links'
        );

        // 3. Check if we have links. If 0 but we have devices, auto-create them!
        if ((links as any[]).length === 0 && devices.length > 0) {
            console.log('🔗 Topology request detected missing network links. Triggering auto-create...');
            await this.autoCreateLinks();
            // Re-fetch links after creation
            const [newLinks] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM network_links'
            );

            // Calculate statistics
            const [stats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    COUNT(*) as total_devices,
                    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_devices,
                    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_devices,
                    SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_devices
                 FROM network_devices`
            );

            return {
                devices,
                links: newLinks as NetworkLink[],
                statistics: stats[0] as any
            };
        }

        const [stats] = await databasePool.query<RowDataPacket[]>(
            `SELECT 
                COUNT(*) as total_devices,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_devices,
                SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_devices,
                SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_devices
             FROM network_devices`
        );

        return {
            devices,
            links: links as NetworkLink[],
            statistics: stats[0] as any
        };
    }

    /**
     * Update device status
     */
    static async updateDeviceStatus(deviceId: number, statusData: DeviceStatus): Promise<void> {
        await databasePool.query(
            `UPDATE network_devices 
             SET status = ?, latency_ms = ?, packet_loss_percent = ?, last_check = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [statusData.status, statusData.latency_ms, statusData.packet_loss_percent, deviceId]
        );

        if (statusData.status === 'online') {
            await databasePool.query(
                'UPDATE network_devices SET last_seen = NOW() WHERE id = ?',
                [deviceId]
            );
        }
    }

    /**
     * Auto-create network links based on topology
     */
    static async autoCreateLinks(): Promise<number> {
        let created = 0;

        try {
            // Link customers to their ODPs
            const [customerOdpLinks] = await databasePool.query<RowDataPacket[]>(
                `SELECT c.id as customer_id, o.id as odp_id
                 FROM network_devices c
                 JOIN network_devices o ON c.odp_id = o.odp_id AND o.device_type = 'odp'
                 WHERE c.device_type = 'customer' AND c.odp_id IS NOT NULL`
            );

            for (const link of customerOdpLinks) {
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_links WHERE source_device_id = ? AND target_device_id = ? LIMIT 1',
                    [link.customer_id, link.odp_id]
                );

                if (existing.length === 0) {
                    await databasePool.query(
                        `INSERT INTO network_links (source_device_id, target_device_id, link_type, status)
                         VALUES (?, ?, 'fiber', 'up')`,
                        [link.customer_id, link.odp_id]
                    );
                    created++;
                }
            }

            // Link ODPs to ODCs
            const [odpOdcLinks] = await databasePool.query<RowDataPacket[]>(
                `SELECT odp.id as odp_id, odc.id as odc_id
                 FROM network_devices odp
                 JOIN network_devices odc ON odp.odc_id = odc.odc_id AND odc.device_type = 'odc'
                 WHERE odp.device_type = 'odp' AND odp.odc_id IS NOT NULL`
            );

            for (const link of odpOdcLinks) {
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_links WHERE source_device_id = ? AND target_device_id = ? LIMIT 1',
                    [link.odp_id, link.odc_id]
                );

                if (existing.length === 0) {
                    await databasePool.query(
                        `INSERT INTO network_links (source_device_id, target_device_id, link_type, status)
                         VALUES (?, ?, 'fiber', 'up')`,
                        [link.odp_id, link.odc_id]
                    );
                    created++;
                }
            }

            // Link ODCs to OLTs
            const [odcOltLinks] = await databasePool.query<RowDataPacket[]>(
                `SELECT odc.id as odc_id, olt.id as olt_id
                 FROM network_devices odc
                 JOIN network_devices olt ON odc.olt_id = olt.olt_id AND olt.device_type = 'olt'
                 WHERE odc.device_type = 'odc' AND odc.olt_id IS NOT NULL`
            );

            for (const link of odcOltLinks) {
                const [existing] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id FROM network_links WHERE source_device_id = ? AND target_device_id = ? LIMIT 1',
                    [link.odc_id, link.olt_id]
                );

                if (existing.length === 0) {
                    await databasePool.query(
                        `INSERT INTO network_links (source_device_id, target_device_id, link_type, status)
                         VALUES (?, ?, 'fiber', 'up')`,
                        [link.odc_id, link.olt_id]
                    );
                    created++;
                }
            }

            console.log(`✅ Auto-created ${created} network links`);
            return created;

        } catch (error) {
            console.error('❌ Error auto-creating links:', error);
            throw error;
        }
    }
    /**
     * Handle device down event - check for mass outage and notify
     */
    static async handleDeviceDown(deviceId: number, deviceType: string, deviceName: string): Promise<void> {
        if (!['olt', 'odc'].includes(deviceType)) {
            return; // Only care about infrastructure for mass notification
        }

        console.log(`🚨 Handling mass outage for ${deviceType.toUpperCase()} ${deviceName} (ID: ${deviceId})`);

        try {
            let affectedCustomers: any[] = [];

            if (deviceType === 'olt') {
                // Find all customers under this OLT
                // Join network_devices to get customer_id, then join customers to get phone
                const [customers] = await databasePool.query<RowDataPacket[]>(
                    `SELECT c.name, c.phone 
                     FROM network_devices nd
                     JOIN network_devices olt_target ON nd.olt_id = olt_target.olt_id
                     JOIN customers c ON nd.customer_id = c.id
                     WHERE olt_target.id = ? 
                     AND nd.device_type = 'customer'
                     AND c.phone IS NOT NULL`,
                    [deviceId]
                );
                affectedCustomers = customers;

            } else if (deviceType === 'odc') {
                // Find all customers under this ODC
                const [customers] = await databasePool.query<RowDataPacket[]>(
                    `SELECT c.name, c.phone 
                     FROM network_devices nd
                     JOIN network_devices odc_target ON nd.odc_id = odc_target.odc_id
                     JOIN customers c ON nd.customer_id = c.id
                     WHERE odc_target.id = ? 
                     AND nd.device_type = 'customer'
                     AND c.phone IS NOT NULL`,
                    [deviceId]
                );
                affectedCustomers = customers;
            }

            if (affectedCustomers.length === 0) {
                console.log(`  ℹ️ No affected customers found with phone numbers.`);
                return;
            }

            console.log(`  📢 Sending mass outage notification to ${affectedCustomers.length} customers...`);

            // Send notifications
            // Import WhatsAppService dynamically to avoid circular dependency issues if any, 
            // or just use the imported class if I added the import. 
            // I will add the import at top of file, but to be safe I'll assume it is available.
            const { WhatsAppService } = require('../whatsapp/WhatsAppService');

            const message = `⚠️ *PEMBERITAHUAN GANGGUAN JARINGAN*\n\n` +
                `Pelanggan Yth,\n` +
                `Saat ini terdeteksi gangguan pada perangkat jaringan kami di area Anda (${deviceName}).\n\n` +
                `Tim teknis kami sedang menangani masalah ini agar koneksi internet Anda dapat segera kembali normal.\n\n` +
                `Mohon maaf atas ketidaknyamanan ini.\n` +
                `Terima kasih.`;

            let sentCount = 0;
            for (const customer of affectedCustomers) {
                try {
                    // Send to customer phone
                    // Need to format phone if needed, but WhatsAppService usually handles some
                    await WhatsAppService.sendMessage(customer.phone, message);
                    sentCount++;
                } catch (err) {
                    console.error(`  ❌ Failed to send to ${customer.name}:`, err);
                }
            }

            console.log(`  ✅ Notification sent to ${sentCount}/${affectedCustomers.length} customers.`);

        } catch (error) {
            console.error('❌ Error handling mass outage:', error);
        }
    }


    /**
     * Get all troubled customers (Offline, Maintenance, High Latency, etc.)
     * Consolidated logic from dashboard
     */
    static async getTroubleCustomers(): Promise<any[]> {
        try {
            // Check which tables exist
            const [tables] = await databasePool.query("SHOW TABLES") as any[];
            const tableNames = Array.isArray(tables) ? tables.map((t: any) => Object.values(t)[0]) : [];

            const hasMaintenance = tableNames.includes('maintenance_schedules');
            const hasConnectionLogs = tableNames.includes('connection_logs');
            const hasStaticIpStatus = tableNames.includes('static_ip_ping_status');
            const hasSlaIncidents = tableNames.includes('sla_incidents');
            const hasTickets = tableNames.includes('tickets');

            // Check if is_isolated column exists in customers table
            let hasIsolated = false;
            try {
                const [cols] = await databasePool.query(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_isolated'"
                ) as any[];
                hasIsolated = Array.isArray(cols) && cols.length > 0;
            } catch {
                hasIsolated = false;
            }

            // Check if issue_type column exists in maintenance_schedules
            let hasIssueType = false;
            if (hasMaintenance) {
                try {
                    const [cols] = await databasePool.query(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_schedules' AND COLUMN_NAME = 'issue_type'"
                    ) as any[];
                    hasIssueType = Array.isArray(cols) && cols.length > 0;
                } catch {
                    hasIssueType = false;
                }
            }

            // Build UNION query for all trouble sources
            const queries: string[] = [];
            const isolatedFilter = hasIsolated ? 'AND (c.is_isolated = 0 OR c.is_isolated IS NULL)' : '';

            // 1. Customers with maintenance schedules
            if (hasMaintenance) {
                const issueTypeColumn = hasIssueType ? "COALESCE(m.issue_type, 'Maintenance')" : "'Maintenance'";
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone,
                        m.status as maintenance_status, 
                        ${issueTypeColumn} as issue_type, 
                        m.created_at as trouble_since,
                        'maintenance' as trouble_type
                    FROM customers c
                    INNER JOIN maintenance_schedules m ON c.id = m.customer_id 
                    WHERE m.status IN ('scheduled', 'in_progress')
                        AND c.status IN ('active', 'suspended')
                `);
            }

            // 2. Static IP customers who are offline (not isolated)
            if (hasStaticIpStatus) {
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone,
                        NULL as maintenance_status,
                        'Offline' as issue_type,
                        COALESCE(sips.last_offline_at, sips.last_check) as trouble_since,
                        'offline' as trouble_type
                    FROM customers c
                    INNER JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                    WHERE c.connection_type = 'static_ip'
                        AND sips.status = 'offline'
                        AND c.status IN ('active', 'suspended')
                        ${isolatedFilter}
                        AND sips.last_check >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                `);
            }

            // 3. PPPoE customers who are offline (from connection_logs, not isolated)
            if (hasConnectionLogs) {
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone,
                        NULL as maintenance_status,
                        'Offline' as issue_type,
                        cl_latest.timestamp as trouble_since,
                        'offline' as trouble_type
                    FROM customers c
                    INNER JOIN (
                        SELECT customer_id, MAX(timestamp) as max_timestamp
                        FROM connection_logs
                        WHERE service_type = 'pppoe'
                            AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                        GROUP BY customer_id
                    ) cl_max ON c.id = cl_max.customer_id
                    INNER JOIN connection_logs cl_latest ON c.id = cl_latest.customer_id 
                        AND cl_latest.timestamp = cl_max.max_timestamp
                        AND cl_latest.service_type = 'pppoe'
                    WHERE c.connection_type = 'pppoe'
                        AND cl_latest.status = 'offline'
                        AND c.status IN ('active', 'suspended')
                        ${isolatedFilter}
                        AND NOT EXISTS (
                            SELECT 1 FROM connection_logs cl2
                            WHERE cl2.customer_id = c.id
                                AND cl2.status = 'online'
                                AND cl2.timestamp > cl_latest.timestamp
                                AND cl2.timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                        )
                `);
            }

            if (hasSlaIncidents) {
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone,
                        NULL as maintenance_status,
                        CONCAT('SLA: ', si.incident_type) as issue_type,
                        si.start_time as trouble_since,
                        'sla_incident' as trouble_type
                    FROM customers c
                    INNER JOIN sla_incidents si ON c.id = si.customer_id
                    WHERE si.status = 'ongoing'
                        AND c.status IN ('active', 'suspended')
                `);
            }

            // 5. Customers with Open Tickets
            if (hasTickets) {
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone,
                        NULL as maintenance_status,
                        CONCAT('Ticket: ', t.subject) as issue_type,
                        t.reported_at as trouble_since,
                        'ticket' as trouble_type
                    FROM customers c
                    INNER JOIN tickets t ON c.id = t.customer_id
                    WHERE t.status = 'open'
                `);
            }

            if (queries.length === 0) {
                return [];
            }

            // Combine all queries with UNION and get unique customers (prioritize maintenance, then offline, then SLA)
            // Use GROUP BY to get only one record per customer (prioritize by trouble_type)
            const unionQuery = `
                SELECT 
                    trouble.id, trouble.name, trouble.customer_code, trouble.pppoe_username, 
                    trouble.status, trouble.connection_type,
                    trouble.odc_id, trouble.odp_id, trouble.address, trouble.phone,
                    COALESCE(
                        MAX(CASE WHEN trouble.trouble_type = 'maintenance' THEN trouble.maintenance_status END),
                        MAX(trouble.maintenance_status)
                    ) as maintenance_status,
                    COALESCE(
                        MAX(CASE WHEN trouble.trouble_type = 'maintenance' THEN trouble.issue_type END),
                        MAX(CASE WHEN trouble.trouble_type = 'offline' THEN trouble.issue_type END),
                        MAX(CASE WHEN trouble.trouble_type = 'sla_incident' THEN trouble.issue_type END),
                        MAX(CASE WHEN trouble.trouble_type = 'ticket' THEN trouble.issue_type END),
                        MAX(trouble.issue_type)
                    ) as issue_type,
                    MAX(trouble.trouble_since) as trouble_since,
                    MIN(CASE trouble.trouble_type
                        WHEN 'maintenance' THEN 1
                        WHEN 'offline' THEN 2
                        WHEN 'ticket' THEN 3
                        WHEN 'sla_incident' THEN 4
                        ELSE 5
                    END) as priority_type
                FROM (
                    ${queries.join(' UNION ALL ')}
                ) as trouble
                GROUP BY trouble.id, trouble.name, trouble.customer_code, trouble.pppoe_username, trouble.status, trouble.connection_type, trouble.odc_id, trouble.odp_id, trouble.address, trouble.phone
                ORDER BY 
                    priority_type,
                    MAX(trouble.trouble_since) DESC
                LIMIT 100
            `;

            const [rows] = await databasePool.query(unionQuery);
            return rows as any[];

        } catch (error) {
            console.error('Error fetching trouble customers in service:', error);
            return [];
        }
    }
}


export default NetworkMonitoringService;
