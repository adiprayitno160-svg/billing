/**
 * Network Monitoring Controller
 * Handles HTTP requests for network monitoring
 */

import { Request, Response } from 'express';
import { NetworkMonitoringService } from '../../services/monitoring/NetworkMonitoringService';
import { AiSlaService } from '../../services/monitoring/AiSlaService';

/**
 * Get AI-Enhanced SLA Report
 */
export const getSlaReport = async (req: Request, res: Response) => {
    try {
        const { customerId, month, year } = req.query;

        if (!customerId || !month || !year) {
            return res.status(400).json({ success: false, error: 'Missing parameters: customerId, month, year' });
        }

        const report = await AiSlaService.generateSlaReport(
            Number(customerId),
            Number(month),
            Number(year)
        );

        res.json({ success: true, data: report });
    } catch (error) {
        console.error('SLA Report Error:', error);
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

/**
 * Get network topology data (for map view)
 */
export const getNetworkTopology = async (req: Request, res: Response) => {
    try {
        const topology = await NetworkMonitoringService.getNetworkTopology();
        res.json({
            success: true,
            data: topology
        });
    } catch (error) {
        console.error('Error getting network topology:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get network topology'
        });
    }
};

/**
 * Get network topology without heavy sync operations (faster response)
 */
export const getNetworkTopologyFast = async (req: Request, res: Response) => {
    try {
        // Get only the basic topology data without heavy sync operations
        const topology = await NetworkMonitoringService.getNetworkTopologyFast();
        res.json({
            success: true,
            data: topology
        });
    } catch (error) {
        console.error('Error getting fast network topology:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get network topology'
        });
    }
};

/**
 * Get all devices
 */
export const getAllDevices = async (req: Request, res: Response) => {
    try {
        const devices = await NetworkMonitoringService.getAllDevices();
        res.json({
            success: true,
            data: devices
        });
    } catch (error) {
        console.error('Error getting devices:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get devices'
        });
    }
};

/**
 * Sync devices from GenieACS
 */
export const syncFromGenieACS = async (req: Request, res: Response) => {
    try {
        const result = await NetworkMonitoringService.syncDevicesFromGenieACS();
        res.json({
            success: true,
            message: `Synced ${result.added} new devices, updated ${result.updated} existing devices`,
            data: result
        });
    } catch (error) {
        console.error('Error syncing from GenieACS:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync from GenieACS'
        });
    }
};

/**
 * Sync devices from customers
 */
export const syncFromCustomers = async (req: Request, res: Response) => {
    try {
        const result = await NetworkMonitoringService.syncCustomerDevices();
        res.json({
            success: true,
            message: `Synced ${result.added} new devices, updated ${result.updated} existing devices`,
            data: result
        });
    } catch (error) {
        console.error('Error syncing from customers:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync from customers'
        });
    }
};

/**
 * Sync FTTH infrastructure
 */
export const syncFTTHInfrastructure = async (req: Request, res: Response) => {
    try {
        const result = await NetworkMonitoringService.syncFTTHInfrastructure();
        res.json({
            success: true,
            message: `Synced ${result.added} new devices, updated ${result.updated} existing devices`,
            data: result
        });
    } catch (error) {
        console.error('Error syncing FTTH infrastructure:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync FTTH infrastructure'
        });
    }
};

/**
 * Auto-create network links
 */
export const autoCreateLinks = async (req: Request, res: Response) => {
    try {
        const created = await NetworkMonitoringService.autoCreateLinks();
        res.json({
            success: true,
            message: `Created ${created} network links`,
            data: { created }
        });
    } catch (error) {
        console.error('Error auto-creating links:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to auto-create links'
        });
    }
};

/**
 * Check device status
 */
export const checkDeviceStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const deviceId = parseInt(id);

        if (isNaN(deviceId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid device ID'
            });
        }

        const status = await NetworkMonitoringService.checkDeviceStatus(deviceId);
        await NetworkMonitoringService.updateDeviceStatus(deviceId, status);

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error checking device status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check device status'
        });
    }
};

/**
 * Render public network map page (no login required)
 */
// Render classic network map
export const renderPublicNetworkMap = async (req: Request, res: Response) => {
    try {
        res.render('monitoring/public-network-map', {
            title: 'Network Monitoring v2.4.9',
            layout: false // No layout, standalone page
        });
    } catch (error) {
        console.error('Error rendering network map:', error);
        res.status(500).send('Error loading network map');
    }
};

// Render modern network map
export const renderModernNetworkMap = async (req: Request, res: Response) => {
    try {
        res.render('monitoring/modern-network-map', {
            title: 'Modern Network Monitoring Dashboard',
            layout: false // No layout, standalone page
        });
    } catch (error) {
        console.error('Error rendering modern network map:', error);
        res.status(500).send('Error loading modern network map');
    }
};

// Render enhanced network map with customer monitoring
export const renderEnhancedNetworkMap = async (req: Request, res: Response) => {
    try {
        // Fetch initial data to speed up first load
        const { AdvancedMonitoringService } = await import('../../services/monitoring/AdvancedMonitoringService');
        // Force refresh cache to get latest data
        const mapData = await AdvancedMonitoringService.getCustomersForMap(true);

        res.render('monitoring/enhanced-network-map', {
            title: 'Enhanced Network Monitoring',
            layout: false,
            initialData: JSON.stringify(mapData)
        });
    } catch (error) {
        console.error('Error rendering enhanced network map:', error);
        res.status(500).send('Error loading enhanced network map');
    }
};

/**
 * Get customers for map display with status
 */
export const getMapCustomers = async (req: Request, res: Response) => {
    try {
        const { AdvancedMonitoringService } = await import('../../services/monitoring/AdvancedMonitoringService');
        const result = await AdvancedMonitoringService.getCustomersForMap();

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error getting map customers:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get map customers'
        });
    }
};

/**
 * Get offline alerts (excluding isolated customers)
 */
export const getOfflineAlerts = async (req: Request, res: Response) => {
    try {
        const { AdvancedMonitoringService } = await import('../../services/monitoring/AdvancedMonitoringService');
        const offlineCustomers = await AdvancedMonitoringService.getOfflineCustomersForAlarm();

        res.json({
            success: true,
            data: offlineCustomers,
            count: offlineCustomers.length
        });
    } catch (error) {
        console.error('Error getting offline alerts:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get offline alerts'
        });
    }
};

/**
 * Get nearby customers to a location
 */
export const getNearbyCustomers = async (req: Request, res: Response) => {
    try {
        const { lat, lng, radius, limit } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const { AdvancedMonitoringService } = await import('../../services/monitoring/AdvancedMonitoringService');
        const customers = await AdvancedMonitoringService.getNearbyCustomers(
            parseFloat(lat as string),
            parseFloat(lng as string),
            radius ? parseFloat(radius as string) : 1,
            limit ? parseInt(limit as string) : 10
        );

        res.json({
            success: true,
            data: customers
        });
    } catch (error) {
        console.error('Error getting nearby customers:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get nearby customers'
        });
    }
};

/**
 * Force refresh monitoring data
 */
export const refreshMonitoring = async (req: Request, res: Response) => {
    try {
        const { AdvancedMonitoringService } = await import('../../services/monitoring/AdvancedMonitoringService');
        const result = await AdvancedMonitoringService.runOptimizedMonitoringCycle();

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error refreshing monitoring:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to refresh monitoring'
        });
    }
};

/**
 * Render ODP Problems Dashboard
 */
export const renderODPProblems = async (req: Request, res: Response) => {
    try {
        const { AdvancedMonitoringService } = await import('../../services/monitoring/AdvancedMonitoringService');
        const problems = await AdvancedMonitoringService.getODPProblems();

        res.render('monitoring/odp-problems', {
            title: 'ODP Problems Dashboard',
            problems,
            layout: false
        });
    } catch (error) {
        console.error('Error rendering ODP problems:', error);
        res.status(500).send('Error loading ODP problems dashboard');
    }
};

/**
 * API to get ODP Problems data
 */
export const getODPProblemsAPI = async (req: Request, res: Response) => {
    try {
        const { AdvancedMonitoringService } = await import('../../services/monitoring/AdvancedMonitoringService');
        const problems = await AdvancedMonitoringService.getODPProblems();

        res.json({
            success: true,
            data: problems
        });
    } catch (error) {
        console.error('Error getting ODP problems API:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get ODP problems'
        });
    }
};
