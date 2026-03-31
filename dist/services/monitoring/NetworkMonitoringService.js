"use strict";
/**
 * Network Monitoring Service
 * Core service for network device monitoring
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
exports.NetworkMonitoringService = void 0;
const pool_1 = require("../../db/pool");
const GenieacsService_1 = require("../genieacs/GenieacsService");
const child_process_1 = require("child_process");
const util_1 = require("util");
const pppoeService_1 = require("../pppoeService");
const mikrotikService_1 = require("../mikrotikService");
const CustomerNotificationService_1 = __importDefault(require("./CustomerNotificationService"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class NetworkMonitoringService {
    /**
     * Initialize service
     */
    static async initialize() {
        this.genieacsService = GenieacsService_1.GenieacsService.getInstance();
    }
    /**
     * Sync devices from GenieACS
     */
    static async syncDevicesFromGenieACS() {
        let added = 0;
        let updated = 0;
        try {
            const devices = await this.genieacsService.getDevices(1000);
            console.log(`📡 Syncing ${devices.length} devices from GenieACS...`);
            for (const device of devices) {
                const deviceInfo = this.genieacsService.extractDeviceInfo(device);
                // Check if device already exists
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_devices WHERE genieacs_id = ? LIMIT 1', [device._id]);
                const deviceData = {
                    device_type: 'ont',
                    name: `${deviceInfo.manufacturer} ${deviceInfo.model} - ${deviceInfo.serialNumber}`,
                    genieacs_id: device._id,
                    genieacs_serial: deviceInfo.serialNumber,
                    status: deviceInfo.isOnline ? 'online' : 'offline',
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
                    await pool_1.databasePool.query(`UPDATE network_devices 
                         SET name = ?, status = ?, last_seen = ?, color = ?, metadata = ?, updated_at = NOW()
                         WHERE genieacs_id = ?`, [deviceData.name, deviceData.status, deviceData.last_seen, deviceData.color, deviceData.metadata, device._id]);
                    updated++;
                }
                else {
                    // Insert new device
                    await pool_1.databasePool.query(`INSERT INTO network_devices 
                         (device_type, name, genieacs_id, genieacs_serial, status, last_seen, icon, color, metadata)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [deviceData.device_type, deviceData.name, deviceData.genieacs_id, deviceData.genieacs_serial,
                        deviceData.status, deviceData.last_seen, deviceData.icon, deviceData.color, deviceData.metadata]);
                    added++;
                }
            }
            console.log(`✅ GenieACS sync complete: ${added} added, ${updated} updated`);
            return { added, updated };
        }
        catch (error) {
            console.error('❌ Error syncing from GenieACS:', error);
            throw error;
        }
    }
    /**
     * Sync devices from customers table
     */
    static async syncCustomerDevices() {
        let added = 0;
        let updated = 0;
        try {
            const [customers] = await pool_1.databasePool.query(`SELECT c.id, c.name, c.customer_code, c.connection_type, c.status, 
                        c.latitude, c.longitude, c.address, c.pppoe_username, c.odc_id, c.odp_id,
                        c.ignore_monitoring_start, c.ignore_monitoring_end,
                        sic.ip_address as static_ip_address
                 FROM customers c
                 LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
                 WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`);
            console.log(`👥 Syncing ${customers.length} customers with coordinates...`);
            for (const customer of customers) {
                // Check if device already exists
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_devices WHERE customer_id = ? LIMIT 1', [customer.id]);
                const ipAddress = customer.connection_type === 'static_ip'
                    ? customer.static_ip_address
                    : null;
                const deviceData = {
                    device_type: 'customer',
                    name: `${customer.name} (${customer.customer_code})`,
                    ip_address: ipAddress,
                    customer_id: customer.id,
                    odc_id: customer.odc_id,
                    odp_id: customer.odp_id,
                    latitude: customer.latitude,
                    longitude: customer.longitude,
                    address: customer.address,
                    status: customer.status === 'active' ? 'online' : 'offline',
                    icon: 'customer',
                    color: customer.status === 'active' ? '#3B82F6' : '#9CA3AF',
                    metadata: JSON.stringify({
                        connection_type: customer.connection_type,
                        pppoe_username: customer.pppoe_username,
                        ignore_start: customer.ignore_monitoring_start,
                        ignore_end: customer.ignore_monitoring_end
                    })
                };
                if (existing.length > 0) {
                    // Update existing device
                    await pool_1.databasePool.query(`UPDATE network_devices 
                         SET name = ?, ip_address = ?, latitude = ?, longitude = ?, address = ?, 
                             status = ?, color = ?, metadata = ?, updated_at = NOW()
                         WHERE customer_id = ?`, [deviceData.name, deviceData.ip_address, deviceData.latitude, deviceData.longitude,
                        deviceData.address, deviceData.status, deviceData.color, deviceData.metadata, customer.id]);
                    updated++;
                }
                else {
                    // Insert new device
                    await pool_1.databasePool.query(`INSERT INTO network_devices 
                         (device_type, name, ip_address, customer_id, odc_id, odp_id, latitude, longitude, 
                          address, status, icon, color, metadata)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [deviceData.device_type, deviceData.name, deviceData.ip_address, deviceData.customer_id,
                        deviceData.odc_id, deviceData.odp_id, deviceData.latitude, deviceData.longitude,
                        deviceData.address, deviceData.status, deviceData.icon, deviceData.color, deviceData.metadata]);
                    added++;
                }
            }
            console.log(`✅ Customer sync complete: ${added} added, ${updated} updated`);
            // Cleanup orphaned customers (those that were deleted or lost coordinates)
            if (customers.length > 0) {
                const customerIds = customers.map(c => c.id).join(',');
                const [result] = await pool_1.databasePool.query(`DELETE FROM network_devices 
                     WHERE device_type = 'customer' 
                     AND (customer_id NOT IN (${customerIds}) OR customer_id IS NULL)`);
                if (result.affectedRows > 0) {
                    console.log(`🧹 Cleaned up ${result.affectedRows} orphaned customer devices`);
                }
            }
            else {
                // If no customers found, delete all customer devices? 
                // Careful, maybe query failed. But if we are here, query succeeded.
                // await databasePool.query("DELETE FROM network_devices WHERE device_type = 'customer'");
            }
            return { added, updated };
        }
        catch (error) {
            console.error('❌ Error syncing customers:', error);
            throw error;
        }
    }
    /**
     * Sync FTTH infrastructure (OLT, ODC, ODP)
     */
    static async syncFTTHInfrastructure() {
        let added = 0;
        let updated = 0;
        try {
            // Sync OLTs
            const [olts] = await pool_1.databasePool.query('SELECT id, name, latitude, longitude, location FROM ftth_olt');
            for (const olt of olts) {
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_devices WHERE olt_id = ? AND device_type = "olt" LIMIT 1', [olt.id]);
                if (existing.length > 0) {
                    await pool_1.databasePool.query(`UPDATE network_devices 
                         SET name = ?, latitude = ?, longitude = ?, address = ?, updated_at = NOW()
                         WHERE olt_id = ? AND device_type = "olt"`, [olt.name, olt.latitude, olt.longitude, olt.location, olt.id]);
                    updated++;
                }
                else {
                    await pool_1.databasePool.query(`INSERT INTO network_devices 
                         (device_type, name, olt_id, latitude, longitude, address, status, icon, color)
                         VALUES ("olt", ?, ?, ?, ?, ?, "online", "olt", "#8B5CF6")`, [olt.name, olt.id, olt.latitude, olt.longitude, olt.location]);
                    added++;
                }
            }
            // Sync ODCs
            const [odcs] = await pool_1.databasePool.query('SELECT id, name, olt_id, latitude, longitude, location FROM ftth_odc');
            for (const odc of odcs) {
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_devices WHERE odc_id = ? AND device_type = "odc" LIMIT 1', [odc.id]);
                if (existing.length > 0) {
                    await pool_1.databasePool.query(`UPDATE network_devices 
                         SET name = ?, olt_id = ?, latitude = ?, longitude = ?, address = ?, updated_at = NOW()
                         WHERE odc_id = ? AND device_type = "odc"`, [odc.name, odc.olt_id, odc.latitude, odc.longitude, odc.location, odc.id]);
                    updated++;
                }
                else {
                    await pool_1.databasePool.query(`INSERT INTO network_devices 
                         (device_type, name, odc_id, olt_id, latitude, longitude, address, status, icon, color)
                         VALUES ("odc", ?, ?, ?, ?, ?, ?, "online", "odc", "#F59E0B")`, [odc.name, odc.id, odc.olt_id, odc.latitude, odc.longitude, odc.location]);
                    added++;
                }
            }
            // Sync ODPs
            const [odps] = await pool_1.databasePool.query('SELECT id, name, odc_id, latitude, longitude, location FROM ftth_odp');
            for (const odp of odps) {
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_devices WHERE odp_id = ? AND device_type = "odp" LIMIT 1', [odp.id]);
                if (existing.length > 0) {
                    await pool_1.databasePool.query(`UPDATE network_devices 
                         SET name = ?, odc_id = ?, latitude = ?, longitude = ?, address = ?, updated_at = NOW()
                         WHERE odp_id = ? AND device_type = "odp"`, [odp.name, odp.odc_id, odp.latitude, odp.longitude, odp.location, odp.id]);
                    updated++;
                }
                else {
                    await pool_1.databasePool.query(`INSERT INTO network_devices 
                         (device_type, name, odp_id, odc_id, latitude, longitude, address, status, icon, color)
                         VALUES ("odp", ?, ?, ?, ?, ?, ?, "online", "odp", "#EC4899")`, [odp.name, odp.id, odp.odc_id, odp.latitude, odp.longitude, odp.location]);
                    added++;
                }
            }
            console.log(`✅ FTTH infrastructure sync complete: ${added} added, ${updated} updated`);
            // Cleanup orphaned OLTs
            if (olts.length > 0) {
                const ids = olts.map(o => o.id).join(',');
                await pool_1.databasePool.query(`DELETE FROM network_devices WHERE device_type = 'olt' AND olt_id NOT IN (${ids})`);
            }
            // Cleanup orphaned ODCs
            if (odcs.length > 0) {
                const ids = odcs.map(o => o.id).join(',');
                await pool_1.databasePool.query(`DELETE FROM network_devices WHERE device_type = 'odc' AND odc_id NOT IN (${ids})`);
            }
            // Cleanup orphaned ODPs
            if (odps.length > 0) {
                const ids = odps.map(o => o.id).join(',');
                await pool_1.databasePool.query(`DELETE FROM network_devices WHERE device_type = 'odp' AND odp_id NOT IN (${ids})`);
            }
            return { added, updated };
        }
        catch (error) {
            console.error('❌ Error syncing FTTH infrastructure:', error);
            throw error;
        }
    }
    /**
     * Check device status via ping
     */
    static async checkDeviceStatus(deviceId) {
        try {
            const [devices] = await pool_1.databasePool.query('SELECT ip_address FROM network_devices WHERE id = ? LIMIT 1', [deviceId]);
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
            let status = 'online';
            if (packet_loss_percent === 100) {
                status = 'offline';
            }
            else if (packet_loss_percent && packet_loss_percent > 5) {
                status = 'warning';
            }
            else if (latency_ms && latency_ms > 100) {
                status = 'warning';
            }
            return {
                status,
                latency_ms: latency_ms || undefined,
                packet_loss_percent: packet_loss_percent || undefined
            };
        }
        catch (error) {
            return {
                status: 'offline',
                error_message: error instanceof Error ? error.message : 'Ping failed'
            };
        }
    }
    /**
     * Get all devices with current status
     */
    static async getAllDevices() {
        const [devices] = await pool_1.databasePool.query('SELECT * FROM network_devices ORDER BY device_type, name');
        return devices.map(device => {
            let metadata = null;
            if (device.metadata) {
                if (typeof device.metadata === 'string') {
                    try {
                        metadata = JSON.parse(device.metadata);
                    }
                    catch (e) {
                        console.error('Error parsing device metadata:', e);
                        metadata = null;
                    }
                }
                else {
                    metadata = device.metadata;
                }
            }
            return {
                ...device,
                latitude: device.latitude ? parseFloat(device.latitude) : null,
                longitude: device.longitude ? parseFloat(device.longitude) : null,
                metadata
            };
        });
    }
    /**
     * Get network topology data
     */
    static async getNetworkTopology() {
        let devices = await this.getAllDevices();
        // Inject ODC Port Info
        try {
            const [odcDetails] = await pool_1.databasePool.query(`
                SELECT 
                    o.id, 
                    o.total_ports,
                    (SELECT COUNT(*) FROM ftth_odp WHERE odc_id = o.id) as used_ports 
                FROM ftth_odc o
            `);
            // Creates a map for faster lookup: odc_id -> { total_ports, used_ports }
            const odcPortMap = new Map();
            odcDetails.forEach(odc => {
                odcPortMap.set(odc.id, { total: odc.total_ports, used: odc.used_ports });
            });
            // Inject ODP Port Info
            const [odpDetails] = await pool_1.databasePool.query(`
                SELECT 
                    id, 
                    total_ports, 
                    used_ports 
                FROM ftth_odp
            `);
            const odpPortMap = new Map();
            odpDetails.forEach(odp => {
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
        }
        catch (e) {
            console.error('Error injecting ODC/ODP port info:', e);
        }
        // Inject Live PPPoE Status
        try {
            // Dynamic import to avoid circular dependencies if any
            const { getMikrotikConfig } = await Promise.resolve().then(() => __importStar(require('../pppoeService')));
            const { getPppoeActiveConnections } = await Promise.resolve().then(() => __importStar(require('../mikrotikService')));
            const config = await getMikrotikConfig();
            console.log(`[NetworkMonitoring] 🔌 MikroTik Config: ${config ? 'FOUND' : 'NOT FOUND'}`);
            if (config) {
                const activeSessions = await getPppoeActiveConnections(config);
                const activeUsernames = new Set(activeSessions.map(s => s.name));
                const sessionMap = new Map(activeSessions.map(s => [s.name, s]));
                console.log(`[NetworkMonitoring] 📡 Active PPPoE Sessions: ${activeSessions.length}`);
                console.log(`[NetworkMonitoring] 👥 Active usernames: ${Array.from(activeUsernames).slice(0, 10).join(', ')}${activeUsernames.size > 10 ? '...' : ''}`);
                let onlineCount = 0;
                let offlineCount = 0;
                let noUsernameCount = 0;
                devices = devices.map(device => {
                    if (device.device_type === 'customer') {
                        const metadata = device.metadata || {};
                        const username = metadata.pppoe_username;
                        if (username) {
                            const isOnline = activeUsernames.has(username);
                            // If isOnline is true, set status to online. 
                            // If false, set to offline (override DB status which might be 'active' but offline)
                            const newStatus = isOnline ? 'online' : 'offline';
                            // Debug: Log which customer gets which status
                            console.log(`[NetworkMonitoring] 🔍 Customer "${device.name}" (${username}) → ${newStatus.toUpperCase()}`);
                            if (isOnline)
                                onlineCount++;
                            else
                                offlineCount++;
                            // Optional: Inject session details
                            const session = sessionMap.get(username);
                            return {
                                ...device,
                                status: newStatus,
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
                        else {
                            // No PPPoE username set - cannot track live status
                            noUsernameCount++;
                            // Keep original status from database (don't assume offline as could be static IP)
                        }
                    }
                    return device;
                });
                console.log(`[NetworkMonitoring] ✅ PPPoE Status Updated: ${onlineCount} online, ${offlineCount} offline, ${noUsernameCount} without username`);
            }
            else {
                console.warn('[NetworkMonitoring] ⚠️ No MikroTik config found - cannot check live PPPoE status!');
            }
        }
        catch (e) {
            console.error('[NetworkMonitoring] ❌ Error injecting live PPPoE status:', e);
        }
        // Inject GenieACS Signal Data into Customer Devices (Robust Matching)
        try {
            // Create maps for ONT metadata matching
            const ontByIp = new Map();
            const ontBySerial = new Map();
            devices.forEach(d => {
                if (d.device_type === 'ont' && d.metadata) {
                    if (d.ip_address && d.ip_address !== '-')
                        ontByIp.set(d.ip_address, d.metadata);
                    if (d.metadata.ip_address && d.metadata.ip_address !== '-')
                        ontByIp.set(d.metadata.ip_address, d.metadata);
                    if (d.genieacs_serial)
                        ontBySerial.set(d.genieacs_serial, d.metadata);
                }
            });
            // Fetch customer serial numbers for matching
            const [custLinks] = await pool_1.databasePool.query('SELECT id, serial_number FROM customers WHERE serial_number IS NOT NULL');
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
                        if (ip && ip !== '-')
                            ontData = ontByIp.get(ip);
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
        }
        catch (e) {
            console.error('Error injecting GenieACS data into topology:', e);
        }
        // Auto-sync checks:
        // 1. Check if we display any customers.
        const [customerCountResult] = await pool_1.databasePool.query("SELECT COUNT(*) as count FROM network_devices WHERE device_type = 'customer'");
        const existingCustomerCount = customerCountResult[0]?.count || 0;
        // Check source customers count (with coordinates)
        const [potentialCustomers] = await pool_1.databasePool.query("SELECT COUNT(*) as count FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL");
        const potentialCount = potentialCustomers[0]?.count || 0;
        // If mismatch, rely on sync
        // Always trigger sync to ensure consistency (Fix for: Add 1 / Delete 1 count match issue)
        await this.syncCustomerDevices();
        // Re-fetch devices after sync logic
        devices = await this.getAllDevices();
        // 2. Check FTTH infrastructure (OLT, ODC, ODP).
        const [ftthCountResult] = await pool_1.databasePool.query("SELECT COUNT(*) as count FROM network_devices WHERE device_type IN ('olt', 'odc', 'odp')");
        const existingFtthCount = ftthCountResult[0]?.count || 0;
        // Check source table counts
        const [potentialOlt] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM ftth_olt`);
        const [potentialOdc] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM ftth_odc`);
        const [potentialOdp] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM ftth_odp`);
        const oltCount = potentialOlt[0]?.count || 0;
        const odcCount = potentialOdc[0]?.count || 0;
        const odpCount = potentialOdp[0]?.count || 0;
        const potentialFtthCount = oltCount + odcCount + odpCount;
        // Always trigger sync for FTTH infrastructure
        await this.syncFTTHInfrastructure();
        // Re-fetch devices after sync
        devices = await this.getAllDevices();
        const [links] = await pool_1.databasePool.query('SELECT * FROM network_links');
        // 3. Check if we have links. If 0 but we have devices, auto-create them!
        if (links.length === 0 && devices.length > 0) {
            console.log('🔗 Topology request detected missing network links. Triggering auto-create...');
            await this.autoCreateLinks();
            // Re-fetch links after creation
            const [newLinks] = await pool_1.databasePool.query('SELECT * FROM network_links');
            // Calculate statistics
            const [stats] = await pool_1.databasePool.query(`SELECT 
                    COUNT(*) as total_devices,
                    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_devices,
                    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_devices,
                    SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_devices
                 FROM network_devices`);
            return {
                devices,
                links: newLinks,
                statistics: stats[0]
            };
        }
        const [stats] = await pool_1.databasePool.query(`SELECT 
                COUNT(*) as total_devices,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_devices,
                SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_devices,
                SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_devices
             FROM network_devices`);
        // FINAL: Re-inject Live PPPoE Status (after all syncs to ensure correct status)
        try {
            const { getMikrotikConfig } = await Promise.resolve().then(() => __importStar(require('../pppoeService')));
            const { getPppoeActiveConnections } = await Promise.resolve().then(() => __importStar(require('../mikrotikService')));
            const config = await getMikrotikConfig();
            if (config) {
                const activeSessions = await getPppoeActiveConnections(config);
                const activeUsernames = new Set(activeSessions.map(s => s.name));
                const sessionMap = new Map(activeSessions.map(s => [s.name, s]));
                devices = devices.map(device => {
                    if (device.device_type === 'customer') {
                        const metadata = device.metadata || {};
                        const username = metadata.pppoe_username;
                        // Check Ignore Schedule (Warung Logic)
                        let isIgnored = false;
                        if (metadata.ignore_start && metadata.ignore_end) {
                            const now = new Date();
                            // If timezone is crucial, ensure server time is WIB (UTC+7) or use offset
                            // Assuming server local time is correct for now (User said Windows OS presumably local)
                            const [sH, sM] = metadata.ignore_start.split(':').map(Number);
                            const [eH, eM] = metadata.ignore_end.split(':').map(Number);
                            const currentMins = now.getHours() * 60 + now.getMinutes();
                            const startMins = sH * 60 + sM;
                            const endMins = eH * 60 + eM;
                            if (startMins < endMins) {
                                isIgnored = currentMins >= startMins && currentMins <= endMins;
                            }
                            else {
                                isIgnored = currentMins >= startMins || currentMins <= endMins;
                            }
                        }
                        if (username) {
                            const isOnline = activeUsernames.has(username);
                            // If IGNORED and OFFLINE, treat as "intentional_offline" (status offline but flag set)
                            // OR maybe treat as online/unknown?
                            // User wants it to NOT notify.
                            const newStatus = isOnline ? 'online' : 'offline';
                            const session = sessionMap.get(username);
                            return {
                                ...device,
                                status: newStatus,
                                metadata: {
                                    ...metadata,
                                    is_ignored: isIgnored, // Flag for frontend
                                    session_info: session ? {
                                        uptime: session.uptime,
                                        address: session.address,
                                        mac: session['caller-id']
                                    } : null
                                }
                            };
                        }
                        else {
                            // Static IP or non-PPPoE also check schedule
                            return {
                                ...device,
                                metadata: {
                                    ...metadata,
                                    is_ignored: isIgnored
                                }
                            };
                        }
                    }
                    return device;
                });
            }
        }
        catch (e) {
            console.error('[NetworkMonitoring] ❌ Error in final PPPoE status injection:', e);
        }
        // Recalculate statistics based on actual device status in memory
        const finalStats = {
            total_devices: devices.length,
            online_devices: devices.filter(d => d.status === 'online').length,
            offline_devices: devices.filter(d => d.status === 'offline').length,
            warning_devices: devices.filter(d => d.status === 'warning').length
        };
        return {
            devices,
            links: links,
            statistics: finalStats
        };
    }
    /**
     * Get network topology data (fast version - no sync operations)
     */
    static async getNetworkTopologyFast() {
        try {
            let devices = await this.getAllDevices();
            // Get links
            const [links] = await pool_1.databasePool.query('SELECT * FROM network_links ORDER BY id');
            // Calculate basic statistics
            const stats = {
                total_devices: devices.length,
                online_devices: devices.filter(d => d.status === 'online').length,
                offline_devices: devices.filter(d => d.status === 'offline').length,
                warning_devices: devices.filter(d => d.status === 'warning').length
            };
            return {
                devices,
                links: links,
                statistics: stats
            };
        }
        catch (error) {
            console.error('Error in getNetworkTopologyFast:', error);
            throw error;
        }
    }
    /**
     * Update device status
     */
    static async updateDeviceStatus(deviceId, statusData) {
        await pool_1.databasePool.query(`UPDATE network_devices 
             SET status = ?, latency_ms = ?, packet_loss_percent = ?, last_check = NOW(), updated_at = NOW()
             WHERE id = ?`, [statusData.status, statusData.latency_ms, statusData.packet_loss_percent, deviceId]);
        if (statusData.status === 'online') {
            await pool_1.databasePool.query('UPDATE network_devices SET last_seen = NOW() WHERE id = ?', [deviceId]);
        }
    }
    /**
     * Auto-create network links based on topology
     */
    static async autoCreateLinks() {
        let created = 0;
        try {
            // Link customers to their ODPs
            const [customerOdpLinks] = await pool_1.databasePool.query(`SELECT c.id as customer_id, o.id as odp_id
                 FROM network_devices c
                 JOIN network_devices o ON c.odp_id = o.odp_id AND o.device_type = 'odp'
                 WHERE c.device_type = 'customer' AND c.odp_id IS NOT NULL`);
            for (const link of customerOdpLinks) {
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_links WHERE source_device_id = ? AND target_device_id = ? LIMIT 1', [link.customer_id, link.odp_id]);
                if (existing.length === 0) {
                    await pool_1.databasePool.query(`INSERT INTO network_links (source_device_id, target_device_id, link_type, status)
                         VALUES (?, ?, 'fiber', 'up')`, [link.customer_id, link.odp_id]);
                    created++;
                }
            }
            // Link ODPs to ODCs
            const [odpOdcLinks] = await pool_1.databasePool.query(`SELECT odp.id as odp_id, odc.id as odc_id
                 FROM network_devices odp
                 JOIN network_devices odc ON odp.odc_id = odc.odc_id AND odc.device_type = 'odc'
                 WHERE odp.device_type = 'odp' AND odp.odc_id IS NOT NULL`);
            for (const link of odpOdcLinks) {
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_links WHERE source_device_id = ? AND target_device_id = ? LIMIT 1', [link.odp_id, link.odc_id]);
                if (existing.length === 0) {
                    await pool_1.databasePool.query(`INSERT INTO network_links (source_device_id, target_device_id, link_type, status)
                         VALUES (?, ?, 'fiber', 'up')`, [link.odp_id, link.odc_id]);
                    created++;
                }
            }
            // Link ODCs to OLTs
            const [odcOltLinks] = await pool_1.databasePool.query(`SELECT odc.id as odc_id, olt.id as olt_id
                 FROM network_devices odc
                 JOIN network_devices olt ON odc.olt_id = olt.olt_id AND olt.device_type = 'olt'
                 WHERE odc.device_type = 'odc' AND odc.olt_id IS NOT NULL`);
            for (const link of odcOltLinks) {
                const [existing] = await pool_1.databasePool.query('SELECT id FROM network_links WHERE source_device_id = ? AND target_device_id = ? LIMIT 1', [link.odc_id, link.olt_id]);
                if (existing.length === 0) {
                    await pool_1.databasePool.query(`INSERT INTO network_links (source_device_id, target_device_id, link_type, status)
                         VALUES (?, ?, 'fiber', 'up')`, [link.odc_id, link.olt_id]);
                    created++;
                }
            }
            console.log(`✅ Auto-created ${created} network links`);
            return created;
        }
        catch (error) {
            console.error('❌ Error auto-creating links:', error);
            throw error;
        }
    }
    /**
     * Handle device down event - check for mass outage and notify
     */
    static async handleDeviceDown(deviceId, deviceType, deviceName) {
        if (!['olt', 'odc'].includes(deviceType)) {
            return; // Only care about infrastructure for mass notification
        }
        console.log(`🚨 Handling mass outage for ${deviceType.toUpperCase()} ${deviceName} (ID: ${deviceId})`);
        try {
            let affectedCustomers = [];
            if (deviceType === 'olt') {
                // Find all customers under this OLT
                // Join network_devices to get customer_id, then join customers to get phone
                const [customers] = await pool_1.databasePool.query(`SELECT c.name, c.phone 
                     FROM network_devices nd
                     JOIN network_devices olt_target ON nd.olt_id = olt_target.olt_id
                     JOIN customers c ON nd.customer_id = c.id
                     WHERE olt_target.id = ? 
                     AND nd.device_type = 'customer'
                     AND c.phone IS NOT NULL`, [deviceId]);
                affectedCustomers = customers;
            }
            else if (deviceType === 'odc') {
                // Find all customers under this ODC
                const [customers] = await pool_1.databasePool.query(`SELECT c.name, c.phone 
                     FROM network_devices nd
                     JOIN network_devices odc_target ON nd.odc_id = odc_target.odc_id
                     JOIN customers c ON nd.customer_id = c.id
                     WHERE odc_target.id = ? 
                     AND nd.device_type = 'customer'
                     AND c.phone IS NOT NULL`, [deviceId]);
                affectedCustomers = customers;
            }
            if (affectedCustomers.length === 0) {
                console.log(`  ℹ️ No affected customers found with phone numbers.`);
                return;
            }
            console.log(`  📢 Mass outage notification to ${affectedCustomers.length} customers SKIPPED (Service Disabled).`);
            /*
            let sentCount = 0;
            for (const customer of affectedCustomers) {
                try {
                    await waClient.sendMessage(customer.phone, message);
                    sentCount++;
                } catch (err) {
                    console.error(`  ❌ Failed to send to ${customer.name}:`, err);
                }
            }

            console.log(`  ✅ Notification sent to ${sentCount}/${affectedCustomers.length} customers.`);
            */
            // ============================================
            // Auto-create Technician Job
            // ============================================
            const [existingJobs] = await pool_1.databasePool.query(`SELECT id FROM technician_jobs 
                 WHERE title LIKE ? AND status IN ('pending', 'in_progress', 'accepted') 
                 AND created_at > DATE_SUB(NOW(), INTERVAL 12 HOUR)
                 LIMIT 1`, [`%${deviceName} Down%`]);
            if (existingJobs.length === 0) {
                console.log(`  🛠️ Creating technician job for device failure: ${deviceName}`);
                let coordinates = null;
                let description = `Perangkat ${deviceType.toUpperCase()} ${deviceName} terdeteksi down. Indikasi gangguan massal pada ${affectedCustomers.length} pelanggan.`;
                // Attempt to get coordinates
                const [deviceInfo] = await pool_1.databasePool.query(`SELECT latitude, longitude, address FROM network_devices WHERE id = ?`, [deviceId]);
                if (deviceInfo.length > 0) {
                    const d = deviceInfo[0];
                    if (d.latitude && d.longitude) {
                        coordinates = `${d.latitude}, ${d.longitude}`;
                    }
                    if (d.address) {
                        description += `\nAlamat: ${d.address}`;
                    }
                }
                // Dynamic import to avoid circular dependency
                const { TechnicianController } = await Promise.resolve().then(() => __importStar(require('../../controllers/technician/TechnicianController')));
                await TechnicianController.createJob({
                    title: `URGENT: ${deviceType.toUpperCase()} ${deviceName} Down`,
                    description: description,
                    priority: 'critical',
                    coordinates: coordinates || undefined,
                    reported_by: 'system_monitor'
                });
            }
            else {
                console.log(`  ℹ️ Technician job for ${deviceName} already exists.`);
            }
        }
        catch (error) {
            console.error('❌ Error handling mass outage:', error);
        }
    }
    /**
     * Enhanced trouble customer detection with notifications
     * Tracks offline, timeout, error, and recovery events
     */
    static async getTroubleCustomers(notify = false) {
        const notificationService = CustomerNotificationService_1.default;
        try {
            // Check which tables exist
            const [tables] = await pool_1.databasePool.query("SHOW TABLES");
            const tableNames = Array.isArray(tables) ? tables.map((t) => Object.values(t)[0]) : [];
            const hasMaintenance = tableNames.includes('maintenance_schedules');
            const hasConnectionLogs = tableNames.includes('connection_logs');
            const hasStaticIpStatus = tableNames.includes('static_ip_ping_status');
            const hasSlaIncidents = tableNames.includes('sla_incidents');
            const hasTickets = tableNames.includes('tickets');
            // Check if is_isolated column exists in customers table
            let hasIsolated = false;
            try {
                const [cols] = await pool_1.databasePool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_isolated'");
                hasIsolated = Array.isArray(cols) && cols.length > 0;
            }
            catch {
                hasIsolated = false;
            }
            // Check if issue_type column exists in maintenance_schedules
            let hasIssueType = false;
            if (hasMaintenance) {
                try {
                    const [cols] = await pool_1.databasePool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_schedules' AND COLUMN_NAME = 'issue_type'");
                    hasIssueType = Array.isArray(cols) && cols.length > 0;
                }
                catch {
                    hasIssueType = false;
                }
            }
            // Build UNION query for all trouble sources
            const queries = [];
            const isolatedFilter = hasIsolated ? 'AND (c.is_isolated = 0 OR c.is_isolated IS NULL)' : '';
            // 1. Customers with maintenance schedules
            if (hasMaintenance) {
                const issueTypeColumn = hasIssueType ? "COALESCE(m.issue_type, 'Maintenance')" : "'Maintenance'";
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone, c.serial_number,
                        m.status as maintenance_status, 
                        ${issueTypeColumn} as issue_type, 
                        m.created_at as trouble_since,
                        'maintenance' as trouble_type
                    FROM customers c
                    INNER JOIN maintenance_schedules m ON c.id = m.customer_id 
                    WHERE m.status IN ('scheduled', 'in_progress')
                        AND c.status = 'active'
                        ${isolatedFilter}
                `);
            }
            // 2. Static IP customers who are offline (not isolated)
            if (hasStaticIpStatus) {
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone, c.serial_number,
                        NULL as maintenance_status,
                        'Offline' as issue_type,
                        COALESCE(sips.last_offline_at, sips.last_check) as trouble_since,
                        'offline' as trouble_type
                    FROM customers c
                    INNER JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                    WHERE c.connection_type = 'static_ip'
                        AND sips.status = 'offline'
                        AND c.status = 'active'
                        ${isolatedFilter}
                        AND sips.last_check >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                `);
            }
            // 3. PPPoE customers who are offline (from connection_logs, not isolated)
            if (hasConnectionLogs) {
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone, c.serial_number,
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
                        AND c.status = 'active'
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
                        c.odc_id, c.odp_id, c.address, c.phone, c.serial_number,
                        NULL as maintenance_status,
                        CONCAT('SLA: ', si.incident_type) as issue_type,
                        si.start_time as trouble_since,
                        'sla_incident' as trouble_type
                    FROM customers c
                    INNER JOIN sla_incidents si ON c.id = si.customer_id
                    WHERE si.status = 'ongoing'
                        AND c.status = 'active'
                        ${isolatedFilter}
                `);
            }
            // 5. Customers with Open Tickets
            if (hasTickets) {
                queries.push(`
                    SELECT DISTINCT
                        c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                        c.odc_id, c.odp_id, c.address, c.phone, c.serial_number,
                        NULL as maintenance_status,
                        CONCAT('Ticket: ', t.subject) as issue_type,
                        t.reported_at as trouble_since,
                        'ticket' as trouble_type
                    FROM customers c
                    INNER JOIN tickets t ON c.id = t.customer_id
                    WHERE t.status = 'open'
                        AND c.status = 'active'
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
                    trouble.odc_id, trouble.odp_id, trouble.address, trouble.phone, trouble.serial_number,
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
                    END) as priority_type,
                    trouble.trouble_type
                FROM (
                    ${queries.join(' UNION ALL ')}
                ) as trouble
                GROUP BY trouble.id, trouble.name, trouble.customer_code, trouble.pppoe_username, trouble.status, trouble.connection_type, trouble.odc_id, trouble.odp_id, trouble.address, trouble.phone, trouble.serial_number, trouble.trouble_type
                ORDER BY 
                    priority_type,
                    MAX(trouble.trouble_since) DESC
                LIMIT 100
            `;
            const [rows] = await pool_1.databasePool.query(unionQuery);
            // ---- Real-time Mikrotik status injection & Realtime Offline Detection ----
            try {
                const mikrotikConfig = await (0, pppoeService_1.getMikrotikConfig)();
                if (mikrotikConfig) {
                    const activeSessions = await (0, mikrotikService_1.getPppoeActiveConnections)(mikrotikConfig);
                    const onlineUsernames = new Set(activeSessions.map(s => s.name));
                    // 1. Identify customers who are Active in DB but NOT online in MikroTik (Realtime Offline)
                    // We need to fetch ALL active PPPoE customers to check this, 
                    // because the UNION query above only returns customers with LOGS or MAINTENANCE.
                    const [allActivePppoe] = await pool_1.databasePool.query(`
                        SELECT c.id, c.name, c.customer_code, c.pppoe_username, c.status, c.connection_type,
                               c.odc_id, c.odp_id, c.address, c.phone, c.serial_number
                        FROM customers c
                        WHERE c.status = 'active' 
                        AND c.connection_type = 'pppoe'
                        AND c.pppoe_username IS NOT NULL 
                        AND c.pppoe_username != ''
                        ${hasIsolated ? 'AND (c.is_isolated = 0 OR c.is_isolated IS NULL)' : ''}
                    `);
                    // Helper to check if customer is already in rows
                    // Use a Set for faster lookup
                    const existingIds = new Set(rows.map(r => r.id));
                    for (const activeCust of allActivePppoe) {
                        // Use activeCust.pppoe_username to check online status
                        if (!onlineUsernames.has(activeCust.pppoe_username)) {
                            // Customer is Active in DB but NOT Online in Mikrotik -> Trouble!
                            // Only add if not already present (e.g. from maintenance or logs)
                            if (!existingIds.has(activeCust.id)) {
                                rows.push({
                                    id: activeCust.id,
                                    name: activeCust.name,
                                    customer_code: activeCust.customer_code,
                                    pppoe_username: activeCust.pppoe_username,
                                    status: activeCust.status,
                                    connection_type: activeCust.connection_type,
                                    odc_id: activeCust.odc_id,
                                    odp_id: activeCust.odp_id,
                                    address: activeCust.address,
                                    phone: activeCust.phone,
                                    serial_number: activeCust.serial_number,
                                    maintenance_status: null,
                                    issue_type: 'Offline (Realtime)',
                                    trouble_since: new Date(), // Just detected
                                    priority_type: 2, // Offline priority
                                    trouble_type: 'offline'
                                });
                            }
                        }
                    }
                    // Enhanced notification system with recovery tracking
                    if (notify) {
                        // Track customer states for recovery detection
                        const previousStates = await this.getPreviousCustomerStates();
                        for (const cust of rows) {
                            if (cust.trouble_type === 'offline') {
                                const isOnline = onlineUsernames.has(cust.pppoe_username);
                                const wasOnlinePreviously = previousStates.get(cust.id) === 'online';
                                if (!isOnline) {
                                    // ONLY send offline notification if they were previously online (Transition)
                                    if (wasOnlinePreviously) {
                                        await notificationService.sendTroubleNotification({
                                            id: cust.id,
                                            name: cust.name,
                                            customer_code: cust.customer_code,
                                            phone: cust.phone,
                                            connection_type: cust.connection_type,
                                            pppoe_username: cust.pppoe_username,
                                            ip_address: cust.ip_address,
                                            odc_id: cust.odc_id,
                                            odp_id: cust.odp_id,
                                            address: cust.address
                                        }, 'offline');
                                    }
                                }
                                else if (!wasOnlinePreviously) {
                                    // Recovery event - customer came back online
                                    await notificationService.sendTroubleNotification({
                                        id: cust.id,
                                        name: cust.name,
                                        customer_code: cust.customer_code,
                                        phone: cust.phone,
                                        connection_type: cust.connection_type,
                                        pppoe_username: cust.pppoe_username,
                                        ip_address: cust.ip_address,
                                        odc_id: cust.odc_id,
                                        odp_id: cust.odp_id,
                                        address: cust.address
                                    }, 'recovered');
                                    // Also notify admins
                                    await notificationService.broadcastCustomerStatusToAdmins({
                                        id: cust.id,
                                        name: cust.name,
                                        customer_code: cust.customer_code,
                                        phone: cust.phone || '',
                                        connection_type: cust.connection_type,
                                        pppoe_username: cust.pppoe_username,
                                        address: cust.address,
                                        odp_name: cust.odp_name
                                    }, 'online');
                                }
                            }
                        }
                        // Update customer states for next comparison
                        await this.updateCustomerStates(rows, onlineUsernames);
                    }
                }
            }
            catch (e) {
                console.error('Error fetching Mikrotik active sessions for trouble customers:', e);
            }
            // Sort rows again because we pushed new items
            rows.sort((a, b) => {
                const priorityDiff = (a.priority_type || 5) - (b.priority_type || 5);
                if (priorityDiff !== 0)
                    return priorityDiff;
                // Sort by trouble_since desc
                const dateA = a.trouble_since ? new Date(a.trouble_since).getTime() : 0;
                const dateB = b.trouble_since ? new Date(b.trouble_since).getTime() : 0;
                return dateB - dateA;
            });
            // ---- GenieACS Status Injection ----
            try {
                // Collect serial numbers of interest (offline customers only)
                const serials = rows
                    .filter(r => r.trouble_type === 'offline' && r.serial_number)
                    .map(r => r.serial_number);
                if (serials.length > 0) {
                    // Fetch device status
                    const [devices] = await pool_1.databasePool.query(`SELECT genieacs_serial, status, last_seen, metadata 
                         FROM network_devices 
                         WHERE genieacs_serial IN (?)`, [serials]);
                    // Create status map
                    const deviceMap = new Map();
                    devices.forEach(d => {
                        deviceMap.set(d.genieacs_serial, d);
                    });
                    // Inject into rows
                    rows.forEach(r => {
                        if (r.serial_number && deviceMap.has(r.serial_number)) {
                            const dev = deviceMap.get(r.serial_number);
                            r.ont_status = dev.status;
                            r.ont_last_seen = dev.last_seen;
                            // Parse metadata if string
                            try {
                                if (typeof dev.metadata === 'string') {
                                    r.ont_metadata = JSON.parse(dev.metadata);
                                }
                                else {
                                    r.ont_metadata = dev.metadata;
                                }
                            }
                            catch (e) {
                                r.ont_metadata = null;
                            }
                        }
                        else if (r.serial_number) {
                            r.ont_status = 'unknown'; // Serial exists but not found in GenieACS DB
                        }
                        else {
                            r.ont_status = null; // No serial
                        }
                    });
                }
            }
            catch (e) {
                console.error('Error fetching GenieACS status for trouble customers:', e);
            }
            return rows;
        }
        catch (error) {
            console.error('Error fetching trouble customers in service:', error);
            return [];
        }
    }
    /**
     * Get previous customer states for recovery detection
     */
    static async getPreviousCustomerStates() {
        try {
            // Create table if not exists
            await pool_1.databasePool.query(`
                CREATE TABLE IF NOT EXISTS customer_current_states (
                    customer_id INT PRIMARY KEY,
                    status VARCHAR(20),
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            const [states] = await pool_1.databasePool.query(`SELECT customer_id, status FROM customer_current_states`);
            const stateMap = new Map();
            states.forEach(state => {
                stateMap.set(state.customer_id, state.status);
            });
            return stateMap;
        }
        catch (error) {
            console.error('Error fetching previous customer states:', error);
            return new Map();
        }
    }
    /**
     * Update customer states for next comparison
     */
    static async updateCustomerStates(customers, onlineUsernames) {
        try {
            // Update states for all customers in the report
            for (const customer of customers) {
                const status = customer.pppoe_username && onlineUsernames.has(customer.pppoe_username)
                    ? 'online'
                    : 'offline';
                await pool_1.databasePool.query(`INSERT INTO customer_current_states (customer_id, status) 
                     VALUES (?, ?) 
                     ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP`, [customer.id, status]);
            }
        }
        catch (error) {
            console.error('Error updating customer states:', error);
        }
    }
    /**
     * Enhanced timeout detection for static IP customers
     */
    static async detectTimeoutIssues() {
        try {
            const notificationService = CustomerNotificationService_1.default;
            // Find customers with consecutive failures indicating timeout
            const [timeoutCustomers] = await pool_1.databasePool.query(`
                SELECT 
                    c.id, c.name, c.customer_code, c.phone, c.connection_type,
                    sips.consecutive_failures, sips.last_check, sips.response_time_ms
                FROM customers c
                INNER JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                WHERE sips.consecutive_failures >= 3
                AND c.status = 'active'
                AND c.phone IS NOT NULL
                AND c.notification_enabled = 1
            `);
            for (const customer of timeoutCustomers) {
                await notificationService.sendTroubleNotification({
                    id: customer.id,
                    name: customer.name,
                    customer_code: customer.customer_code,
                    phone: customer.phone,
                    connection_type: customer.connection_type
                }, 'timeout', {
                    consecutive_failures: customer.consecutive_failures,
                    last_check: customer.last_check,
                    response_time: customer.response_time_ms
                });
            }
        }
        catch (error) {
            console.error('Error detecting timeout issues:', error);
        }
    }
    /**
     * Detect degraded performance issues
     */
    static async detectDegradedPerformance() {
        try {
            const notificationService = CustomerNotificationService_1.default;
            // Find customers with degraded performance
            const [degradedCustomers] = await pool_1.databasePool.query(`
                SELECT 
                    c.id, c.name, c.customer_code, c.phone, c.connection_type,
                    sips.response_time_ms, sips.packet_loss_percent
                FROM customers c
                INNER JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                WHERE (sips.response_time_ms > 300 OR sips.packet_loss_percent > 10)
                AND c.status = 'active'
                AND c.phone IS NOT NULL
                AND c.notification_enabled = 1
            `);
            for (const customer of degradedCustomers) {
                /*
                await notificationService.sendTroubleNotification(
                    {
                        id: customer.id,
                        name: customer.name,
                        customer_code: customer.customer_code,
                        phone: customer.phone,
                        connection_type: customer.connection_type
                    },
                    'degraded',
                    {
                        latency: customer.response_time_ms,
                        packetLoss: customer.packet_loss_percent
                    }
                );
                */
                console.log(`[Monitoring] Degraded performance detected for ${customer.name}, but notification is disabled.`);
            }
        }
        catch (error) {
            console.error('Error detecting degraded performance:', error);
        }
    }
    /**
     * Get parent device ID based on network topology
     */
    static async getParentDeviceId(deviceId) {
        try {
            const [links] = await pool_1.databasePool.query('SELECT source_device_id FROM network_links WHERE target_device_id = ? LIMIT 1', [deviceId]);
            return links[0]?.source_device_id || null;
        }
        catch (error) {
            console.error('Error getting parent device:', error);
            return null;
        }
    }
    /**
     * Smarter device check with retries
     */
    static async checkDeviceStatusSmarter(deviceId) {
        let status = await this.checkDeviceStatus(deviceId);
        // If offline or warning, retry up to 2 times for stability
        if (status.status !== 'online') {
            console.log(`[SmartMonitoring] Suspicious status for ID ${deviceId}: ${status.status}. Retrying...`);
            for (let i = 0; i < 2; i++) {
                await new Promise(r => setTimeout(r, 2000)); // wait 2s
                const retryStatus = await this.checkDeviceStatus(deviceId);
                if (retryStatus.status === 'online') {
                    console.log(`[SmartMonitoring] ID ${deviceId} is actually ONLINE (jitter suppressed)`);
                    return retryStatus;
                }
            }
        }
        return status;
    }
    /**
     * Check for auto-outage jobs
     */
    static async checkAutoOutageJobs() {
        // Implementation for auto-detecting outages and creating jobs
        // Currently placeholder to prevent build error
    }
}
exports.NetworkMonitoringService = NetworkMonitoringService;
exports.default = NetworkMonitoringService;
//# sourceMappingURL=NetworkMonitoringService.js.map