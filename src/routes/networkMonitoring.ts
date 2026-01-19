/**
 * Network Monitoring Routes
 */

import express from 'express';
import * as networkMonitoringController from '../controllers/monitoring/networkMonitoringController';

const router = express.Router();

// Public route (no authentication required) - for office display
router.get('/public/network-map', networkMonitoringController.renderPublicNetworkMap);
router.get('/public/modern-network-map', networkMonitoringController.renderModernNetworkMap);

// API routes for network monitoring data (public for now, can add auth later)
router.get('/api/network-topology', networkMonitoringController.getNetworkTopology);
router.get('/api/network-topology-fast', networkMonitoringController.getNetworkTopologyFast);
router.get('/api/devices', networkMonitoringController.getAllDevices);
router.get('/api/devices/:id/status', networkMonitoringController.checkDeviceStatus);

// Sync routes
router.post('/api/sync/genieacs', networkMonitoringController.syncFromGenieACS);
router.post('/api/sync/customers', networkMonitoringController.syncFromCustomers);
router.post('/api/sync/ftth', networkMonitoringController.syncFTTHInfrastructure);
router.post('/api/sync/links', networkMonitoringController.autoCreateLinks);

export default router;
