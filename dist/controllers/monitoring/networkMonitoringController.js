"use strict";
/**
 * Network Monitoring Controller
 * Handles HTTP requests for network monitoring
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshMonitoring = exports.getNearbyCustomers = exports.getOfflineAlerts = exports.getMapCustomers = exports.renderEnhancedNetworkMap = exports.renderModernNetworkMap = exports.renderPublicNetworkMap = exports.checkDeviceStatus = exports.autoCreateLinks = exports.syncFTTHInfrastructure = exports.syncFromCustomers = exports.syncFromGenieACS = exports.getAllDevices = exports.getNetworkTopologyFast = exports.getNetworkTopology = exports.getSlaReport = void 0;
const NetworkMonitoringService_1 = require("../../services/monitoring/NetworkMonitoringService");
/**
 * Get AI-Enhanced SLA Report
 */
const getSlaReport = async (req, res) => {
    try {
        const { customerId, month, year } = req.query;
        if (!customerId || !month || !year) {
            return res.status(400).json({ success: false, error: 'Missing parameters: customerId, month, year' });
        }
        const report = { error: 'SLA Module removed' };
        res.json({ success: true, data: report });
    }
    catch (error) {
        console.error('SLA Report Error:', error);
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
exports.getSlaReport = getSlaReport;
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
 * Get network topology without heavy sync operations (faster response)
 */
const getNetworkTopologyFast = async (req, res) => {
    try {
        // Get only the basic topology data without heavy sync operations
        const topology = await NetworkMonitoringService_1.NetworkMonitoringService.getNetworkTopologyFast();
        res.json({
            success: true,
            data: topology
        });
    }
    catch (error) {
        console.error('Error getting fast network topology:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get network topology'
        });
    }
};
exports.getNetworkTopologyFast = getNetworkTopologyFast;
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
// Render classic network map
const renderPublicNetworkMap = async (req, res) => {
    try {
        res.render('monitoring/public-network-map', {
            title: 'Network Monitoring v2.4.9',
            layout: false // No layout, standalone page
        });
    }
    catch (error) {
        console.error('Error rendering network map:', error);
        res.status(500).send('Error loading network map');
    }
};
exports.renderPublicNetworkMap = renderPublicNetworkMap;
// Render modern network map
const renderModernNetworkMap = async (req, res) => {
    try {
        res.render('monitoring/modern-network-map', {
            title: 'Modern Network Monitoring Dashboard',
            layout: false // No layout, standalone page
        });
    }
    catch (error) {
        console.error('Error rendering modern network map:', error);
        res.status(500).send('Error loading modern network map');
    }
};
exports.renderModernNetworkMap = renderModernNetworkMap;
// Render enhanced network map with customer monitoring
const renderEnhancedNetworkMap = async (req, res) => {
    try {
        // Fetch initial data to speed up first load
        const { AdvancedMonitoringService } = await Promise.resolve().then(() => __importStar(require('../../services/monitoring/AdvancedMonitoringService')));
        // Force refresh cache to get latest data
        const mapData = await AdvancedMonitoringService.getCustomersForMap(true);
        res.render('monitoring/enhanced-network-map', {
            title: 'Enhanced Network Monitoring',
            layout: false,
            initialData: JSON.stringify(mapData)
        });
    }
    catch (error) {
        console.error('Error rendering enhanced network map:', error);
        res.status(500).send('Error loading enhanced network map');
    }
};
exports.renderEnhancedNetworkMap = renderEnhancedNetworkMap;
/**
 * Get customers for map display with status
 */
const getMapCustomers = async (req, res) => {
    try {
        const { AdvancedMonitoringService } = await Promise.resolve().then(() => __importStar(require('../../services/monitoring/AdvancedMonitoringService')));
        const result = await AdvancedMonitoringService.getCustomersForMap();
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error getting map customers:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get map customers'
        });
    }
};
exports.getMapCustomers = getMapCustomers;
/**
 * Get offline alerts (excluding isolated customers)
 */
const getOfflineAlerts = async (req, res) => {
    try {
        const { AdvancedMonitoringService } = await Promise.resolve().then(() => __importStar(require('../../services/monitoring/AdvancedMonitoringService')));
        const offlineCustomers = await AdvancedMonitoringService.getOfflineCustomersForAlarm();
        res.json({
            success: true,
            data: offlineCustomers,
            count: offlineCustomers.length
        });
    }
    catch (error) {
        console.error('Error getting offline alerts:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get offline alerts'
        });
    }
};
exports.getOfflineAlerts = getOfflineAlerts;
/**
 * Get nearby customers to a location
 */
const getNearbyCustomers = async (req, res) => {
    try {
        const { lat, lng, radius, limit } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }
        const { AdvancedMonitoringService } = await Promise.resolve().then(() => __importStar(require('../../services/monitoring/AdvancedMonitoringService')));
        const customers = await AdvancedMonitoringService.getNearbyCustomers(parseFloat(lat), parseFloat(lng), radius ? parseFloat(radius) : 1, limit ? parseInt(limit) : 10);
        res.json({
            success: true,
            data: customers
        });
    }
    catch (error) {
        console.error('Error getting nearby customers:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get nearby customers'
        });
    }
};
exports.getNearbyCustomers = getNearbyCustomers;
/**
 * Force refresh monitoring data
 */
const refreshMonitoring = async (req, res) => {
    try {
        const { AdvancedMonitoringService } = await Promise.resolve().then(() => __importStar(require('../../services/monitoring/AdvancedMonitoringService')));
        const result = await AdvancedMonitoringService.runOptimizedMonitoringCycle();
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error refreshing monitoring:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to refresh monitoring'
        });
    }
};
exports.refreshMonitoring = refreshMonitoring;
//# sourceMappingURL=networkMonitoringController.js.map