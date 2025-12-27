"use strict";
/**
 * Network Monitoring Controller
 * Handles HTTP requests for network monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPublicNetworkMap = exports.checkDeviceStatus = exports.autoCreateLinks = exports.syncFTTHInfrastructure = exports.syncFromCustomers = exports.syncFromGenieACS = exports.getAllDevices = exports.getNetworkTopology = void 0;
const NetworkMonitoringService_1 = require("../../services/monitoring/NetworkMonitoringService");
/**
 * Get network topology data (for map view)
 */
const getNetworkTopology = async (req, res) => {
    try {
        const topology = await NetworkMonitoringService_1.NetworkMonitoringService.getNetworkTopology();
        res.json({
            success: true,
            data: topology
        });
    }
    catch (error) {
        console.error('Error getting network topology:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get network topology'
        });
    }
};
exports.getNetworkTopology = getNetworkTopology;
/**
 * Get all devices
 */
const getAllDevices = async (req, res) => {
    try {
        const devices = await NetworkMonitoringService_1.NetworkMonitoringService.getAllDevices();
        res.json({
            success: true,
            data: devices
        });
    }
    catch (error) {
        console.error('Error getting devices:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get devices'
        });
    }
};
exports.getAllDevices = getAllDevices;
/**
 * Sync devices from GenieACS
 */
const syncFromGenieACS = async (req, res) => {
    try {
        const result = await NetworkMonitoringService_1.NetworkMonitoringService.syncDevicesFromGenieACS();
        res.json({
            success: true,
            message: `Synced ${result.added} new devices, updated ${result.updated} existing devices`,
            data: result
        });
    }
    catch (error) {
        console.error('Error syncing from GenieACS:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync from GenieACS'
        });
    }
};
exports.syncFromGenieACS = syncFromGenieACS;
/**
 * Sync devices from customers
 */
const syncFromCustomers = async (req, res) => {
    try {
        const result = await NetworkMonitoringService_1.NetworkMonitoringService.syncCustomerDevices();
        res.json({
            success: true,
            message: `Synced ${result.added} new devices, updated ${result.updated} existing devices`,
            data: result
        });
    }
    catch (error) {
        console.error('Error syncing from customers:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync from customers'
        });
    }
};
exports.syncFromCustomers = syncFromCustomers;
/**
 * Sync FTTH infrastructure
 */
const syncFTTHInfrastructure = async (req, res) => {
    try {
        const result = await NetworkMonitoringService_1.NetworkMonitoringService.syncFTTHInfrastructure();
        res.json({
            success: true,
            message: `Synced ${result.added} new devices, updated ${result.updated} existing devices`,
            data: result
        });
    }
    catch (error) {
        console.error('Error syncing FTTH infrastructure:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync FTTH infrastructure'
        });
    }
};
exports.syncFTTHInfrastructure = syncFTTHInfrastructure;
/**
 * Auto-create network links
 */
const autoCreateLinks = async (req, res) => {
    try {
        const created = await NetworkMonitoringService_1.NetworkMonitoringService.autoCreateLinks();
        res.json({
            success: true,
            message: `Created ${created} network links`,
            data: { created }
        });
    }
    catch (error) {
        console.error('Error auto-creating links:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to auto-create links'
        });
    }
};
exports.autoCreateLinks = autoCreateLinks;
/**
 * Check device status
 */
const checkDeviceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = parseInt(id);
        if (isNaN(deviceId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid device ID'
            });
        }
        const status = await NetworkMonitoringService_1.NetworkMonitoringService.checkDeviceStatus(deviceId);
        await NetworkMonitoringService_1.NetworkMonitoringService.updateDeviceStatus(deviceId, status);
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
        console.error('Error checking device status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check device status'
        });
    }
};
exports.checkDeviceStatus = checkDeviceStatus;
/**
 * Render public network map page (no login required)
 */
const renderPublicNetworkMap = async (req, res) => {
    try {
        res.render('monitoring/public-network-map', {
            title: 'Network Monitoring',
            layout: false // No layout, standalone page
        });
    }
    catch (error) {
        console.error('Error rendering network map:', error);
        res.status(500).send('Error loading network map');
    }
};
exports.renderPublicNetworkMap = renderPublicNetworkMap;
//# sourceMappingURL=networkMonitoringController.js.map