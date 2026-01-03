import { Router } from 'express';
import { GenieacsController } from '../controllers/GenieacsController';

const router = Router();

// Dashboard
router.get('/', GenieacsController.dashboard);

// Device list
router.get('/devices', GenieacsController.devices);

// Device detail
router.get('/devices/:id', GenieacsController.deviceDetail);

// Device actions
router.post('/devices/:id/reboot', GenieacsController.rebootDevice);
router.post('/devices/:id/refresh', GenieacsController.refreshDevice);
router.post('/devices/:id/change-wifi', GenieacsController.changeWiFiCredentials);
router.post('/devices/:id/change-pppoe', GenieacsController.changePPPoECredentials);
router.post('/devices/:id/configure-wan', GenieacsController.configureWan);
router.post('/devices/:id/sync-tag', GenieacsController.syncCustomerTag);
router.post('/devices/sync-tags', GenieacsController.syncAllTags);

// API endpoints
router.get('/api/devices', GenieacsController.apiGetDevices);
router.get('/api/test-connection', GenieacsController.apiTestConnection);

export default router;
