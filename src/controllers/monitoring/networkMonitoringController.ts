/**
 * Network Monitoring Controller
 * Handles HTTP requests for network monitoring
 */

import { Request, Response } from 'express';
import { NetworkMonitoringService } from '../../services/monitoring/NetworkMonitoringService';

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
