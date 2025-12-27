import { Router } from 'express';
import { WiFiAdminController } from '../controllers/WiFiAdminController';
import { isAuthenticated } from '../middlewares/authMiddleware';

const router = Router();

// All WiFi admin routes require authentication
router.use(isAuthenticated);

// Dashboard
router.get('/', WiFiAdminController.dashboard);

// Device Management
router.get('/devices', WiFiAdminController.manageDevices);
router.post('/devices/assign', WiFiAdminController.assignDevice);
router.post('/devices/remove', WiFiAdminController.removeDevice);

// History
router.get('/history', WiFiAdminController.history);

// Manual WiFi Change
router.post('/change', WiFiAdminController.manualChange);

// API Routes
router.get('/api/customer/:id', WiFiAdminController.apiGetCustomer);
router.get('/api/wifi-config/:device_id', WiFiAdminController.apiGetWiFiConfig);

export default router;
